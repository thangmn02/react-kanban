import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';
import { NOTES_PREVIEW_ENABLED } from '../../constants/features';
import { useI18n } from '../../i18n';
import { notesKey, readDurableDeviceNotes, saveNoteSafely, type StickyNote } from '../../features/notes/notes-store';
import NotesManager from '../../features/notes/notes-manager';
import {asManagerFilter,type ManagerEntry} from '../../features/notes/notes-manager-model';
import type {DropdownMenuOption} from '@astryxdesign/core/DropdownMenu';
import ConnectedNotesWorkspace from '../../features/notes/connected-notes-workspace';
import { createTask, fetchTasks } from '../../services/task.service';
import { replaceTaskChecklistItems } from '../../services/checklist.service';
import { isTauri } from '@tauri-apps/api/core';
import { openQuickNotes } from '../../features/notes/quick-notes-events';
import NativeNotesControls from '../../features/notes/native-notes-controls';
import { deviceNotesRepository } from '../../features/notes/device-notes-session';
import {deviceNoteMedia} from '../../features/notes/note-media';
import NoteImportPreview from '../../features/notes/note-import-preview';
import {bundleNoteMedia,copyNote,downloadNotesFile,exportNotes,parseNotesBundle,transferIdentity,type NotesBundle,type ImportChoices,type NoteDestination} from '../../features/notes/note-transfer';

