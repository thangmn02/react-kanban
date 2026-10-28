import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConnectedNotesSession } from './connected-notes-session';
import { newNote } from './notes-store';
import type { ConnectedNote, NoteRow } from './notes-types';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn(), layout: vi.fn(), session: vi.fn(), removeChannel: vi.fn(),persist:vi.fn(),retire:vi.fn() }));
vi.mock('./native-note-bridge',()=>({writeNativeDraft:mocks.persist,retireNativeDraft:mocks.retire,readStoredNoteDrafts:async()=>[]}));
vi.mock('../../services/notes.service', () => ({ fetchConnectedNotes: mocks.fetch, saveConnectedNote: mocks.save, saveNoteLayout: mocks.layout }));
vi.mock('../../lib/supabase', () => ({ requireSupabaseClient: () => ({ auth: { getSession: mocks.session, onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) }, channel: () => { const channel = { on: () => channel, subscribe: vi.fn() }; return channel; }, removeChannel: mocks.removeChannel }) }));
const user = { id: 'owner', email: null, name: 'Owner', avatarUrl: '', isMock: false };
const makeEntry = (): ConnectedNote => {
  const note = { ...newNote(), title: 'Saved', revision: 1 };
  const row: NoteRow = { id: note.id, owner_user_id: user.id, workspace_id: 'workspace', title: note.title, content: { html: '', checklist: [] }, content_schema_version: 1, visibility: 'private', revision: 1, write_token: note.writeToken, import_key: null, created_at: note.updatedAt, updated_at: note.updatedAt, deleted_at: null };
  return { note, row, permission: 'manage' };
};
beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks(); localStorage.clear(); mocks.persist.mockResolvedValue(undefined);mocks.retire.mockResolvedValue(true);mocks.fetch.mockResolvedValue([]); mocks.session.mockResolvedValue({ data: { session: { user: { id: 'owner' } } } }); mocks.layout.mockResolvedValue(undefined); });
afterEach(() => { vi.useRealTimers(); });
it('does not acknowledge the scope while a different note outbox transaction is still pending',async()=>{
  const first=makeEntry(),second=makeEntry();mocks.fetch.mockResolvedValue([first,second]);let commit!:()=>void;const held=new Promise<void>(resolve=>{commit=resolve;});
  mocks.persist.mockImplementation(async(_key,raw)=>{if(JSON.parse(raw).note.id===second.note.id)await held;});
  const owner=new ConnectedNotesSession(user,'workspace','owner');await owner.refresh();owner.change(second.note.id,{title:'Held draft'});owner.change(first.note.id,{title:'Committed draft'});await owner.whenDurable(first.note.id);
  expect(owner.getSnapshot().status).toBe('Saving locally…');commit();await owner.whenDurable(second.note.id);expect(owner.getSnapshot().status).toBe('Saved locally, awaiting synchronization.');
});
it.each(['success','failure'])('preserves another note pending durability after remote %s',async(outcome)=>{
  const first=makeEntry(),second=makeEntry();mocks.fetch.mockResolvedValue([first,second]);let commit!:()=>void;const held=new Promise<void>(resolve=>{commit=resolve;});
  mocks.persist.mockImplementation(async(_key,raw)=>{if(JSON.parse(raw).note.id===second.note.id)await held;});
  const owner=new ConnectedNotesSession(user,'workspace','owner');await owner.refresh();owner.change(second.note.id,{title:'Still saving'});owner.change(first.note.id,{title:'Remote edit'});
  if(outcome==='success')mocks.save.mockImplementation(async(_note,_scope,_revision,token)=>({...first.row,revision:2,write_token:token}));else mocks.save.mockRejectedValue(Error('Offline'));
  await owner.flush(first.note.id);expect(owner.getSnapshot().status).toBe('Saving locally…');commit();await owner.whenDurable(second.note.id);
});
it.each(['layout','retirement'])('rotates the content operation after a confirmed commit followed by %s failure',async(failure)=>{
  const entry=makeEntry();mocks.fetch.mockResolvedValue([entry]);
  const owner=new ConnectedNotesSession(user,'workspace','owner');await owner.refresh();
  owner.change(entry.note.id,{title:'First content',pinned:true},'frame-a');
  mocks.save.mockImplementationOnce(async(_note,_workspace,_revision,token)=>({...entry.row,title:'First content',revision:2,write_token:token}));
  if(failure==='layout')mocks.layout.mockRejectedValueOnce(Error('Layout interrupted'));else mocks.retire.mockRejectedValueOnce(Error('Retirement interrupted'));
  await owner.flush(entry.note.id);const firstToken=mocks.save.mock.calls[0][3];
  expect(owner.getSnapshot().drafts).toHaveLength(1);
  owner.change(entry.note.id,{title:'Newer content'},'frame-a');
  mocks.save.mockImplementationOnce(async(_note,_workspace,_revision,token)=>({...entry.row,title:'Newer content',revision:3,write_token:token}));
  await owner.flush(entry.note.id);
  expect(mocks.save).toHaveBeenCalledTimes(2);expect(mocks.save.mock.calls[1][2]).toBe(2);expect(mocks.save.mock.calls[1][3]).not.toBe(firstToken);
  expect(owner.getSnapshot().notes[0].note.title).toBe('Newer content');expect(owner.getSnapshot().drafts).toHaveLength(0);
});
it('does not authorize a stale frame through another shared-surface commit or pending edit',async()=>{
  const entry=makeEntry();mocks.fetch.mockResolvedValue([entry]);const owner=new ConnectedNotesSession(user,'workspace','owner');await owner.refresh();
  owner.change(entry.note.id,{title:'Frame predecessor'},'frame-a');mocks.save.mockImplementationOnce(async(_note,_scope,_revision,token)=>({...entry.row,revision:2,write_token:token}));await owner.flush(entry.note.id);
  expect(owner.canRetryFrame(entry.note.id,1,'frame-a')).toBe(true);
  owner.change(entry.note.id,{title:'Manager pending edit'});expect(owner.canRetryFrame(entry.note.id,2,'frame-a')).toBe(false);
  mocks.save.mockImplementationOnce(async(_note,_scope,_revision,token)=>({...entry.row,revision:3,write_token:token}));await owner.flush(entry.note.id);
  expect(owner.canRetryFrame(entry.note.id,1,'frame-a')).toBe(false);
});
it('exposes retained account-scoped drafts during a restart with an unavailable backend', async () => {
  const entry = makeEntry();
  localStorage.setItem(`kora:notes-draft:owner:workspace:${entry.note.id}:old-writer`, JSON.stringify({ note: entry.note, baseRevision: 1, token: crypto.randomUUID(), content: true, layout: false, updatedAt: new Date().toISOString() }));
  mocks.fetch.mockRejectedValue(Error('Offline'));
  const owner = new ConnectedNotesSession(user, 'workspace', 'owner'); await owner.refresh();
  expect(owner.getSnapshot().drafts).toHaveLength(1); expect(owner.getSnapshot().error).toBe('Offline');
  const other = new ConnectedNotesSession({ ...user, id: 'other' }, 'workspace', 'owner'); expect(other.getSnapshot().drafts).toHaveLength(0);
  expect(new ConnectedNotesSession(user, 'other-workspace', 'owner').getSnapshot().drafts).toHaveLength(0);
});
it('waits for a coalesced refresh before allowing edits against a changed server revision', async () => {
  const entry = makeEntry(); let first!: (rows: ConnectedNote[]) => void, second!: (rows: ConnectedNote[]) => void;
  mocks.fetch.mockImplementationOnce(() => new Promise(resolve => { first = resolve; })).mockImplementationOnce(() => new Promise(resolve => { second = resolve; }));
  const owner = new ConnectedNotesSession(user, 'workspace', 'owner'); let finished = false;
  const requested = owner.refresh().then(() => { finished = true; }); const repeated = owner.refresh();
  first([entry]); await Promise.resolve(); await Promise.resolve();
  expect(finished).toBe(false);
  second([{ ...entry, row: { ...entry.row, revision: 2 }, note: { ...entry.note, revision: 2 } }]); await Promise.all([requested, repeated]);
  owner.change(entry.note.id, { title: 'After sharing settled' }); expect(owner.getSnapshot().drafts[0].draft.baseRevision).toBe(2);
});
it('retains failed saves and retries the same operation token without overwriting a conflict', async () => {
  const entry = makeEntry(); mocks.fetch.mockResolvedValue([entry]); mocks.save.mockRejectedValueOnce(Error('Offline'));
  const owner = new ConnectedNotesSession(user, 'workspace', 'owner'); await owner.refresh(); owner.change(entry.note.id, { title: 'Draft' }); await owner.flush(entry.note.id);
  expect(owner.getSnapshot().drafts[0].draft.note.title).toBe('Draft');
  const firstToken = mocks.save.mock.calls[0][3];
  mocks.save.mockRejectedValueOnce(Object.assign(Error('Server changed'), { code: 'PT409' })); await owner.flush(entry.note.id);
  expect(mocks.save.mock.calls[1][3]).toBe(firstToken); expect(owner.getSnapshot().conflicts).toContain(entry.note.id);
  await owner.flush(entry.note.id); expect(mocks.save).toHaveBeenCalledTimes(2); expect(owner.getSnapshot().drafts).toHaveLength(1);
});
it('retires a recovered source only after a confirmed save', async () => {
  const entry = makeEntry(); mocks.fetch.mockResolvedValue([entry]);
  const key = `kora:notes-draft:owner:workspace:${entry.note.id}:old-writer`;
  localStorage.setItem(key, JSON.stringify({ note: { ...entry.note, title: 'Recovered' }, baseRevision: 1, token: crypto.randomUUID(), content: true, layout: false, updatedAt: new Date().toISOString() }));
  const owner = new ConnectedNotesSession(user, 'workspace', 'owner'); await owner.refresh(); owner.recover(key, false);
  expect(localStorage.getItem(key)).not.toBeNull(); mocks.save.mockResolvedValue({ ...entry.row, title: 'Recovered', revision: 2 }); await owner.flush(entry.note.id);
  expect(localStorage.getItem(key)).toBeNull(); expect(owner.getSnapshot().drafts).toHaveLength(0);
});
it('preserves a source draft changed by another session while its recovered copy is syncing', async () => {
  const entry = makeEntry(); mocks.fetch.mockResolvedValue([entry]);
  const key = `kora:notes-draft:owner:workspace:${entry.note.id}:old-writer`;
  localStorage.setItem(key, JSON.stringify({ note: entry.note, baseRevision: 1, token: crypto.randomUUID(), content: true, layout: false, updatedAt: new Date().toISOString() }));
  const owner = new ConnectedNotesSession(user, 'workspace', 'owner'); await owner.refresh(); owner.recover(key, false);
  const changed = JSON.stringify({ ...owner.getSnapshot().drafts.find(item => item.key === key)!.draft, note: { ...entry.note, title: 'New change from another session' } });
  localStorage.setItem(key, changed); mocks.save.mockResolvedValue({ ...entry.row, revision: 2 }); await owner.flush(entry.note.id);
  expect(localStorage.getItem(key)).toBe(changed);
});
it('preserves malformed draft records without crashing construction or hiding valid recovery records', () => {
  const entry = makeEntry();
  localStorage.setItem('kora:notes-draft:owner:workspace:broken:writer', JSON.stringify({ note: entry.note, baseRevision: 1, token: 'valid-shape-except-time' }));
  const owner = new ConnectedNotesSession(user, 'workspace', 'owner');
  expect(owner.getSnapshot().drafts).toEqual([]); expect(localStorage.length).toBe(1);
});
it('gives edits made during an in-flight write a different durable token', async () => {
  const entry = makeEntry(); mocks.fetch.mockResolvedValue([entry]);
  let complete!: (row: NoteRow) => void; mocks.save.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const owner = new ConnectedNotesSession(user, 'workspace', 'owner'); await owner.refresh(); owner.change(entry.note.id, { title: 'First' });
  const saving = owner.flush(entry.note.id); await vi.waitFor(()=>expect(mocks.save).toHaveBeenCalled());
  const firstToken = mocks.save.mock.calls[0][3]; owner.change(entry.note.id, { title: 'Second' });
  expect(owner.getSnapshot().drafts[0].draft.token).not.toBe(firstToken);
  await owner.whenDurable(entry.note.id);
  mocks.retire.mockImplementation(async(_key,raw)=>{if(JSON.parse(raw).note.title!=='Second')throw Error('A newer outbox record exists');});
  mocks.save.mockResolvedValue({ ...entry.row, revision: 3 }); complete({ ...entry.row, revision: 2 }); await saving;
  await vi.waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(2));expect(mocks.save.mock.calls[1][2]).toBe(2);await vi.waitFor(()=>expect(owner.getSnapshot().drafts).toHaveLength(0));
});
it('refuses queued writes after the authenticated account changes or the scope is disposed', async () => {
  const entry = makeEntry(); mocks.fetch.mockResolvedValue([entry]);
  const owner = new ConnectedNotesSession(user, 'workspace', 'owner'); const stop = owner.start(); await owner.refresh(); owner.change(entry.note.id, { title: 'Retain' });
  mocks.session.mockResolvedValue({ data: { session: { user: { id: 'other' } } } }); await owner.flush(entry.note.id); expect(mocks.save).not.toHaveBeenCalled();
  stop(); await owner.flush(entry.note.id); expect(mocks.save).not.toHaveBeenCalled(); expect(localStorage.length).toBe(1);
});
it('does not send an edit until its local transaction commits and permits retry after a local failure',async()=>{
  const entry=makeEntry();mocks.fetch.mockResolvedValue([entry]);mocks.persist.mockRejectedValueOnce(Error('Local transaction aborted'));
  const owner=new ConnectedNotesSession(user,'workspace','owner');await owner.refresh();owner.change(entry.note.id,{title:'Retained after local failure'});await owner.flush(entry.note.id);
  expect(mocks.save).not.toHaveBeenCalled();expect(owner.getSnapshot().status).toBe('Local save failed.');expect(owner.getSnapshot().drafts[0].draft.note.title).toBe('Retained after local failure');
  mocks.save.mockResolvedValue({...entry.row,revision:2});owner.retry();await vi.waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(1));await vi.waitFor(()=>expect(owner.getSnapshot().drafts).toHaveLength(0));
});
it('retains the recovery record when conditional journal retirement fails',async()=>{
  const entry=makeEntry();mocks.fetch.mockResolvedValue([entry]);mocks.save.mockResolvedValue({...entry.row,revision:2});mocks.retire.mockRejectedValueOnce(Error('A newer draft exists'));
  const owner=new ConnectedNotesSession(user,'workspace','owner');await owner.refresh();owner.change(entry.note.id,{title:'Retained'});await owner.flush(entry.note.id);
  expect(owner.getSnapshot().drafts).toHaveLength(1);expect(owner.getSnapshot().status).toBe('Waiting to sync.');
});
it('blocks closing after a failed local draft transaction and allows it after durable retry',async()=>{
  const entry=makeEntry();mocks.fetch.mockResolvedValue([entry]);mocks.persist.mockRejectedValueOnce(Error('Draft transaction aborted'));mocks.save.mockResolvedValue({...entry.row,revision:2});const owner=new ConnectedNotesSession(user,'workspace','owner');await owner.refresh();owner.change(entry.note.id,{title:'Recoverable connected draft'});await owner.flush(entry.note.id);await expect(owner.prepareToClose()).rejects.toThrow('Draft transaction');owner.retry();await owner.whenDurable(entry.note.id);await expect(owner.prepareToClose()).resolves.toBeUndefined();
});
it('reconciles a committed operation after restart without another write or duplicate note',async()=>{
  const entry=makeEntry(),token=crypto.randomUUID(),key=`kora:notes-draft:owner:workspace:${entry.note.id}:old-writer`;mocks.fetch.mockResolvedValue([{...entry,row:{...entry.row,revision:2,write_token:token},note:{...entry.note,revision:2}}]);
  localStorage.setItem(key,JSON.stringify({note:entry.note,baseRevision:1,token,content:true,layout:false,updatedAt:new Date().toISOString()}));const owner=new ConnectedNotesSession(user,'workspace','owner');await owner.refresh();owner.recover(key,false);await vi.waitFor(()=>expect(owner.getSnapshot().drafts).toHaveLength(0));expect(mocks.save).not.toHaveBeenCalled();expect(mocks.retire).toHaveBeenCalledTimes(1);
});
it('reuses the persisted operation token when resuming an uncommitted restart draft',async()=>{
  const entry=makeEntry(),token=crypto.randomUUID(),key=`kora:notes-draft:owner:workspace:${entry.note.id}:old-writer`;mocks.fetch.mockResolvedValue([entry]);mocks.save.mockResolvedValue({...entry.row,revision:2});localStorage.setItem(key,JSON.stringify({note:{...entry.note,title:'Restart draft'},baseRevision:1,token,content:true,layout:false,updatedAt:new Date().toISOString()}));const owner=new ConnectedNotesSession(user,'workspace','owner');await owner.refresh();owner.recover(key,false);await owner.flush(entry.note.id);expect(mocks.save.mock.calls[0][3]).toBe(token);expect(owner.getSnapshot().notes[0].note.id).toBe(entry.note.id);
});
