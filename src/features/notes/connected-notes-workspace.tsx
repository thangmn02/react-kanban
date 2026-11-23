import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { DropdownMenuOption } from '@astryxdesign/core/DropdownMenu';
import type { AppUser, WorkspaceMember, WorkspaceSummary } from '../../types/auth.type';
import type { ITaskItem } from '../../types/task.type';
import { connectedNotesRepository } from './notes-repository';
import NoteCollaboration from './note-collaboration';
import { notesKey, readDurableDeviceNotes, type StickyNote } from './notes-store';
import { fetchConnectedNotes, importNoteLayoutIfAbsent, saveConnectedNote, setNoteArchived, setNoteDeleted, moveConnectedNote } from '../../services/notes.service';
import { createTask, fetchTasks } from '../../services/task.service';
import { replaceTaskChecklistItems } from '../../services/checklist.service';
import { isTauri } from '@tauri-apps/api/core';
import { openQuickNotes } from './quick-notes-events';
import NativeNotesControls from './native-notes-controls';
import NoteImportPreview from './note-import-preview';
import { copyNote, exportNotes, parseNotesBundle, bundleNoteMedia, downloadNotesFile, type NotesBundle, type NoteDestination, type ImportChoices } from './note-transfer';
import { connectedNoteMedia } from './connected-note-media';
import { deviceNoteMedia } from './note-media';
import { fetchUserWorkspaces } from '../../services/workspace.service';
import { useI18n } from '../../i18n';
import NotesManager from './notes-manager';
import { asManagerFilter, type ManagerEntry, type ManagerFilter } from './notes-manager-model';
import { normalizeLabels } from './note-labels';