export default function NotesRoute() {
  const { t } = useI18n();
  const context = useAppLayoutRouteContext();
  const { currentUser, activeWorkspace } = context.today;
  const location = useLocation(), navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const personal = query.get('scope') === 'personal';
  if (!NOTES_PREVIEW_ENABLED) return <p className="p-6">{t('notes.notesIsNotEnabledForThis')}</p>;
  if (!currentUser.isMock) return <div className="min-h-screen bg-white">{context.header}
    <ConnectedNotesWorkspace key={`${currentUser.id}:${activeWorkspace?.id}:${activeWorkspace?.role}:${personal}`} user={currentUser} workspace={activeWorkspace} members={context.members.members} personal={personal} filter={query.get('filter') ?? 'all'} label={query.get('label')} noteId={query.get('note')} onNoteHandled={() => { query.delete('note'); navigate(`/notes?${query}`, { replace: true }); }} onNavigate={next => { if (next.filter === 'all') query.delete('filter'); else query.set('filter', next.filter); if (next.label) query.set('label', next.label); else query.delete('label'); navigate(`/notes?${query}`); }} boardId={context.board.header.activeBoardId} listId={context.board.kanban.boardData.columns[0] ?? null} tasks={Object.values(context.board.kanban.boardData.task)} createOnOpen={query.get('new') === '1'} onCreated={() => { query.delete('new'); navigate(`/notes?${query}`, { replace: true }); }} onOpenTask={(taskId, boardId) => { query.set('task', taskId); query.set('taskBoard', boardId); navigate(`/notes?${query}`); }} />
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
  const [bundle,setBundle]=useState<NotesBundle|null>(null),[busy,setBusy]=useState(false),[transferStatus,setTransferStatus]=useState('');
  const importFile=useRef<HTMLInputElement>(null);
  const setError=(value:string)=>setActionError(value);
  useEffect(()=>repository.acquire(),[repository]);
  const location = useLocation(), navigate = useNavigate();
  const params = new URLSearchParams(location.search), filter = asManagerFilter(params.get('filter')), label = params.get('label');
  const key = notesKey(scope);
  const persist=session.save;
  const change=(id:string,patch:Partial<StickyNote>)=>{void session.change(id,patch).catch(reason=>setActionError(String(reason)));};
  const changeAll=async(ids:string[],patch:Partial<StickyNote>)=>{for(const id of ids)await session.change(id,patch);};
  const boardId = context.board.header.activeBoardId;
  const data = context.board.kanban.boardData;
  const tasks = Object.values(data.task);
  const run=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await action();}catch(reason){setError(String(reason));}finally{setBusy(false);}};
  const importSelected=async(ids:string[],choices:ImportChoices)=>run(async()=>{if(!bundle)return;const destination:NoteDestination={key:notesKey(scope),async create(candidate,importKey){const id=await transferIdentity(importKey),rows=await readDurableDeviceNotes(scope),existing=rows.find(row=>row.id===id);if(existing)return existing;const saved=await saveNoteSafely(scope,{...candidate,id});return saved.find(row=>row.id===id)!;},async save(note,revision,token){await saveNoteSafely(scope,note,revision,token);},media:id=>deviceNoteMedia(scope,id)};let count=0;for(const id of ids){const source=bundle.notes.find(row=>row.id===id);if(!source)throw Error('The import selection changed. Preview it again.');await copyNote(source,bundleNoteMedia(source),destination,`device-bundle:${notesKey(scope)}:${bundle.id}:${id}`,choices);count++;}setBundle(null);setTransferStatus(`Imported or reopened ${count} selected private copies. The original file was retained.`);});
  const convert = async (note: StickyNote) => {
    const work = async () => {
      const latest = (await readDurableDeviceNotes(scope)).find(row => row.id === note.id);
      if (!latest || latest.convertedTaskId || !boardId || !data.columns[0]) return;
      const rows = await fetchTasks({ boardId, workspaceId: scope.workspaceId });
      const task = rows.find(row => row.id === latest.id) ?? await createTask({ id: latest.id, title: latest.title.trim(), description: latest.html, board_id: boardId, list_id: data.columns[0], workspace_id: scope.workspaceId ?? undefined, created_by: currentUser.id, position: rows.filter(row => row.list_id === data.columns[0]).length });
      await replaceTaskChecklistItems(task.id, latest.checklist, scope.workspaceId);
      await persist({ ...latest, taskId: task.id, taskBoardId: boardId, convertedTaskId: task.id }, latest.revision);
    };
    try { if (session.isSaving()) throw Error('Wait for the note to finish saving, then convert it.'); if (!currentUser.isMock) throw Error('Task conversion in this preview requires local demo mode.'); if (navigator.locks) await navigator.locks.request(`kora:note-conversion:${key}:${note.id}`, work); else throw Error('Safe conversion requires a browser with Web Locks.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Conversion failed. The note is retained for retry.'); }
  };
  const editorActions=(entry:ManagerEntry):DropdownMenuOption[]=>{const note=entry.note;return[
    {label:note.convertedTaskId?t('notes.convertedToTask'):t('notes.k.convert'),isDisabled:!!note.convertedTaskId||!boardId||!note.title.trim(),onClick:()=>{void convert(note);}},
    ...(isTauri()?[{label:t('notes.quick.float'),onClick:()=>openQuickNotes({noteId:note.id,personal,float:true})}]:[]),
  ];};
  if (!NOTES_PREVIEW_ENABLED) return <p className="p-6">{t('notes.notesPreviewIsNotEnabled')}</p>;
  return <main id="main" className="p-4 sm:p-6">
    <NativeNotesControls userId={currentUser.id}/>
    {drafts.length>0&&<details className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><summary>{t('notes.drafts',{count:drafts.length})}</summary><ul className="mt-2 space-y-2">{drafts.map(draft=><li key={draft.key} className="flex flex-wrap items-center gap-2"><span className="mr-auto">{draft.note.title||t('notes.quick.untitled')}</span><button type="button" className="min-h-9 rounded border bg-white px-3" onClick={()=>{void session.retry(draft.note.id,draft.key).catch(reason=>setError(String(reason)));}}>{t('notes.retrySave')}</button><button type="button" className="min-h-9 rounded border bg-white px-3" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(draft.note,null,2)],{type:'application/json'})),anchor=document.createElement('a');anchor.href=url;anchor.download='kora-device-draft.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>{t('notes.exportDraft')}</button></li>)}</ul></details>}
    {(error || actionError) && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error || actionError}</p>}
    <input ref={importFile} type="file" accept="application/json,.json" aria-label={t('notes.import')} className="hidden" onChange={event=>{const file=event.target.files?.[0];if(file)void file.text().then(text=>setBundle(parseNotesBundle(text))).catch(reason=>setError(String(reason)));event.target.value='';}}/>
    {transferStatus&&<p role="status" className="mb-3 text-sm text-slate-600">{transferStatus}</p>}
    {bundle&&<NoteImportPreview key={bundle.id} notes={bundle.notes} destination={personal?t('notes.scope.personal'):activeWorkspace?.name??t('notes.thisDevice')} busy={busy} onImport={(ids,choices)=>{void importSelected(ids,choices);}} onClose={()=>setBundle(null)}/>}
    <NotesManager
      heading={<h1 className="text-2xl font-semibold tracking-tight text-slate-950">{t(personal ? 'notes.scope.personal' : 'shell.notes')}</h1>}
      toolbar={<button type="button" className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" onClick={()=>importFile.current?.click()}>{t('notes.import')}</button>}
      entries={notes.map(note=>({note,readOnly:false,canArchive:true,canTrash:true}))}
      status={status} local saveError={error || actionError} filter={filter}
      requestedOpenId={params.get('note')} onRequestedOpenHandled={()=>{const query=new URLSearchParams(location.search);query.delete('note');navigate(`/notes?${query}`,{replace:true});}} label={label}
      onNavigate={next=>{const query=new URLSearchParams(location.search);if(next.filter==='all')query.delete('filter');else query.set('filter',next.filter);if(next.label)query.set('label',next.label);else query.delete('label');navigate(`/notes?${query}`);}}
      canCreate onCreate={patch=>session.create(patch)} onChange={change}
      onArchive={(ids,archived)=>changeAll(ids,{archivedAt:archived?new Date().toISOString():null})}
      onTrash={ids=>changeAll(ids,{deletedAt:new Date().toISOString()})}
      onRestore={ids=>changeAll(ids,{deletedAt:null})}
      onExport={async ids=>{const rows=(await readDurableDeviceNotes(scope)).filter(row=>ids.includes(row.id)&&!row.deletedAt);if(rows.length!==ids.length)throw Error('A selected original changed. Review the selection.');downloadNotesFile(await exportNotes(rows,id=>deviceNoteMedia(scope,id),{clearTaskLinks:false,omitUnavailableImages:false}),'kora-device-notes.json');}}
      createMedia={id=>deviceNoteMedia(scope,id)} editorActions={editorActions}
      tasks={tasks} boardId={boardId} onOpenTask={note=>{if(note.taskId&&note.taskBoardId)navigate(`/notes?task=${note.taskId}&taskBoard=${note.taskBoardId}`);}}
      unavailable={filter==='shared'?t('notes.sharedNotesAreNotAvailableIn'):undefined} />
  </main>;
}
