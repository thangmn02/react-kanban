import {NoteMediaProvider} from './note-media-provider';
import {useEffect,useMemo,useRef,useState,useSyncExternalStore,type CSSProperties} from 'react';
import {isTauri} from '@tauri-apps/api/core';
import type {AppUser,WorkspaceSummary} from '../../types/auth.type';
import type {SavedSource} from '../../types/saved-context.type';
import type {StickyNote} from './notes-store';
import {connectedNotesRepository} from './notes-repository';
import {deviceNotesRepository} from './device-notes-session';
import {OPEN_QUICK_NOTES,OPEN_SAVED_CONTEXT,type QuickNotesRequest} from './quick-notes-events';
import MiniEditor from './mini-editor';
import {deviceNoteMedia} from './note-media';
import {connectedNoteMedia} from './connected-note-media';
import {floatNote} from './native-notes-events';
import {whenNativeNotesReady} from './native-notes-lifecycle';
import {nativeNotesControl,type NativeNoteContext} from './native-note-bridge';
import {setSavedContext} from '../../services/saved-context.service';
import {requireSupabaseClient} from '../../lib/supabase';
import SavedContextPanel from './saved-context-panel';
import NoteHistory from './note-history';
import {MoreMenu} from '@astryxdesign/core/MoreMenu';
import type {DropdownMenuOption} from '@astryxdesign/core/DropdownMenu';
import {useI18n} from '../../i18n';
import {notify} from '../../components/organisms/toast/notify';
import {connectedQuickStore,deviceQuickStore,discardIfEmpty,resolveQuickNote,type QuickNoteStore} from './quick-note-actions';
import {MAX_FLOATING_NOTES,useFloatingQuickNotes} from './quick-notes-preferences';
import {noteSaveState,noteSaveStateKey} from './note-save-state';
import NoteSourceChip from './note-source-chip';
import {bodyPatch,hasAutomaticTitle} from './note-title';
import {noteColors,notePresentationPreferences} from './note-presentation';

type Request=QuickNotesRequest&{token:number};
type NativeWindowEntry={label:string;context:NativeNoteContext;hidden?:boolean};
type CardTarget={personal:boolean;noteId:string};
/** Notes floated in this session, oldest first; windows restored from an earlier session count as older. */
const floatOrder:string[]=[];
const CARD_KEY='kora:quick-note-card:v1';

/** Persistent app owner keeps capture and synchronization alive across route changes. Quick Notes never block the page. */
export default function QuickNotesLayer({user,workspace,tasks=[],taskTitle,boardId=null,docked=false,dockTask,onLeaveDock,onManager,onOpenOriginal}:{user:AppUser;workspace:WorkspaceSummary|null;tasks?:{id:string;title:string}[];taskTitle?:(taskId:string)=>string|undefined;boardId?:string|null;/** Kora shows the Focus Dock: floating notes open beside it. */docked?:boolean;/** The Focus task a note captured from the Dock is linked to. */dockTask?:{taskId?:string;boardId?:string};/** Shows the full window, so an in-app card never covers the Dock. */onLeaveDock?:()=>void;onManager:()=>void;onOpenOriginal:(source:SavedSource)=>void}){
  const [request,setRequest]=useState<Request|null>(null),[card,setCard]=useState<CardTarget|null>(null),[saved,setSaved]=useState(false);
  const counter=useRef(0);
  const ask=(value:QuickNotesRequest)=>setRequest({...value,token:++counter.current});
  useEffect(()=>{
    const open=(event:Event)=>{setSaved(false);setRequest({...((event as CustomEvent<QuickNotesRequest>).detail??{}),token:++counter.current});};
    const savedContext=()=>{setSaved(true);};
    const shortcut=(event:KeyboardEvent)=>{if(event.ctrlKey&&event.altKey&&!event.metaKey&&!event.shiftKey&&event.code==='KeyN'&&!event.repeat){event.preventDefault();setSaved(false);setRequest({create:true,token:++counter.current});}};
    window.addEventListener(OPEN_QUICK_NOTES,open);window.addEventListener(OPEN_SAVED_CONTEXT,savedContext);window.addEventListener('keydown',shortcut);
    return()=>{window.removeEventListener(OPEN_QUICK_NOTES,open);window.removeEventListener(OPEN_SAVED_CONTEXT,savedContext);window.removeEventListener('keydown',shortcut);};
  },[]);
  // Viewers cannot create workspace notes, so their new notes are personal.
  const viewer=!user.isMock&&workspace?.role==='viewer';
  const personal=(value:QuickNotesRequest)=>value.personal===true||!workspace||viewer&&!value.noteId&&value.personal!==false;
  const shared={user,workspace,tasks,taskTitle,boardId,docked,dockTask,card,onCard:(value:CardTarget|null)=>{if(value&&docked)onLeaveDock?.();setCard(value);},onHandled:()=>setRequest(null),onRequest:ask,onManager,onOpenOriginal};
  // Both destinations retain one repository owner, including when the card closes.
  return <>
    <QuickDestination key={`${user.id}:personal`} {...shared} workspaceId={null} request={request&&personal(request)?request:null}/>
    {workspace&&<QuickDestination key={`${user.id}:${workspace.id}`} {...shared} workspaceId={workspace.id} request={request&&!personal(request)?request:null}/>}
    {saved&&<SavedContextPanel user={user} onClose={()=>setSaved(false)} onOpenOriginal={source=>{setSaved(false);onOpenOriginal(source);}}/>}
  </>;
}

