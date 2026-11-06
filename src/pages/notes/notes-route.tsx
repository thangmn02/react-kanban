import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';
import { NOTES_PREVIEW_ENABLED } from '../../constants/features';
import { useI18n } from '../../i18n';
import { newNote, notesKey, readDurableDeviceNotes, saveNoteSafely, type StickyNote } from '../../features/notes/notes-store';
import StickyNoteCard from '../../features/notes/sticky-note';
import ConnectedNotesWorkspace from '../../features/notes/connected-notes-workspace';
import { createTask, fetchTasks } from '../../services/task.service';
import { replaceTaskChecklistItems } from '../../services/checklist.service';
import { isTauri } from '@tauri-apps/api/core';
import { detachNote } from '../../features/notes/native-notes-events';
import NativeNotesControls from '../../features/notes/native-notes-controls';
import { deviceNotesRepository } from '../../features/notes/device-notes-session';
import {stripTaskHtml} from '../../utils/taskCollections';
import {deviceNoteMedia} from '../../features/notes/note-media';
import {openQuickNotes} from '../../features/notes/quick-notes-events';
import NoteImportPreview from '../../features/notes/note-import-preview';
import {bundleNoteMedia,copyNote,downloadNotesFile,exportNotes,parseNotesBundle,transferIdentity,type NotesBundle,type ImportChoices,type NoteDestination} from '../../features/notes/note-transfer';

