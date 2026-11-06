import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { AppUser, WorkspaceMember, WorkspaceSummary } from '../../types/auth.type';
import type { ITaskItem } from '../../types/task.type';
import { connectedNotesRepository } from './notes-repository';
import StickyNoteCard from './sticky-note';
import NoteCollaboration from './note-collaboration';
import { notesKey, readDurableDeviceNotes, type StickyNote } from './notes-store';
import { fetchConnectedNotes, importNoteLayoutIfAbsent, saveConnectedNote, setNoteDeleted, moveConnectedNote } from '../../services/notes.service';
import { createTask, fetchTasks } from '../../services/task.service';
import { replaceTaskChecklistItems } from '../../services/checklist.service';
import { stripTaskHtml } from '../../utils/taskCollections';
import { isTauri } from '@tauri-apps/api/core';
import { detachNote } from './native-notes-events';
import NativeNotesControls from './native-notes-controls';
import NoteImportPreview from './note-import-preview';
import { copyNote, exportNotes, parseNotesBundle, bundleNoteMedia, downloadNotesFile, type NotesBundle, type NoteDestination, type ImportChoices } from './note-transfer';
import { connectedNoteMedia } from './connected-note-media';
import { deviceNoteMedia } from './note-media';
import { fetchUserWorkspaces } from '../../services/workspace.service';
import { useI18n } from '../../i18n';

