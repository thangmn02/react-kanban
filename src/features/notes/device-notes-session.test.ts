import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { deviceNotesRepository } from './device-notes-session';
import { newNote, type StickyNote } from './notes-store';

const mocks=vi.hoisted(()=>({rows:[] as StickyNote[],save:vi.fn(),drafts:vi.fn(),persist:vi.fn()}));
vi.mock('./notes-store',async importOriginal=>({...await importOriginal<typeof import('./notes-store')>(),readNotes:()=>mocks.rows,readDurableDeviceNotes:async()=>mocks.rows,saveNoteSafely:mocks.save}));
vi.mock('./native-note-bridge',()=>({readDeviceDrafts:mocks.drafts,writeDeviceDraft:mocks.persist,retireDeviceDraft:async()=>{}}));
const releases:(()=>void)[]=[];
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();mocks.persist.mockResolvedValue(undefined);mocks.drafts.mockResolvedValue([]);mocks.rows=[{...newNote(),revision:1,title:'Original'}];mocks.save.mockImplementation(async(_scope,note,revision,token)=>{const current=mocks.rows.find(row=>row.id===note.id);if(current&& (current.revision!==revision||current.writeToken!==token))throw Error('Compare-and-swap conflict');const saved={...note,revision:(current?.revision??0)+1};mocks.rows=current?mocks.rows.map(row=>row.id===note.id?saved:row):[...mocks.rows,saved];return mocks.rows;});});
afterEach(()=>releases.splice(0).forEach(release=>release()));
const repository=()=>{const owner=deviceNotesRepository({userId:crypto.randomUUID(),workspaceId:null});releases.push(owner.acquire());return owner.session;};
it('serializes rapid edits using the acknowledged predecessor and preserves changes to both fields',async()=>{const session=repository(),id=mocks.rows[0].id;const first=session.change(id,{title:'Latest title'}),second=session.change(id,{html:'<p>Latest content</p>'});await Promise.all([first,second]);expect(mocks.rows[0]).toMatchObject({title:'Latest title',html:'<p>Latest content</p>',revision:3});expect(session.getSnapshot().drafts).toHaveLength(0);});
it('retries the latest retained draft after a transient local write failure',async()=>{const session=repository(),id=mocks.rows[0].id;mocks.save.mockRejectedValueOnce(Error('Disk temporarily unavailable'));await expect(session.change(id,{html:'First retained edit'})).rejects.toThrow('Disk');await expect(session.change(id,{html:'Latest retained edit'})).rejects.toThrow('earlier local save');expect(mocks.save).toHaveBeenCalledTimes(1);await session.retry(id);expect(mocks.rows[0].html).toBe('Latest retained edit');expect(session.getSnapshot().drafts).toHaveLength(0);});
it('keeps a conflicted draft instead of overwriting another writer during retry',async()=>{const session=repository(),id=mocks.rows[0].id;mocks.save.mockRejectedValueOnce(Error('Compare-and-swap conflict'));await expect(session.change(id,{title:'Retained private title'})).rejects.toThrow();mocks.rows=[{...mocks.rows[0],revision:2,writeToken:crypto.randomUUID(),title:'Other writer'}];await expect(session.retry(id)).rejects.toThrow('another window');expect(mocks.rows[0].title).toBe('Other writer');expect(session.getSnapshot().drafts[0].note.title).toBe('Retained private title');expect(mocks.save).toHaveBeenCalledTimes(1);});
it('keyless retry saves the current writer draft and preserves an older retained writer',async()=>{
  const userId=crypto.randomUUID(),original=mocks.rows[0],oldKey=`kora:device-notes-draft:kanban:${userId}:global:notes-preview:v1:${original.id}:${crypto.randomUUID()}`;
  mocks.drafts.mockResolvedValue([{key:oldKey,value:JSON.stringify({note:{...original,title:'Old retained writer'},baseRevision:1,baseToken:original.writeToken,ownTokens:[]})}]);
  const owner=deviceNotesRepository({userId,workspaceId:null});releases.push(owner.acquire());const session=owner.session;await vi.waitFor(()=>expect(session.getSnapshot().drafts).toHaveLength(1));mocks.save.mockRejectedValueOnce(Error('Disk unavailable'));await expect(session.change(original.id,{title:'Current visible writer'})).rejects.toThrow('Disk');
  await session.retry(original.id);expect(mocks.rows[0].title).toBe('Current visible writer');expect(session.getSnapshot().drafts).toHaveLength(1);expect(session.getSnapshot().drafts[0].note.title).toBe('Old retained writer');
});
it('blocks closing when the latest draft could not commit to durable storage',async()=>{
  const session=repository(),id=mocks.rows[0].id;mocks.persist.mockRejectedValueOnce(Error('Draft transaction aborted'));await expect(session.change(id,{title:'Unsaved local draft'})).rejects.toThrow('Draft transaction');await expect(session.prepareToClose()).rejects.toThrow('not saved yet');await session.retry(id);await expect(session.prepareToClose()).resolves.toBeUndefined();
});
it('permits closing after an edit is durably journaled even if canonical CAS needs recovery',async()=>{
  const session=repository(),id=mocks.rows[0].id;mocks.save.mockRejectedValueOnce(Error('Compare-and-swap conflict'));await expect(session.change(id,{title:'Recoverable local draft'})).rejects.toThrow('Compare-and-swap');await expect(session.prepareToClose()).resolves.toBeUndefined();expect(session.getSnapshot().drafts[0].note.title).toBe('Recoverable local draft');
});
it('waits for the newest queued edit before acknowledging a native read',async()=>{
  const session=repository(),id=mocks.rows[0].id,save=mocks.save.getMockImplementation()!;
  let unblock!:()=>void;const held=new Promise<void>(resolve=>{unblock=resolve;});
  mocks.save.mockImplementationOnce(save).mockImplementationOnce(async(...args)=>{await held;return save(...args);});
  const first=session.change(id,{title:'Committed predecessor'}),second=session.change(id,{html:'Newest held edit'});
  await first;let returned=false;const read=session.whenNoteDurable(id).then(note=>{returned=true;return note;});
  await new Promise(resolve=>setTimeout(resolve,0));expect(returned).toBe(false);
  unblock();await second;expect(await read).toMatchObject({title:'Committed predecessor',html:'Newest held edit',revision:3});
});
it('retries the full retained frame over this session’s committed predecessor',async()=>{
  const session=repository(),id=mocks.rows[0].id,expected=mocks.rows[0].writeToken;
  await session.change(id,{title:'Acknowledged predecessor'},'frame-a');mocks.persist.mockRejectedValueOnce(Error('Outbox interrupted'));
  await expect(session.change(id,{html:'Failed retained content'})).rejects.toThrow('Outbox');
  const saved=await session.retryFrame(id,{title:'Newest frame title',html:'Newest retained frame content'},expected,'frame-a');
  expect(saved).toMatchObject({title:'Newest frame title',html:'Newest retained frame content',revision:3});
  expect(session.getSnapshot().drafts).toHaveLength(0);
});
it('rejects a retained native frame when another writer changed the original',async()=>{
  const session=repository(),id=mocks.rows[0].id,expected=mocks.rows[0].writeToken;
  await session.change(id,{title:'Own acknowledged predecessor'});
  mocks.rows=[{...mocks.rows[0],revision:3,writeToken:crypto.randomUUID(),title:'Another writer'}];
  await expect(session.retryFrame(id,{title:'Retained frame'},expected)).rejects.toThrow('another window');
  expect(mocks.rows[0].title).toBe('Another writer');
});
it('rejects a stale frame retry after the shared manager committed a later edit',async()=>{
  const session=repository(),id=mocks.rows[0].id,expected=mocks.rows[0].writeToken;
  await session.change(id,{title:'Frame predecessor'},'frame-a');
  await session.change(id,{title:'Later manager edit'});
  await expect(session.retryFrame(id,{title:'Stale retained frame'},expected,'frame-a')).rejects.toThrow('another window');
  expect(mocks.rows[0].title).toBe('Later manager edit');
});
it('keeps the scope saving while another note has an uncommitted local transaction',async()=>{
  mocks.rows.push({...newNote(),revision:1,title:'Second original'});const session=repository(),[first,second]=mocks.rows;
  let commit!:()=>void;const held=new Promise<void>(resolve=>{commit=resolve;});mocks.persist.mockImplementationOnce(()=>held).mockResolvedValue(undefined);
  const unfinished=session.change(second.id,{title:'Held second edit'});await session.change(first.id,{title:'Committed first edit'});
  expect(session.getSnapshot().status).toBe('Saving locally…');commit();await unfinished;expect(session.getSnapshot().status).toBe('Saved locally on this device.');
});