type DestinationProps={user:AppUser;workspace:WorkspaceSummary|null;workspaceId:string|null;taskTitle?:(taskId:string)=>string|undefined;tasks:{id:string;title:string}[];boardId:string|null;docked:boolean;dockTask?:{taskId?:string;boardId?:string};request:Request|null;card:CardTarget|null;onCard:(value:CardTarget|null)=>void;onHandled:()=>void;onRequest:(value:QuickNotesRequest)=>void;onManager:()=>void;onOpenOriginal:(source:SavedSource)=>void};
function QuickDestination({user,workspace,workspaceId,tasks,taskTitle,boardId,docked,dockTask,request,card,onCard,onHandled,onRequest,onManager,onOpenOriginal}:DestinationProps){
  const {t}=useI18n();
  const [repository]=useState(()=>user.isMock?deviceNotesRepository({userId:user.id,workspaceId}):connectedNotesRepository(user,workspaceId,workspace?.role)),session=repository.session;
  const store=useMemo<QuickNoteStore>(()=>user.isMock?deviceQuickStore(session as ReturnType<typeof deviceNotesRepository>['session']):connectedQuickStore(session as ReturnType<typeof connectedNotesRepository>['session'],user.id),[session,user]);
  const snapshot=useSyncExternalStore<ReturnType<ReturnType<typeof deviceNotesRepository>['session']['getSnapshot']>|ReturnType<ReturnType<typeof connectedNotesRepository>['session']['getSnapshot']>>(session.subscribe,session.getSnapshot);
  const floating=useFloatingQuickNotes(),[limit,setLimit]=useState<{noteId:string;windows:NativeWindowEntry[];fromDock:boolean}|null>(null),handled=useRef(0);
  const mine=!!card&&card.personal===(workspaceId===null);
  useEffect(()=>{let active=true,release:(()=>void)|undefined;if(!isTauri())release=repository.acquire();else void whenNativeNotesReady().then(()=>{if(active)release=repository.acquire();}).catch(reason=>{if(active)notify.error(String(reason));});return()=>{active=false;release?.();};},[repository]);
  const closeCard=async()=>{const id=mine?card?.noteId:undefined;if(mine)onCard(null);if(id)await discardIfEmpty(store,id).catch(reason=>notify.error(String(reason)));};
  const float=async(noteId:string,fromDock:boolean,replaceLabel?:string)=>{
    const windows=await nativeNotesControl<NativeWindowEntry[]>('windows');
    if(!replaceLabel&&!windows.some(entry=>entry.context.noteId===noteId)&&windows.length>=MAX_FLOATING_NOTES){setLimit({noteId,windows,fromDock});return;}
    await floatNote({userId:user.id,workspaceId,noteId,local:user.isMock,focus:true,besideMain:fromDock,replaceLabel});
    const at=floatOrder.indexOf(noteId);if(at>=0)floatOrder.splice(at,1);floatOrder.push(noteId);
  };
  const loading='loading' in snapshot&&snapshot.loading;
  // One pass per request token, once the repository has loaded.
  useEffect(()=>{
    if(!request||handled.current===request.token||loading)return;handled.current=request.token;
    void(async()=>{
      const id=await resolveQuickNote(store,docked&&request.create&&!request.taskId&&workspaceId!==null?{...request,...dockTask}:request);
      if(!id){notify.error(t('notes.quick.unavailable'));return;}
      if(isTauri()&&(floating||request.float)){if(mine&&card?.noteId!==id)await closeCard();await float(id,!!request.fromDock||docked);}
      else onCard({personal:workspaceId===null,noteId:id});
    })().catch(reason=>notify.error(reason instanceof Error?reason.message:String(reason))).finally(onHandled);
  });
  const entry=mine?store.notes().find(row=>row.note.id===card!.noteId):undefined;
  return <>
    {limit&&<FloatLimit count={limit.windows.length}
      onCloseOldest={()=>{const current=limit;setLimit(null);const oldest=current.windows.find(row=>row.hidden)??[...current.windows].sort((a,b)=>floatOrder.indexOf(a.context.noteId)-floatOrder.indexOf(b.context.noteId))[0];void float(current.noteId,current.fromDock,oldest?.label).catch(reason=>notify.error(String(reason)));}}
      onOpenInside={()=>{const current=limit;setLimit(null);onCard({personal:workspaceId===null,noteId:current.noteId});}}
      onDismiss={()=>{const current=limit;setLimit(null);void discardIfEmpty(store,current.noteId).catch(()=>{});}}/>}
    {entry&&<QuickCard key={entry.note.id} user={user} workspace={workspace} workspaceId={workspaceId} entry={entry} store={store} snapshot={snapshot} tasks={tasks} taskTitle={taskTitle} boardId={boardId} session={session}
      onClose={()=>{void closeCard();}} onRequest={onRequest} onManager={()=>{void closeCard();onManager();}} onOpenOriginal={onOpenOriginal}
      onFloat={()=>{const id=entry.note.id;onCard(null);void float(id,docked).catch(reason=>notify.error(String(reason)));}}/>}
  </>;
}

