import {NoteMediaProvider} from './note-media-provider';
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {useLocation} from 'react-router-dom';
import {isTauri} from '@tauri-apps/api/core';
import type {AppUser,WorkspaceSummary} from '../../types/auth.type';
import type {SavedSource} from '../../types/saved-context.type';
import type {StickyNote} from './notes-store';
import {connectedNotesRepository} from './notes-repository';
import {deviceNotesRepository} from './device-notes-session';
import {OPEN_QUICK_NOTES,OPEN_SAVED_CONTEXT,type QuickNotesRequest} from './quick-notes-events';
import {useDialogFocus} from '../../hooks/use-dialog-focus';
import MiniEditor from './mini-editor';
import {deviceNoteMedia} from './note-media';
import {connectedNoteMedia} from './connected-note-media';
import {detachNote} from './native-notes-events';
import {whenNativeNotesReady} from './native-notes-lifecycle';
import {setSavedContext} from '../../services/saved-context.service';
import {requireSupabaseClient} from '../../lib/supabase';
import SavedContextPanel from './saved-context-panel';
import NoteHistory from './note-history';
import {MoreMenu} from '@astryxdesign/core/MoreMenu';
import type {DropdownMenuOption} from '@astryxdesign/core/DropdownMenu';
import {useI18n} from '../../i18n';