export interface ConnectedNotesWorkspaceProps {
  user: AppUser; workspace: WorkspaceSummary | null; members: WorkspaceMember[];
  personal?: boolean; filter?: string; boardId: string | null; listId: string | null; tasks: ITaskItem[];
  taskId?: string; onOpenTask: (taskId: string, boardId: string) => void;
  createOnOpen?: boolean; onCreated?: () => void;
}
export default function ConnectedNotesWorkspace({ user, workspace, members, personal = false, filter = 'all', boardId, listId, tasks, taskId, onOpenTask, createOnOpen, onCreated }: ConnectedNotesWorkspaceProps) {
  const { t } = useI18n();
  const workspaceId = personal ? null : workspace?.id ?? null;
  const [repository] = useState(() => connectedNotesRepository(user, workspaceId, workspace?.role));
  const session = repository.session;
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [search, setSearch] = useState(''), [selected, setSelected] = useState<string | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [showImport, setShowImport] = useState(false);
  const [discardKey, setDiscardKey] = useState<string | null>(null);
  const [deviceNotes,setDeviceNotes]=useState<StickyNote[]>([]),[bundle,setBundle]=useState<NotesBundle|null>(null),[exportIds,setExportIds]=useState<string[]>([]),[transferStatus,setTransferStatus]=useState(''),[omitUnavailable,setOmitUnavailable]=useState(false),[moveId,setMoveId]=useState<string|null>(null),[clearMoveLink,setClearMoveLink]=useState(false);
  const importFile=useRef<HTMLInputElement>(null);
  const [destinations,setDestinations]=useState<WorkspaceSummary[]>([]),[moveDestination,setMoveDestination]=useState('personal');
  useEffect(() => repository.acquire(), [repository]);
  useEffect(()=>{let active=true;void fetchUserWorkspaces(user).then(rows=>{if(active)setDestinations(rows);}).catch(()=>{});return()=>{active=false;};},[user]);
  const scope = { userId: user.id, workspaceId: workspace?.id ?? null };
  const canCreate = personal || !!workspace && workspace.role !== 'viewer';
  const createdOnOpen = useRef(false);
  useEffect(() => { if (createOnOpen && !snapshot.loading && canCreate && !createdOnOpen.current) { createdOnOpen.current = true; session.create(); onCreated?.(); } }, [createOnOpen, snapshot.loading, canCreate, session, onCreated]);
  const active = snapshot.notes.filter(entry => filter === 'trash' ? !!entry.row.deleted_at : !entry.row.deleted_at);
  const visible = active.filter(entry => (!taskId || entry.note.taskId === taskId) && (filter !== 'pinned' || entry.note.pinned) && (filter !== 'shared' || entry.row.visibility === 'workspace' || entry.row.owner_user_id !== user.id) && `${entry.note.title} ${stripTaskHtml(entry.note.html)} ${entry.note.checklist.map(item => item.text).join(' ')}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => filter === 'recent' ? b.note.updatedAt.localeCompare(a.note.updatedAt) : Number(b.note.pinned) - Number(a.note.pinned));
  const selectedEntry = snapshot.notes.find(entry => entry.row.id === selected && !entry.row.deleted_at);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(''); try { await action(); await session.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Notes could not save this change.'); } finally { setBusy(false); }
  };
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
  const destination:NoteDestination={key:`${user.id}:${workspaceId??'personal'}`,async create(candidate,importKey){const saved=await saveConnectedNote(candidate,workspaceId,0,crypto.randomUUID(),user.id,importKey),content=saved.content as unknown as{html:string;checklist:StickyNote['checklist']};return{...candidate,id:saved.id,title:saved.title,html:content.html,checklist:content.checklist,revision:saved.revision,writeToken:saved.write_token};},async save(note,revision){await saveConnectedNote(note,workspaceId,revision,crypto.randomUUID(),user.id);},complete:note=>importNoteLayoutIfAbsent(note,user.id),media:id=>connectedNoteMedia(user.id,id,async()=>{})};
  const importSelected=(ids:string[],choices:ImportChoices)=>run(async()=>{
    let imported=0,reused=0;
    for(const id of ids){const source=bundle?.notes.find(note=>note.id===id)??deviceNotes.find(note=>note.id===id);if(!source)throw Error('An import source changed. Preview the selection again.');
      const sourceMedia=bundle?bundleNoteMedia(source as NotesBundle['notes'][number]):deviceNoteMedia(scope,id),key=bundle?`bundle:${bundle.id}:${id}:${workspaceId??'personal'}`:`device:${notesKey(scope)}:${id}`;
      const copied=await copyNote(source,sourceMedia,destination,key,choices);if(copied.existing)reused++;else imported++;
    }setTransferStatus(`Imported ${imported} private copies; reused ${reused} existing copies. Originals retained.`);setShowImport(false);setBundle(null);
  });
  const button = 'min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:opacity-50';
  return <main id="main" className="p-4 sm:p-6" aria-busy={snapshot.loading}>
    <NativeNotesControls userId={user.id}/>
    <input type="file" ref={importFile} accept="application/json,.json" aria-label={t('notes.chooseNotesBundle')} className="hidden" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;if(file.size>20*1024*1024){setError(t('notes.chooseANotesBundleUnder20'));return;}void file.text().then(text=>{setBundle(parseNotesBundle(text));setShowImport(true);setError('');}).catch(reason=>setError(String(reason)));}}/>
    {canCreate&&<button type="button" disabled={busy} className={`${button} mb-3`} onClick={()=>importFile.current?.click()}>{t('notes.importNotesBundle')}</button>}
    {transferStatus&&<p role="status" className="mb-3 text-xs text-slate-600">{transferStatus}</p>}
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight text-slate-950">{taskId ? t('task.taskNotes') : personal ? t('notes.scope.personal') : 'Notes'}</h1><p className="mt-1 text-sm leading-6 text-slate-600">{personal ? t('notes.privateNotesForThisAccount') : t('notes.onlyYouCanSeeNewNotes')}</p></div>{canCreate && filter !== 'trash' && <button type="button" disabled={snapshot.loading || busy} className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50" onClick={() => session.create({...(taskId ? {taskId,taskBoardId:boardId}:{}),pinned:filter === "pinned"})}>{t('notes.new')}</button>}</header>
    <div className="mb-3 flex flex-wrap gap-2"><input type="search" aria-label={t('notes.search')} placeholder={t('notes.search')} value={search} onChange={event => setSearch(event.target.value)} className="min-h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm" /><button type="button" className={button} onClick={() => { void session.refresh(); session.retry(); }}>{t('notes.refresh')}</button>{canCreate && <button type="button" className={button} onClick={() => { void readDurableDeviceNotes(scope).then(notes=>{setDeviceNotes(notes);setBundle(null);setShowImport(value=>!value);}).catch(reason=>setError(String(reason))); }}>{t('notes.importFromThisDevice')}</button>}</div>
    <p role="status" className="mb-2 text-xs text-slate-600">{snapshot.loading ? t('notes.quick.loading') : snapshot.status}</p>
    {(error || snapshot.error) && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error || snapshot.error}</p>}
    {discardKey && <section className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p>{t('notes.discardThisDeviceDraftTheServer')}</p><button type="button" className={`${button} mt-2`} onClick={() => { void session.discardDraft(discardKey).then(discarded => {if(discarded)setDiscardKey(null);}); }}>{t('notes.discardDraft')}</button><button type="button" className={`${button} ml-2`} onClick={() => setDiscardKey(null)}>{t('notes.keepDraft')}</button></section>}
    {showImport && <NoteImportPreview key={bundle?.id ?? "device"} notes={bundle?.notes ?? deviceNotes} destination={personal ? t('notes.scope.personal') : workspace?.name ?? "this workspace"} busy={busy} onImport={(ids,choices) => { void importSelected(ids,choices); }} onClose={() => {setShowImport(false);setBundle(null);}} />}
    {snapshot.drafts.length > 0 && <details className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><summary>{t('notes.deviceDrafts', { count: snapshot.drafts.length })}</summary><p className="my-2 text-xs text-slate-600">{t('notes.draftsStayWithThisAccountAnd')}</p><ul className="space-y-2">{snapshot.drafts.map(({ key, draft }) => <li key={key} className="flex flex-wrap items-center gap-2"><span className="mr-auto">{draft.note.title || 'Untitled note'}</span><button type="button" className={button} onClick={() => session.recover(key, false)}>{t('notes.resumeDraft')}</button>{canCreate && <button type="button" className={button} onClick={() => session.recover(key, true)}>{t('notes.saveSeparateCopy')}</button>}<button type="button" className={button} onClick={() => { const blob = new Blob([JSON.stringify(draft.note, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'note-draft.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>{t('notes.exportDraft')}</button><button type="button" className={button} onClick={() => setDiscardKey(key)}>{t('notes.discard')}</button></li>)}</ul></details>}
    {!snapshot.loading && !visible.length && <p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-600">{filter === 'trash' ? t('notes.trashIsEmpty') : t('notes.noNotesMatchThisView')}</p>}
    {filter === 'trash' ? <ul className="space-y-2">{visible.map(entry => <li key={entry.row.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><span>{entry.note.title || 'Untitled note'}</span><button type="button" disabled={busy} className={button} onClick={() => void run(async () => { await setNoteDeleted(entry.row, false, user.id); })}>{t('notes.restore')}</button></li>)}</ul> : <>
      <p className="mb-3 text-xs leading-5 text-slate-600">{t('notes.dragToMoveShakeSidewaysTo')}</p>
      <div data-notes-canvas className="pointer-events-none relative min-h-96 max-w-full md:overflow-x-auto" style={{ minHeight: Math.max(500, ...visible.map(({ note }) => note.y + (note.minimized ? 100 : note.height) + 40)) }}>
        {visible.map(entry => <StickyNoteCard key={entry.row.id} note={entry.note} onHide={() => session.change(entry.note.id,{hidden:true})} onDetach={isTauri() ? () => detachNote({ userId:user.id,workspaceId,noteId:entry.note.id,local:false }) : undefined} connectedMedia={{ userId: user.id, ensureSaved: async () => { await session.flush(entry.note.id); if (session.hasPending(entry.note.id)) throw Error("Save this note before adding an image. Your draft is retained."); } }} ownerLabel={entry.row.owner_user_id === user.id ? t('notes.you') : members.find(member => member.userId === entry.row.owner_user_id)?.name ?? 'Workspace member'} readOnly={!['edit', 'manage'].includes(entry.permission) || snapshot.conflicts.includes(entry.row.id) || session.isDiscarding(entry.note.id)} tasks={tasks} boardId={boardId} onChange={patch => session.change(entry.note.id, patch)} onOpenTask={() => { if (entry.note.taskId && entry.note.taskBoardId) onOpenTask(entry.note.taskId, entry.note.taskBoardId); }} conversionPending={busy || session.hasPending(entry.note.id)} onConvert={() => convert(entry.note)} onConvertSelection={text => { void convert(entry.note, text); }} onDetails={() => setSelected(entry.row.id)} />)}
      </div>
      {active.length>0&&<details className="mt-4 rounded-xl border border-slate-200 p-3 text-sm"><summary>{t('notes.manage')}</summary>
        <p className="my-2 text-xs text-slate-600">{t('notes.unencryptedExportsContainSensitiveNoteText')}</p>
        <label className="mb-2 flex gap-2 text-xs"><input type="checkbox" checked={omitUnavailable} onChange={event=>setOmitUnavailable(event.target.checked)}/>{t('notes.omitImagesThatCannotBeRead')}</label>
        <button type="button" disabled={busy||!exportIds.length} className={button} onClick={()=>void run(async()=>{const fresh=await fetchConnectedNotes(user,workspaceId,workspace?.role),selected=fresh.filter(entry=>exportIds.includes(entry.note.id)&&!entry.row.deleted_at);if(selected.length!==exportIds.length)throw Error('A selected note is no longer available. Refresh the selection.');downloadNotesFile(await exportNotes(selected.map(entry=>entry.note),id=>connectedNoteMedia(user.id,id,async()=>{}),{clearTaskLinks:false,omitUnavailableImages:omitUnavailable}),'kora-notes.json');})}>{t('notes.export')}{' '}{exportIds.length}{' '}{t('notes.selectedNotes')}</button>
        <ul className="mt-3 space-y-2">{active.map(entry=><li key={entry.row.id} className="flex flex-wrap items-center gap-2"><label className="mr-auto flex min-w-0 items-center gap-2"><input type="checkbox" checked={exportIds.includes(entry.row.id)} onChange={event=>setExportIds(current=>event.target.checked?[...current,entry.row.id]:current.filter(id=>id!==entry.row.id))}/><span className="truncate">{entry.note.title||'Untitled note'}</span></label>
          {(entry.note.hidden||entry.note.collapsed||entry.note.clickThrough||entry.note.peek)&&<button type="button" className={button} onClick={()=>session.change(entry.note.id,{hidden:false,collapsed:false,clickThrough:false,peek:false})}>{t('notes.show')}</button>}
          {entry.permission==='manage'&&<><button type="button" disabled={busy||session.hasPending(entry.row.id)} className={button} onClick={()=>{setMoveId(entry.row.id);setClearMoveLink(false);}}>{t('notes.moveScope')}</button><button type="button" disabled={busy||session.hasPending(entry.row.id)} className={button} onClick={()=>void run(async()=>{await setNoteDeleted(entry.row,true,user.id);})}>{t('notes.moveToTrash')}</button></>}
        </li>)}</ul>
      </details>}
    </>}
    {moveId&&<section aria-label={t('notes.moveNoteScope')} className="fixed inset-x-4 top-20 z-[70] mx-auto max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-sm shadow-xl"><p className="font-semibold">{t('notes.moveThisNoteToAnotherPermitted')}</p><p className="text-xs leading-5 text-slate-600">{t('notes.theNoteKeepsItsIdentityAnd')}</p><label className="block">{t('notes.destination')}<select aria-label={t('notes.moveNoteDestination')} value={moveDestination} onChange={event=>setMoveDestination(event.target.value)} className="mt-1 min-h-10 w-full rounded border border-slate-200 px-2"><option value="personal">{t('notes.scope.personal')}</option>{destinations.filter(row=>row.role!=='viewer').map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="flex gap-2"><input type="checkbox" checked={clearMoveLink} onChange={event=>setClearMoveLink(event.target.checked)}/>{t('notes.removeTheTaskLinkIfIncompatible')}</label><button type="button" disabled={busy} className={button} onClick={()=>void run(async()=>{const entry=snapshot.notes.find(row=>row.row.id===moveId);if(!entry)throw Error('The note is unavailable.');await moveConnectedNote(entry.row,moveDestination==='personal'?null:moveDestination,clearMoveLink,user.id);setMoveId(null);})}>{t('notes.moveAsPrivateNote')}</button><button type="button" disabled={busy} className={`${button} ml-2`} onClick={()=>setMoveId(null)}>{t('settings.cancel')}</button></section>}
    {selectedEntry && <NoteCollaboration key={selectedEntry.row.id} entry={selectedEntry} user={user} members={members} pending={session.hasPending(selectedEntry.row.id)} onClose={() => setSelected(null)} onRefresh={() => session.refresh()} />}
  </main>;
}