function useOnline(){return useSyncExternalStore(listener=>{window.addEventListener('online',listener);window.addEventListener('offline',listener);return()=>{window.removeEventListener('online',listener);window.removeEventListener('offline',listener);};},()=>navigator.onLine,()=>true);}
const clampPosition=(position:{right:number;bottom:number})=>({right:Math.max(8,Math.min(innerWidth-288,position.right)),bottom:Math.max(8,Math.min(innerHeight-160,position.bottom))});
function cardPosition(){
  let position={right:24,bottom:24};
  try{const saved=JSON.parse(localStorage.getItem(CARD_KEY)??'null');if(saved&&Number.isFinite(saved.right)&&Number.isFinite(saved.bottom))position={right:saved.right,bottom:saved.bottom};}catch{/* The default corner is used. */}
  // Keep clear of a Focus Dock or island in the same corner.
  const dock=document.querySelector('.focus-island, .floating-focus')?.getBoundingClientRect();
  if(dock&&dock.width&&position.bottom<innerHeight-dock.top+12&&innerWidth-position.right>dock.left)position={...position,bottom:Math.round(innerHeight-dock.top+12)};
  return clampPosition(position);
}

type CardProps={taskTitle?:(taskId:string)=>string|undefined;user:AppUser;workspace:WorkspaceSummary|null;workspaceId:string|null;entry:{note:StickyNote;readOnly:boolean;owner:boolean};store:QuickNoteStore;snapshot:{status:string;error:string};tasks:{id:string;title:string}[];boardId:string|null;session:unknown;onClose:()=>void;onRequest:(value:QuickNotesRequest)=>void;onManager:()=>void;onOpenOriginal:(source:SavedSource)=>void;onFloat:()=>void};
/** Non-modal sticky card in the bottom-right corner. It never covers the page with a backdrop and moves by its grip. */
function QuickCard({user,workspace,workspaceId,entry,store,snapshot,tasks,taskTitle,boardId,session,onClose,onRequest,onManager,onOpenOriginal,onFloat}:CardProps){
  const {t}=useI18n();
  const {note,readOnly,owner}=entry;
  // A note that already had its own title keeps its title field while open; a new note is named by its first line.
  const [titled]=useState(()=>!hasAutomaticTitle(note));
  const [position,setPosition]=useState(cardPosition),[busy,setBusy]=useState(false),[error,setError]=useState(''),[history,setHistory]=useState(false),[linking,setLinking]=useState(false),[writing,setWriting]=useState(0);
  const root=useRef<HTMLElement>(null),drag=useRef<{pointer:number;x:number;y:number;right:number;bottom:number}|null>(null);
  const online=useOnline();
  useEffect(()=>{const frame=requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus());return()=>cancelAnimationFrame(frame);},[]);
  useEffect(()=>{const keep=()=>setPosition(value=>clampPosition(value));window.addEventListener('resize',keep);return()=>window.removeEventListener('resize',keep);},[]);
  const change=(patch:Partial<StickyNote>)=>{setWriting(value=>value+1);void store.change(note.id,patch).catch(reason=>setError(String(reason))).finally(()=>setWriting(value=>value-1));};
  const connected=!user.isMock?session as ReturnType<typeof connectedNotesRepository>['session']:null;
  const state=noteSaveState({status:/^Saving/i.test(snapshot.status)?'':snapshot.status,error:error||snapshot.error,writing:writing>0,online,local:user.isMock});
  const linkedTask=note.taskId?tasks.find(task=>task.id===note.taskId):undefined;
  const togglePin=()=>{setBusy(true);void(async()=>{if(connected){await connected.flush(note.id);if(connected.hasPending(note.id))throw Error('Synchronize this note before saving its reference.');}await setSavedContext(user,'note',note.id,!note.pinned,workspaceId);await store.change(note.id,{pinned:!note.pinned});})().catch(reason=>setError(String(reason))).finally(()=>setBusy(false));};
  const moveTo=(personal:boolean)=>{onClose();onRequest({create:true,personal,taskId:note.taskId??undefined,boardId:note.taskBoardId??undefined});};
  const more:DropdownMenuOption[]=[
    {label:t(note.pinned?'notes.quick.unpinFromTask':'notes.quick.pinToTask'),isDisabled:busy,onClick:togglePin},
    ...(!readOnly&&tasks.length&&boardId?[{label:t(note.taskId?'notes.quick.linkOtherTask':'notes.k.linkTask'),onClick:()=>setLinking(true)}]:[]),
    ...(note.taskId&&note.taskBoardId?[{label:t('notes.quick.openTask'),onClick:()=>onOpenOriginal({label:note.title,workspaceId,taskId:note.taskId!,boardId:note.taskBoardId!})}]:[]),
    ...(owner?[{label:t('notes.quick.history'),onClick:()=>setHistory(true)}]:[]),
    ...(isTauri()?[{label:t('notes.quick.float'),onClick:onFloat}]:[]),
    {type:'section',title:t('notes.quick.newIn'),items:[
      {label:`${workspaceId===null?'✓ ':''}${t('notes.quick.personal')}`,isDisabled:busy,onClick:()=>moveTo(true)},
      ...(workspace&&!(!user.isMock&&workspace.role==='viewer')?[{label:`${workspaceId!==null?'✓ ':''}${workspace.name}`,isDisabled:busy,onClick:()=>moveTo(false)}]:[])]},
    {type:'divider'},
    {label:t('notes.quick.manager'),onClick:onManager}];
  const color=noteColors[notePresentationPreferences(note).color];
  const savePosition=(value:{right:number;bottom:number})=>{try{localStorage.setItem(CARD_KEY,JSON.stringify(value));}catch{/* Position is a convenience only. */}};
  return <section ref={root} role="dialog" aria-modal="false" aria-label={t('notes.quick.title')} data-quick-note-card={note.id}
    onKeyDown={event=>{if(event.key==='Escape'&&!history){event.stopPropagation();onClose();}}}
    className="fixed z-[75] flex max-h-[min(32rem,calc(100vh-1rem))] w-[22rem] max-w-[calc(100vw-1rem)] flex-col rounded-2xl border shadow-2xl [&_:is(p,h1,h2,h3,li,span,label,blockquote)]:text-inherit"
    style={{right:position.right,bottom:position.bottom,background:color.surface,color:color.text,borderColor:color.border,colorScheme:color.scheme} as CSSProperties}>
    <header className="flex shrink-0 items-center gap-1 px-2 pt-1.5">
      <button type="button" aria-label={t('notes.quick.dragCard')} className="min-h-8 cursor-grab touch-none rounded px-2 opacity-70 hover:bg-black/5"
        onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,...position};}}
        onPointerMove={event=>{const start=drag.current;if(start?.pointer!==event.pointerId)return;setPosition(clampPosition({right:start.right-(event.clientX-start.x),bottom:start.bottom-(event.clientY-start.y)}));}}
        onPointerUp={()=>{drag.current=null;savePosition(position);}} onPointerCancel={()=>{drag.current=null;}}
        onKeyDown={event=>{const step=event.shiftKey?40:10,moves:Record<string,[number,number]>={ArrowLeft:[step,0],ArrowRight:[-step,0],ArrowUp:[0,step],ArrowDown:[0,-step]};const move=moves[event.key];if(move){event.preventDefault();setPosition(value=>{const next=clampPosition({right:value.right+move[0],bottom:value.bottom+move[1]});savePosition(next);return next;});}}}>⠿</button>
      <span className="min-w-0 flex-1 truncate text-xs font-medium opacity-70">{t('notes.quick.title')}</span>
      <button type="button" className="min-h-8 rounded px-2 text-xs hover:bg-black/5" onClick={()=>{onClose();onOpenOriginal({label:note.title,workspaceId,noteId:note.id});}}>{t('notes.quick.expand')}</button>
      <span className="inline-flex [&_.astryx-button]:!text-inherit"><MoreMenu label={t('notes.quick.more')} size="sm" items={more}/></span>
      <button type="button" aria-label={t('notes.quick.close')} className="min-h-8 min-w-8 rounded px-2 hover:bg-black/5" onClick={onClose}>×</button>
    </header>
    <div className="quiet-scroll-fade min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-2">
      <NoteSourceChip title={note.taskId?linkedTask?.title??taskTitle?.(note.taskId)??t('notes.quick.linkedTaskGeneric'):undefined} onUnlink={readOnly?undefined:()=>change({taskId:null,taskBoardId:null})}/>
      {titled&&<input aria-label={t('notes.quick.titleLabel')} maxLength={160} value={note.title} readOnly={readOnly} placeholder={t('notes.quick.untitled')} onChange={event=>change({title:event.target.value})} className="min-h-9 w-full bg-transparent text-base font-semibold text-inherit outline-none focus-visible:ring-2 focus-visible:ring-blue-500"/>}
      <QuickNoteEditor user={user} workspaceId={workspaceId} note={note} readOnly={readOnly} connected={connected} onChange={html=>change(bodyPatch(note,html))}/>
      {linking&&<label className="block text-xs">{t('notes.linkToTask')}<select autoFocus aria-label={t('notes.linkToTask')} className="mt-1 w-full rounded border border-black/10 bg-black/5 p-2 text-xs" value="" onChange={event=>{if(event.target.value)change({taskId:event.target.value,taskBoardId:boardId});setLinking(false);}}><option value="">{t('briefing.pin.noTask')}</option>{tasks.filter(task=>task.id!==note.taskId).map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></label>}
      {(error||snapshot.error)&&<p role="alert" className="text-xs text-rose-700">{error||snapshot.error}</p>}
    </div>
    <footer className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2"><span role="status" data-save-state={state} className="text-xs opacity-70">{t(noteSaveStateKey(state))}</span></footer>
    {history&&<NoteHistory user={user} workspaceId={workspaceId} note={note} onClose={()=>setHistory(false)} onRestore={async revision=>{if(user.isMock){await store.change(note.id,{title:revision.title,html:revision.html,checklist:revision.checklist});}else{if(connected!.hasPending(note.id))throw Error('Synchronize the current draft before restoring history.');const {error}=await requireSupabaseClient().rpc('restore_note_revision',{request:{actorUserId:user.id,noteId:note.id,revisionId:revision.id,expectedRevision:note.revision,writeToken:crypto.randomUUID()}});if(error)throw error;await connected!.refresh();}}}/>}
  </section>;
}