/** Persistent app owner keeps capture and synchronization alive across route changes. */
export default function QuickNotesLayer({user,workspace,onManager,onOpenOriginal}:{user:AppUser;workspace:WorkspaceSummary|null;onManager:()=>void;onOpenOriginal:(source:SavedSource)=>void}){
  const [requested,setRequest]=useState<QuickNotesRequest|null>(null),[saved,setSaved]=useState(false),[dismissedRoute,setDismissedRoute]=useState<string|null>(null);const location=useLocation();
  const query=new URLSearchParams(location.search),routeNote=query.get('note'),request=requested??(!saved&&dismissedRoute!==location.search&&routeNote?{noteId:routeNote,personal:query.get('scope')==='personal'}:null);
  const close=()=>{setRequest(null);setDismissedRoute(location.search);};
  useEffect(()=>{const open=(event:Event)=>{setSaved(false);setRequest((event as CustomEvent<QuickNotesRequest>).detail??{});};const saved=()=>{setRequest(null);setSaved(true);};const shortcut=(event:KeyboardEvent)=>{if(event.ctrlKey&&event.altKey&&!event.metaKey&&!event.shiftKey&&event.code==='KeyN'&&!event.repeat){event.preventDefault();setSaved(false);setRequest({create:true});}};window.addEventListener(OPEN_QUICK_NOTES,open);window.addEventListener(OPEN_SAVED_CONTEXT,saved);window.addEventListener('keydown',shortcut);return()=>{window.removeEventListener(OPEN_QUICK_NOTES,open);window.removeEventListener(OPEN_SAVED_CONTEXT,saved);window.removeEventListener('keydown',shortcut);};},[]);
  // Both destinations retain one repository owner, including when the panel closes.
  return <><QuickDestination key={`${user.id}:personal`} user={user} workspace={workspace} workspaceId={null} request={request&&(request.personal===true||!workspace)?request:null} onRequest={setRequest} onClose={close} onManager={onManager} onOpenOriginal={onOpenOriginal}/>{workspace&&<QuickDestination key={`${user.id}:${workspace.id}`} user={user} workspace={workspace} workspaceId={workspace.id} request={request&&request.personal!==true?request:null} onRequest={setRequest} onClose={close} onManager={onManager} onOpenOriginal={onOpenOriginal}/ >}{saved&&<SavedContextPanel user={user} onClose={()=>setSaved(false)} onOpenOriginal={source=>{setSaved(false);onOpenOriginal(source);}}/>}</>;
}
function QuickDestination({user,workspace,workspaceId,request,onRequest,onClose,onManager,onOpenOriginal}:{user:AppUser;workspace:WorkspaceSummary|null;workspaceId:string|null;request:QuickNotesRequest|null;onRequest:(value:QuickNotesRequest|null)=>void;onClose:()=>void;onManager:()=>void;onOpenOriginal:(source:SavedSource)=>void}){
  const {t}=useI18n();
  const [repository]=useState(()=>user.isMock?deviceNotesRepository({userId:user.id,workspaceId}):connectedNotesRepository(user,workspaceId,workspace?.role)),session=repository.session;
  const [ensureMediaSaved]=useState(()=>async(id:string)=>{if(user.isMock)return;const connected=repository.session as ReturnType<typeof connectedNotesRepository>['session'];await connected.flush(id);if(connected.hasPending(id))throw Error('Wait for this note to synchronize before uploading an image.');});
  const snapshot=useSyncExternalStore<ReturnType<ReturnType<typeof deviceNotesRepository>['session']['getSnapshot']>|ReturnType<ReturnType<typeof connectedNotesRepository>['session']['getSnapshot']>>(session.subscribe,session.getSnapshot),[selected,setSelected]=useState<string|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[history,setHistory]=useState(false);
  const dialog=useRef<HTMLElement|null>(null),created=useRef<QuickNotesRequest|null>(null);useDialogFocus(!!request&&!history,dialog,onClose);
  useEffect(()=>{let active=true,release:(()=>void)|undefined;if(!isTauri())release=repository.acquire();else void whenNativeNotesReady().then(()=>{if(active)release=repository.acquire();}).catch(reason=>{if(active)setError(String(reason));});return()=>{active=false;release?.();};},[repository]);
  const entries='loading' in snapshot?snapshot.notes.map(row=>({note:{...row.note,deletedAt:row.row.deleted_at},readOnly:!['edit','manage'].includes(row.permission),owner:row.row.owner_user_id===user.id})):snapshot.notes.map(note=>({note,readOnly:false,owner:true}));
  const notes=entries.filter(entry=>!entry.note.deletedAt&&(!request?.taskId||entry.note.taskId===request.taskId||request.noteId===entry.note.id));
  const wanted=request?.noteId??selected,current=wanted?notes.find(entry=>entry.note.id===wanted):notes[0],note=current?.note;
  const change=async(patch:Partial<StickyNote>)=>{if(!note||busy)return;try{if(user.isMock)await (session as ReturnType<typeof deviceNotesRepository>['session']).change(note.id,patch);else(session as ReturnType<typeof connectedNotesRepository>['session']).change(note.id,patch);}catch(reason){setError(String(reason));throw reason;}};
  const create=useCallback(async()=>{if(busy||workspaceId&&workspace?.role==='viewer'&&!user.isMock)return;setBusy(true);setError('');try{const id=await session.create({taskId:request?.taskId??null,taskBoardId:request?.boardId??null});setSelected(id);onRequest({...request,noteId:id,create:false});}catch(reason){setError(String(reason));}finally{setBusy(false);}},[busy,workspaceId,workspace?.role,user.isMock,session,request,onRequest]);
  useEffect(()=>{if(request?.create&&created.current!==request&&(!('loading' in snapshot)||!snapshot.loading)){created.current=request;void create();}},[request,snapshot,create]);
  if(!request)return null;
  const viewer=!user.isMock&&workspaceId!==null&&workspace?.role==='viewer';
  // One editor and Save. Where the note lives, history and floating are rarer choices, so they wait in the "…" menu.
  const more:DropdownMenuOption[]=[
    {type:'section',title:t('notes.quick.saveTo'),items:[
      {label:`${workspaceId===null?'✓ ':''}${t('notes.quick.personal')}`,isDisabled:busy||!!request.taskId,onClick:()=>{setSelected(null);onRequest({personal:true});}},
      ...(workspace?[{label:`${workspaceId!==null?'✓ ':''}${workspace.name}`,isDisabled:busy||!!request.taskId,onClick:()=>{setSelected(null);onRequest({personal:false});}}]:[])]},
    {type:'divider'},
    {label:t('notes.quick.new'),isDisabled:busy||viewer,onClick:()=>{void create();}},
    ...(note?.taskId&&note.taskBoardId?[{label:t('notes.quick.openTask'),onClick:()=>onOpenOriginal({label:note.title,workspaceId,taskId:note.taskId!,boardId:note.taskBoardId!})}]:[]),
    ...(note&&current?.owner?[{label:t('notes.quick.history'),onClick:()=>setHistory(true)}]:[]),
    ...(note&&isTauri()?[{label:t('notes.quick.float'),onClick:()=>detachNote({userId:user.id,workspaceId,noteId:note.id,local:user.isMock})}]:[]),
    {type:'divider'},
    {label:t('notes.quick.manager'),onClick:()=>{onClose();onManager();}}];
  return <div className="fixed inset-0 z-[75] grid place-items-center bg-slate-950/20 p-3"><section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="quick-note-title" className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
    <header className="flex items-center gap-2"><h2 id="quick-note-title" className="mr-auto font-semibold">{t('notes.quick.title')}</h2><MoreMenu label={t('notes.quick.more')} size="sm" items={more}/><button type="button" className="min-h-10 px-3" onClick={onClose}>{t('notes.quick.close')}</button></header>
    {request.taskId&&<p className="mt-1 text-xs text-slate-500">{t('notes.quick.linked')}</p>}
    {notes.length>1&&<select aria-label={t('notes.quick.openNote')} disabled={busy} value={note?.id??''} className="mt-3 min-h-9 w-full rounded-lg border px-2 text-sm" onChange={event=>{setSelected(event.target.value);onRequest({...request,noteId:event.target.value,create:false});}}>{notes.map(entry=><option key={entry.note.id} value={entry.note.id}>{entry.note.title||t('notes.quick.untitled')}</option>)}</select>}
    {'loading' in snapshot&&snapshot.loading&&<p role="status" className="mt-2 text-xs text-slate-500">{t('notes.quick.loading')}</p>}
    {(snapshot.error||error)&&<p role="alert" className="mt-3 text-sm text-rose-700">{error||snapshot.error}</p>}
    {note?<>
      <input aria-label={t('notes.quick.titleLabel')} maxLength={160} value={note.title} readOnly={current.readOnly||busy} placeholder={t('notes.quick.untitled')} onChange={event=>{void change({title:event.target.value}).catch(()=>{});}} className="mb-3 mt-3 min-h-10 w-full border-0 text-lg font-medium outline-none"/>
      <QuickNoteEditor key={note.id} user={user} workspaceId={workspaceId} note={note} readOnly={current.readOnly||busy} ensureSaved={ensureMediaSaved} onChange={html=>{void change({html}).catch(()=>{});}}/>
      <footer className="mt-3 flex justify-end border-t pt-3"><button type="button" disabled={busy} className="min-h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50" onClick={()=>{setBusy(true);void(async()=>{if(!user.isMock){const connected=session as ReturnType<typeof connectedNotesRepository>['session'];await connected.flush(note.id);if(connected.hasPending(note.id))throw Error('Synchronize this note before saving its reference.');}await setSavedContext(user,'note',note.id,!note.pinned,workspaceId);await change({pinned:!note.pinned});})().catch(reason=>setError(String(reason))).finally(()=>setBusy(false));}}>{t(note.pinned?'notes.quick.saved':'notes.quick.save')}</button></footer>
      {history&&<NoteHistory user={user} workspaceId={workspaceId} note={note} onClose={()=>setHistory(false)} onRestore={async revision=>{if(user.isMock){await change({title:revision.title,html:revision.html,checklist:revision.checklist});}else{const connected=session as ReturnType<typeof connectedNotesRepository>['session'];if(connected.hasPending(note.id))throw Error('Synchronize the current draft before restoring history.');const {error}=await requireSupabaseClient().rpc('restore_note_revision',{request:{actorUserId:user.id,noteId:note.id,revisionId:revision.id,expectedRevision:note.revision,writeToken:crypto.randomUUID()}});if(error)throw error;await connected.refresh();}}}/>}
    </>:<div className="py-8 text-center"><p className="text-sm text-slate-500">{t(request.noteId?'notes.quick.unavailable':'notes.quick.empty')}</p>{!request.noteId&&<button type="button" disabled={busy||viewer} className="mt-3 min-h-9 rounded-lg border px-3 text-sm" onClick={()=>{void create();}}>{t('notes.quick.new')}</button>}</div>}
  </section></div>;
}

function QuickNoteEditor({user,workspaceId,note,readOnly,ensureSaved,onChange}:{user:AppUser;workspaceId:string|null;note:StickyNote;readOnly:boolean;ensureSaved:(id:string)=>Promise<void>;onChange:(html:string)=>void}){
  const [media]=useState(()=>user.isMock?deviceNoteMedia({userId:user.id,workspaceId},note.id):connectedNoteMedia(user.id,note.id,()=>ensureSaved(note.id)));
  return <NoteMediaProvider media={media}><MiniEditor html={note.html} compact={false} minimal readOnly={readOnly} onChange={onChange}/></NoteMediaProvider>;
}