export interface ConnectedNotesWorkspaceProps {
  user: AppUser; workspace: WorkspaceSummary | null; members: WorkspaceMember[];
  personal?: boolean; filter?: string; label?: string | null; boardId: string | null; listId: string | null; tasks: ITaskItem[];
  taskId?: string; onOpenTask: (taskId: string, boardId: string) => void;
  /** Route-owned view state; without it the view is kept locally (task notes overlay). */
  onNavigate?: (next: { filter: ManagerFilter; label: string | null }) => void;
  createOnOpen?: boolean; onCreated?: () => void;
  /** `?note=`: open this note in the sheet, then report it handled. */
  noteId?: string | null; onNoteHandled?: () => void;
}
export default function ConnectedNotesWorkspace({ user, workspace, members, personal = false, filter: filterProp = 'all', label: labelProp = null, boardId, listId, tasks, taskId, onOpenTask, onNavigate, createOnOpen, onCreated, noteId, onNoteHandled }: ConnectedNotesWorkspaceProps) {
  const { t } = useI18n();
  const workspaceId = personal ? null : workspace?.id ?? null;
  const [repository] = useState(() => connectedNotesRepository(user, workspaceId, workspace?.role));
  const session = repository.session;
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [selected, setSelected] = useState<string | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [showImport, setShowImport] = useState(false);
  const [discardKey, setDiscardKey] = useState<string | null>(null);
  const [deviceNotes,setDeviceNotes]=useState<StickyNote[]>([]),[bundle,setBundle]=useState<NotesBundle|null>(null),[transferStatus,setTransferStatus]=useState(''),[moveId,setMoveId]=useState<string|null>(null),[clearMoveLink,setClearMoveLink]=useState(false);
  const [localView,setLocalView]=useState<{filter:ManagerFilter;label:string|null}>({filter:asManagerFilter(filterProp),label:labelProp});
  const view = onNavigate ? { filter: asManagerFilter(filterProp), label: labelProp } : localView;
  const importFile=useRef<HTMLInputElement>(null);
  const [destinations,setDestinations]=useState<WorkspaceSummary[]>([]),[moveDestination,setMoveDestination]=useState('personal');
  useEffect(() => repository.acquire(), [repository]);
  useEffect(()=>{let active=true;void fetchUserWorkspaces(user).then(rows=>{if(active)setDestinations(rows);}).catch(()=>{});return()=>{active=false;};},[user]);
  const scope = { userId: user.id, workspaceId: workspace?.id ?? null };
  const canCreate = personal || !!workspace && workspace.role !== 'viewer';
  const createdOnOpen = useRef(false);
  useEffect(() => { if (createOnOpen && !snapshot.loading && canCreate && !createdOnOpen.current) { createdOnOpen.current = true; session.create(); onCreated?.(); } }, [createOnOpen, snapshot.loading, canCreate, session, onCreated]);
  const selectedEntry = snapshot.notes.find(entry => entry.row.id === selected && !entry.row.deleted_at);
  const entries: ManagerEntry[] = snapshot.notes.filter(entry => !taskId || entry.note.taskId === taskId).map(entry => {
    const editable = ['edit', 'manage'].includes(entry.permission);
    return { note: { ...entry.note, deletedAt: entry.row.deleted_at, archivedAt: entry.row.archived_at ?? entry.note.archivedAt ?? null },
      readOnly: !editable || snapshot.conflicts.includes(entry.row.id) || session.isDiscarding(entry.note.id), canArchive: editable, canTrash: entry.permission === 'manage',
      shared: entry.row.visibility === 'workspace' || entry.row.owner_user_id !== user.id };
  });
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(''); try { await action(); await session.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Notes could not save this change.'); } finally { setBusy(false); }
  };
  /** Row-level actions run against the synchronized revision, never over a pending edit. */
  const settledRow = async (id: string) => {
    await session.flush(id);
    if (session.hasPending(id)) throw Error('Wait for this note to finish syncing, then try again.');
    const entry = session.getSnapshot().notes.find(row => row.row.id === id);
    if (!entry) throw Error('The note is unavailable.');
    return entry.row;
  };
  const rowAction = async (ids: string[], action: (row: Awaited<ReturnType<typeof settledRow>>) => Promise<unknown>) => { try { for (const id of ids) await action(await settledRow(id)); } finally { await session.refresh(); } };
  const convert = async (note: StickyNote, selectedText?: string) => run(async () => {
    if (session.hasPending(note.id)) throw Error('Wait for the note to finish syncing before converting it.');
    if (!boardId || !listId) throw Error('Open a board before converting a note to a task.');
    const conversionKey = selectedText ? `${note.id}:selection:${selectedText}` : note.id;
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(conversionKey)));
    digest[6] = (digest[6] & 15) | 80; digest[8] = (digest[8] & 63) | 128;
    const hex = Array.from(digest.slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
    const id = selectedText ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` : note.id;
    const rows = await fetchTasks({ boardId, workspaceId: workspace?.id ?? null });
    const task = rows.find(row => row.id === id) ?? await createTask({ id, title: (selectedText ?? note.title).trim().slice(0, 500), description: selectedText ? '' : note.html, board_id: boardId, list_id: listId, workspace_id: workspace?.id, created_by: user.id, position: rows.filter(row => row.list_id === listId).length });
    if (!selectedText) await replaceTaskChecklistItems(task.id, note.checklist, workspace?.id ?? null);
    session.change(note.id, { taskId: task.id, taskBoardId: boardId, ...(!selectedText ? { convertedTaskId: task.id } : {}) });
    await session.flush(note.id);
  });
  const destination:NoteDestination={key:`${user.id}:${workspaceId??'personal'}`,async create(candidate,importKey){const saved=await saveConnectedNote(candidate,workspaceId,0,crypto.randomUUID(),user.id,importKey),content=saved.content as unknown as{html:string;checklist:StickyNote['checklist'];labels?:unknown};return{...candidate,id:saved.id,title:saved.title,html:content.html,checklist:content.checklist,labels:normalizeLabels(content.labels),revision:saved.revision,writeToken:saved.write_token};},async save(note,revision){await saveConnectedNote(note,workspaceId,revision,crypto.randomUUID(),user.id);},complete:note=>importNoteLayoutIfAbsent(note,user.id),media:id=>connectedNoteMedia(user.id,id,async()=>{})};
  const importSelected=(ids:string[],choices:ImportChoices)=>run(async()=>{
    let imported=0,reused=0;
    for(const id of ids){const source=bundle?.notes.find(note=>note.id===id)??deviceNotes.find(note=>note.id===id);if(!source)throw Error('An import source changed. Preview the selection again.');
      const sourceMedia=bundle?bundleNoteMedia(source as NotesBundle['notes'][number]):deviceNoteMedia(scope,id),key=bundle?`bundle:${bundle.id}:${id}:${workspaceId??'personal'}`:`device:${notesKey(scope)}:${id}`;
      const copied=await copyNote(source,sourceMedia,destination,key,choices);if(copied.existing)reused++;else imported++;
    }setTransferStatus(`Imported ${imported} private copies; reused ${reused} existing copies. Originals retained.`);setShowImport(false);setBundle(null);
  });
  const editorActions = (entry: ManagerEntry, close: () => void): DropdownMenuOption[] => {
    const row = snapshot.notes.find(item => item.row.id === entry.note.id), note = entry.note;
    if (!row) return [];
    return [
      { label: t('notes.sharingComments'), onClick: () => { close(); setSelected(row.row.id); } },
      ...(!entry.readOnly ? [{ label: note.convertedTaskId ? t('notes.convertedToTask') : t('notes.k.convert'), isDisabled: busy || !!note.convertedTaskId || !boardId || !note.title.trim() || session.hasPending(note.id), onClick: () => { void convert(note); } }] : []),
      ...(isTauri() ? [{ label: t('notes.quick.float'), onClick: () => openQuickNotes({ noteId: note.id, personal, float: true }) }] : []),
      ...(row.permission === 'manage' ? [{ label: t('notes.moveScope'), isDisabled: busy || session.hasPending(note.id), onClick: () => { close(); setMoveId(row.row.id); setClearMoveLink(false); } }] : []),
    ];
  };
  const button = 'min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:opacity-50';
  return <main id="main" className="p-4 sm:p-6">
    <NativeNotesControls userId={user.id}/>
    <input type="file" ref={importFile} accept="application/json,.json" aria-label={t('notes.chooseNotesBundle')} className="hidden" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;if(file.size>20*1024*1024){setError(t('notes.chooseANotesBundleUnder20'));return;}void file.text().then(text=>{setBundle(parseNotesBundle(text));setShowImport(true);setError('');}).catch(reason=>setError(String(reason)));}}/>
    {transferStatus&&<p role="status" className="mb-3 text-xs text-slate-600">{transferStatus}</p>}
    {(error || snapshot.error) && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error || snapshot.error}</p>}
    {discardKey && <section className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p>{t('notes.discardThisDeviceDraftTheServer')}</p><button type="button" className={`${button} mt-2`} onClick={() => { void session.discardDraft(discardKey).then(discarded => {if(discarded)setDiscardKey(null);}); }}>{t('notes.discardDraft')}</button><button type="button" className={`${button} ml-2`} onClick={() => setDiscardKey(null)}>{t('notes.keepDraft')}</button></section>}
    {showImport && <NoteImportPreview key={bundle?.id ?? "device"} notes={bundle?.notes ?? deviceNotes} destination={personal ? t('notes.scope.personal') : workspace?.name ?? "this workspace"} busy={busy} onImport={(ids,choices) => { void importSelected(ids,choices); }} onClose={() => {setShowImport(false);setBundle(null);}} />}
    {snapshot.drafts.length > 0 && <details className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><summary>{t('notes.deviceDrafts', { count: snapshot.drafts.length })}</summary><p className="my-2 text-xs text-slate-600">{t('notes.draftsStayWithThisAccountAnd')}</p><ul className="space-y-2">{snapshot.drafts.map(({ key, draft }) => <li key={key} className="flex flex-wrap items-center gap-2"><span className="mr-auto">{draft.note.title || t('notes.quick.untitled')}</span><button type="button" className={button} onClick={() => session.recover(key, false)}>{t('notes.resumeDraft')}</button>{canCreate && <button type="button" className={button} onClick={() => session.recover(key, true)}>{t('notes.saveSeparateCopy')}</button>}<button type="button" className={button} onClick={() => { const blob = new Blob([JSON.stringify(draft.note, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'note-draft.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>{t('notes.exportDraft')}</button><button type="button" className={button} onClick={() => setDiscardKey(key)}>{t('notes.discard')}</button></li>)}</ul></details>}
    <NotesManager
      heading={<div><h1 className="text-2xl font-semibold tracking-tight text-slate-950">{taskId ? t('task.taskNotes') : personal ? t('notes.scope.personal') : t('shell.notes')}</h1><p className="mt-1 text-sm leading-6 text-slate-600">{personal ? t('notes.privateNotesForThisAccount') : t('notes.onlyYouCanSeeNewNotes')}</p></div>}
      toolbar={<><button type="button" className={button} onClick={() => { void session.refresh(); session.retry(); }}>{t('notes.refresh')}</button>
        {canCreate&&<button type="button" disabled={busy} className={button} onClick={()=>importFile.current?.click()}>{t('notes.importNotesBundle')}</button>}
        {canCreate && <button type="button" className={button} onClick={() => { void readDurableDeviceNotes(scope).then(notes=>{setDeviceNotes(notes);setBundle(null);setShowImport(value=>!value);}).catch(reason=>setError(String(reason))); }}>{t('notes.importFromThisDevice')}</button>}</>}
      saveError={error || snapshot.error} requestedOpenId={noteId} onRequestedOpenHandled={onNoteHandled} entries={entries} loading={snapshot.loading} status={snapshot.loading ? t('notes.quick.loading') : snapshot.status}
      filter={view.filter} label={view.label} onNavigate={onNavigate ?? setLocalView}
      canCreate={canCreate} onCreate={patch => session.create({ ...patch, ...(taskId ? { taskId, taskBoardId: boardId } : {}) })}
      onChange={(id, patch) => session.change(id, patch)}
      onArchive={(ids, archived) => rowAction(ids, row => setNoteArchived(row, archived, user.id))}
      onTrash={ids => rowAction(ids, row => setNoteDeleted(row, true, user.id))}
      onRestore={ids => rowAction(ids, row => setNoteDeleted(row, false, user.id))}
      onExport={async ids => { const fresh = await fetchConnectedNotes(user, workspaceId, workspace?.role), chosen = fresh.filter(entry => ids.includes(entry.note.id) && !entry.row.deleted_at); if (chosen.length !== ids.length) throw Error('A selected note is no longer available. Refresh the selection.'); downloadNotesFile(await exportNotes(chosen.map(entry => entry.note), id => connectedNoteMedia(user.id, id, async () => {}), { clearTaskLinks: false, omitUnavailableImages: false }), 'kora-notes.json'); }}
      createMedia={id => connectedNoteMedia(user.id, id, async () => { await session.flush(id); if (session.hasPending(id)) throw Error('Save this note before adding an image. Your draft is retained.'); })}
      editorActions={editorActions} tasks={tasks} boardId={boardId}
      onOpenTask={note => { if (note.taskId && note.taskBoardId) onOpenTask(note.taskId, note.taskBoardId); }} />
    {moveId&&<section aria-label={t('notes.moveNoteScope')} className="fixed inset-x-4 top-20 z-[70] mx-auto max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-sm shadow-xl"><p className="font-semibold">{t('notes.moveThisNoteToAnotherPermitted')}</p><p className="text-xs leading-5 text-slate-600">{t('notes.theNoteKeepsItsIdentityAnd')}</p><label className="block">{t('notes.destination')}<select aria-label={t('notes.moveNoteDestination')} value={moveDestination} onChange={event=>setMoveDestination(event.target.value)} className="mt-1 min-h-10 w-full rounded border border-slate-200 px-2"><option value="personal">{t('notes.scope.personal')}</option>{destinations.filter(row=>row.role!=='viewer').map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="flex gap-2"><input type="checkbox" checked={clearMoveLink} onChange={event=>setClearMoveLink(event.target.checked)}/>{t('notes.removeTheTaskLinkIfIncompatible')}</label><button type="button" disabled={busy} className={button} onClick={()=>void run(async()=>{const entry=snapshot.notes.find(row=>row.row.id===moveId);if(!entry)throw Error('The note is unavailable.');await moveConnectedNote(entry.row,moveDestination==='personal'?null:moveDestination,clearMoveLink,user.id);setMoveId(null);})}>{t('notes.moveAsPrivateNote')}</button><button type="button" disabled={busy} className={`${button} ml-2`} onClick={()=>setMoveId(null)}>{t('settings.cancel')}</button></section>}
    {selectedEntry && <NoteCollaboration key={selectedEntry.row.id} entry={selectedEntry} user={user} members={members} pending={session.hasPending(selectedEntry.row.id)} onClose={() => setSelected(null)} onRefresh={() => session.refresh()} />}
  </main>;
}