function FloatLimit({count,onCloseOldest,onOpenInside,onDismiss}:{count:number;onCloseOldest:()=>void;onOpenInside:()=>void;onDismiss:()=>void}){
  const {t}=useI18n();
  return <section role="alertdialog" aria-modal="false" aria-labelledby="float-limit-title" className="fixed bottom-6 right-6 z-[76] w-[22rem] max-w-[calc(100vw-1rem)] space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-2xl" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();onDismiss();}}}>
    <h2 id="float-limit-title" className="font-semibold text-slate-900">{t('notes.quick.limitTitle',{count})}</h2>
    <p className="text-xs leading-5 text-slate-600">{t('notes.quick.limitBody')}</p>
    <div className="flex flex-wrap justify-end gap-2"><button type="button" autoFocus className="min-h-9 rounded-lg border border-slate-200 px-3" onClick={onOpenInside}>{t('notes.quick.openInKora')}</button><button type="button" className="min-h-9 rounded-lg bg-slate-900 px-3 font-semibold text-white" onClick={onCloseOldest}>{t('notes.quick.closeOldest')}</button></div>
  </section>;
}

function QuickNoteEditor({user,workspaceId,note,readOnly,connected,onChange}:{user:AppUser;workspaceId:string|null;note:StickyNote;readOnly:boolean;connected:ReturnType<typeof connectedNotesRepository>['session']|null;onChange:(html:string)=>void}){
  const {t}=useI18n();
  const [media]=useState(()=>user.isMock||!connected?deviceNoteMedia({userId:user.id,workspaceId},note.id):connectedNoteMedia(user.id,note.id,async()=>{await connected.flush(note.id);if(connected.hasPending(note.id))throw Error('Wait for this note to synchronize before uploading an image.');}));
  return <NoteMediaProvider media={media}><MiniEditor html={note.html} compact={false} minimal placeholder={t('notes.quick.placeholder')} readOnly={readOnly} onChange={onChange}/></NoteMediaProvider>;
}