export default function NotesRoute() {
  const context = useAppLayoutRouteContext();
  const { currentUser, activeWorkspace } = context.today;
  const location = useLocation(), navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const personal = query.get('scope') === 'personal';
  if (!NOTES_PREVIEW_ENABLED) return <p className="p-6">Notes is not enabled for this environment.</p>;
  if (!currentUser.isMock) return <div className="min-h-screen bg-white">{context.header}
    <ConnectedNotesWorkspace key={`${currentUser.id}:${activeWorkspace?.id}:${activeWorkspace?.role}:${personal}`} user={currentUser} workspace={activeWorkspace} members={context.members.members} personal={personal} filter={query.get('filter') ?? 'all'} boardId={context.board.header.activeBoardId} listId={context.board.kanban.boardData.columns[0] ?? null} tasks={Object.values(context.board.kanban.boardData.task)} createOnOpen={query.get('new') === '1'} onCreated={() => { query.delete('new'); navigate(`/notes?${query}`, { replace: true }); }} onOpenTask={(taskId, boardId) => { query.set('task', taskId); query.set('taskBoard', boardId); navigate(`/notes?${query}`); }} />
  </div>;
  // Workspace / Personal and Trash live in the context sidebar, the single Notes navigation.
  // Key the local persistence owner by account/workspace, never the Focus owner.
  return <div className="min-h-screen bg-white">{context.header}<NotesWorkspace personal={personal} key={`${currentUser.id}:${activeWorkspace?.id}:${personal}`} /></div>;
}
function NotesWorkspace({personal}:{personal:boolean}) {
  const context = useAppLayoutRouteContext(), { t } = useI18n();
  const { currentUser, activeWorkspace } = context.today;
  const scope = { userId: currentUser.id, workspaceId: personal?null:activeWorkspace?.id ?? null };
  const [repository]=useState(()=>deviceNotesRepository(scope)),session=repository.session;
  const {notes,error,status,drafts}=useSyncExternalStore(session.subscribe,session.getSnapshot);
  const [actionError,setActionError]=useState('');
  const [search,setSearch]=useState(''),[selected,setSelected]=useState<string[]>([]),[bundle,setBundle]=useState<NotesBundle|null>(null),[busy,setBusy]=useState(false),[transferStatus,setTransferStatus]=useState('');
  const importFile=useRef<HTMLInputElement>(null);
  const setError=(value:string)=>setActionError(value);
  useEffect(()=>repository.acquire(),[repository]);
  const location = useLocation(), navigate = useNavigate();
  const filter = new URLSearchParams(location.search).get('filter') || 'all';
  const key = notesKey(scope);
  const persist=session.save;
  const change=(id:string,patch:Partial<StickyNote>)=>{void session.change(id,patch).catch(reason=>setActionError(String(reason)));};
  const boardId = context.board.header.activeBoardId;
  const data = context.board.kanban.boardData;
  const visible = notes.filter(note=>(filter==='trash'?!!note.deletedAt:!note.deletedAt)&&(filter==='shared'?false:filter==='pinned'?note.pinned:true)&&`${note.title} ${stripTaskHtml(note.html)} ${note.checklist.map(item=>item.text).join(' ')}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>filter==='recent'?b.updatedAt.localeCompare(a.updatedAt):Number(b.pinned)-Number(a.pinned));
  const run=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await action();}catch(reason){setError(String(reason));}finally{setBusy(false);}};
  const importSelected=async(ids:string[],choices:ImportChoices)=>run(async()=>{if(!bundle)return;const destination:NoteDestination={key:notesKey(scope),async create(candidate,importKey){const id=await transferIdentity(importKey),rows=await readDurableDeviceNotes(scope),existing=rows.find(row=>row.id===id);if(existing)return existing;const saved=await saveNoteSafely(scope,{...candidate,id});return saved.find(row=>row.id===id)!;},async save(note,revision,token){await saveNoteSafely(scope,note,revision,token);},media:id=>deviceNoteMedia(scope,id)};let count=0;for(const id of ids){const source=bundle.notes.find(row=>row.id===id);if(!source)throw Error('The import selection changed. Preview it again.');await copyNote(source,bundleNoteMedia(source),destination,`device-bundle:${notesKey(scope)}:${bundle.id}:${id}`,choices);count++;}setBundle(null);setTransferStatus(`Imported or reopened ${count} selected private copies. The original file was retained.`);});
  if (!NOTES_PREVIEW_ENABLED) return <p className="p-6">Notes preview is not enabled.</p>;
  return <main id="main" className="p-4 sm:p-6">
    <NativeNotesControls userId={currentUser.id}/>
    {drafts.length>0&&<details className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><summary>{t('notes.drafts',{count:drafts.length})}</summary><ul className="mt-2 space-y-2">{drafts.map(draft=><li key={draft.key} className="flex flex-wrap items-center gap-2"><span className="mr-auto">{draft.note.title||t('notes.quick.untitled')}</span><button type="button" className="min-h-9 rounded border bg-white px-3" onClick={()=>{void session.retry(draft.note.id,draft.key).catch(reason=>setError(String(reason)));}}>{t('notes.retrySave')}</button><button type="button" className="min-h-9 rounded border bg-white px-3" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(draft.note,null,2)],{type:'application/json'})),anchor=document.createElement('a');anchor.href=url;anchor.download='kora-device-draft.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>{t('notes.exportDraft')}</button></li>)}</ul></details>}
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight text-slate-950">{t(personal ? 'notes.scope.personal' : 'shell.notes')}</h1></div><button type="button" onClick={() => persist({...newNote(notes.length),pinned:filter === "pinned"})} className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">{t('notes.new')}</button></div>
    <p role="status" className="mb-2 text-xs text-slate-500">{status}</p>{(error || actionError) && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error || actionError}</p>}
    <div className="mb-3 flex flex-wrap gap-2"><input type="search" aria-label={t('notes.search')} value={search} onChange={event=>setSearch(event.target.value)} placeholder={t('notes.search')} className="min-h-10 flex-1 rounded-lg border px-3 text-sm"/><input ref={importFile} type="file" accept="application/json,.json" aria-label={t('notes.import')} className="hidden" onChange={event=>{const file=event.target.files?.[0];if(file)void file.text().then(text=>setBundle(parseNotesBundle(text))).catch(reason=>setError(String(reason)));event.target.value='';}}/><button type="button" className="min-h-10 rounded-lg border px-3 text-sm" onClick={()=>importFile.current?.click()}>{t('notes.import')}</button></div>
    {transferStatus&&<p role="status" className="mb-3 text-sm text-slate-600">{transferStatus}</p>}
    {bundle&&<NoteImportPreview key={bundle.id} notes={bundle.notes} destination={personal?t('notes.scope.personal'):activeWorkspace?.name??t('notes.thisDevice')} busy={busy} onImport={(ids,choices)=>{void importSelected(ids,choices);}} onClose={()=>setBundle(null)}/>}
    {filter==='trash'?<ul className="space-y-2">{visible.map(note=><li key={note.id} className="flex items-center justify-between rounded-xl border p-3"><span>{note.title||t('notes.quick.untitled')}</span><button type="button" className="min-h-10 rounded border px-3 text-sm" onClick={()=>change(note.id,{deletedAt:null})}>{t('notes.restore')}</button></li>)}</ul>:null}
    {filter==='trash'?null:filter === 'shared' ? <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">Shared notes are not available in this device-only preview. Your notes stay private on this device.</p> : <>
      {visible.length ? <p className="mb-4 text-xs leading-5 text-slate-500">{t('notes.moveHint')}</p>
        : <p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">{t(filter === 'pinned' ? 'notes.emptyPinned' : 'notes.empty')}</p>}
      <div data-notes-canvas className="pointer-events-none relative min-h-96 max-w-full md:overflow-x-auto" style={{ minHeight: Math.max(500, ...visible.map(note => note.y + (note.minimized ? 100 : note.height) + 40)), minWidth: 0 }}>
        {visible.map(note => <StickyNoteCard key={note.id} note={note} onHide={() => change(note.id,{hidden:true})} onDetach={isTauri() ? () => detachNote({userId:currentUser.id,workspaceId:scope.workspaceId,noteId:note.id,local:true}) : undefined} assetScope={scope} boardId={boardId} tasks={Object.values(data.task)} onChange={patch => change(note.id, patch)} onOpenTask={() => { if (note.taskId && note.taskBoardId) navigate(`/notes?task=${note.taskId}&taskBoard=${note.taskBoardId}`); }} onConvert={async () => {
          const convert = async () => {
            const latest = (await readDurableDeviceNotes(scope)).find(row => row.id === note.id);
            if (!latest || latest.convertedTaskId || !boardId || !data.columns[0]) return;
            const rows = await fetchTasks({ boardId, workspaceId: scope.workspaceId });
            const task = rows.find(row => row.id === latest.id) ?? await createTask({ id: latest.id, title: latest.title.trim(), description: latest.html, board_id: boardId, list_id: data.columns[0], workspace_id: scope.workspaceId ?? undefined, created_by: currentUser.id, position: rows.filter(row => row.list_id === data.columns[0]).length });
            await replaceTaskChecklistItems(task.id, latest.checklist, scope.workspaceId);
            if (!await persist({ ...latest, taskId: task.id, taskBoardId: boardId, convertedTaskId: task.id }, latest.revision)) return;
          };
          try { if (session.isSaving()) throw Error('Wait for the note to finish saving, then convert it.'); if (!currentUser.isMock) throw Error('Task conversion in this preview requires local demo mode.'); if (navigator.locks) await navigator.locks.request(`kora:note-conversion:${key}:${note.id}`, convert); else throw Error('Safe conversion requires a browser with Web Locks.'); }
          catch (reason) { setError(reason instanceof Error ? reason.message : 'Conversion failed. The note is retained for retry.'); }
        }} />)}
      </div>
      {!!visible.length&&<details className="mt-4 rounded-xl border p-3 text-sm"><summary>{t('notes.manage')}</summary><button type="button" disabled={busy||!selected.length} className="my-3 min-h-10 rounded-lg border px-3 disabled:opacity-50" onClick={()=>{void run(async()=>{const rows=(await readDurableDeviceNotes(scope)).filter(row=>selected.includes(row.id)&&!row.deletedAt);if(rows.length!==selected.length)throw Error('A selected original changed. Review the selection.');downloadNotesFile(await exportNotes(rows,id=>deviceNoteMedia(scope,id),{clearTaskLinks:false,omitUnavailableImages:false}),'kora-device-notes.json');});}}>{t('notes.exportSelected',{count:selected.length})}</button><ul className="space-y-2">{visible.map(note=><li key={note.id} className="flex flex-wrap items-center gap-2"><label className="mr-auto flex gap-2"><input type="checkbox" aria-label={`Select ${note.title||t('notes.quick.untitled')} for export`} checked={selected.includes(note.id)} onChange={event=>setSelected(rows=>event.target.checked?[...rows,note.id]:rows.filter(id=>id!==note.id))}/>{note.title||t('notes.quick.untitled')}</label><button type="button" className="min-h-9 rounded border px-3" onClick={()=>openQuickNotes({noteId:note.id,personal})}>{t('notes.open')}</button>{(note.hidden||note.collapsed||note.clickThrough||note.peek)&&<button type="button" className="min-h-9 rounded border px-3" onClick={()=>change(note.id,{hidden:false,collapsed:false,clickThrough:false,peek:false})}>{t('notes.show')}</button>}<button type="button" className="min-h-9 rounded border px-3" onClick={()=>change(note.id,{deletedAt:new Date().toISOString()})}>{t('notes.moveToTrash')}</button></li>)}</ul></details>}
    </>}
  </main>;
}
