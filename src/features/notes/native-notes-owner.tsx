import { useEffect, useEffectEvent, useRef } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { AppUser, WorkspaceSummary } from '../../types/auth.type';
import { connectedNotesRepository,prepareConnectedNotesToClose } from './notes-repository';
import { connectedNoteMedia } from './connected-note-media';
import { deviceNoteMedia, type NoteMedia } from './note-media';
import { NOTES_CHANGED, notesKey, readNotes, type StickyNote } from './notes-store';
import { nativeNotesControl, type NativeNoteContext, type NativeNoteSnapshot } from './native-note-bridge';
import { deviceNotesRepository,prepareDeviceNotesToClose } from './device-notes-session';

import {DETACH_NOTE} from './native-notes-events';
import {sequenceNativeNotesLifecycle,runNotesTransition} from './native-notes-lifecycle';

type Request = { nonce: string; label: string; context: NativeNoteContext; action: string; payload: Record<string, unknown> };
const patchKeys = new Set(['title','html','checklist','taskId','taskBoardId','pinned','minimized','expanded','x','y','width','height','opacity','color','fontSize','floating','hidden','collapsed','clickThrough','bubbleX','bubbleY','headerVisible','peek']);
const base64 = async (blob: Blob) => { const bytes = new Uint8Array(await blob.arrayBuffer()); let result = ''; for (let at=0;at<bytes.length;at+=16384) result+=String.fromCharCode(...bytes.subarray(at,at+16384)); return btoa(result); };

/** The only native Notes auth/repository owner; note WebViews receive no session. */
export default function NativeNotesOwner({ user, workspace, onManager, onOpenTask }: { user: AppUser | null; workspace: WorkspaceSummary | null; onManager: () => void; onOpenTask: (taskId: string, boardId: string) => void }) {
  const routes=useRef({onManager,onOpenTask});useEffect(()=>{routes.current={onManager,onOpenTask};},[onManager,onOpenTask]);const readUser=useEffectEvent(()=>user);
  useEffect(() => {
    if (!isTauri()) return;const user=readUser(),mainWindow=getCurrentWebviewWindow();
    let active=true; const subscriptions=new Map<string,{release:()=>void;unsubscribe:()=>void;repository:ReturnType<typeof connectedNotesRepository>} >(), media=new Map<string,NoteMedia>();
    const cleanups:(()=>void)[]=[];
    const localOwners=new Map<string,ReturnType<typeof deviceNotesRepository>>(),localReleases:(()=>void)[]=[];
    const localRepository=(context:NativeNoteContext)=>{const key=context.workspaceId??'personal';let owner=localOwners.get(key);if(!owner){owner=deviceNotesRepository({userId:context.userId,workspaceId:context.workspaceId});localOwners.set(key,owner);localReleases.push(owner.acquire());}return owner;};
    const ready=sequenceNativeNotesLifecycle(async()=>{
      await nativeNotesControl('identity',user?{userId:user.id,workspaceId:workspace?.id??null}:null);
      if(!user||!active)return;
      const shortcut=localStorage.getItem(`kora:notes-native-shortcut:${user.id}`);
      if(shortcut)await nativeNotesControl('shortcut',{value:shortcut}).catch(reason=>window.dispatchEvent(new CustomEvent('kora:note-error',{detail:`Quick Note shortcut could not be restored: ${String(reason)}`})));
      for(const scope of [...new Set(['personal',workspace?.id].filter((value):value is string=>!!value))]){
        if(user.isMock){const storageScope={userId:user.id,workspaceId:scope==='personal'?null:scope};const rows=await nativeNotesControl<StickyNote[]>('local_read',{scope,seed:readNotes(storageScope)});localStorage.setItem(notesKey(storageScope),JSON.stringify(rows));window.dispatchEvent(new CustomEvent(NOTES_CHANGED,{detail:{key:notesKey(storageScope)}}));}
        else{const journal=await nativeNotesControl<{records:{key:string;value:string}[];retained_errors:number}>('journal_read',{scope});if(!active)return;for(const record of journal.records){if(!localStorage.getItem(record.key))localStorage.setItem(record.key,record.value);}if(journal.retained_errors)window.dispatchEvent(new CustomEvent('kora:note-error',{detail:`${journal.retained_errors} damaged draft records were retained. Healthy drafts are available in Notes Manager.`}));}
      }
    });
    const verify=(context:NativeNoteContext)=>{if(!active||!user||context.userId!==user.id||context.workspaceId!==null&&context.workspaceId!==workspace?.id||context.local!==user.isMock)throw Error('The note account or workspace changed.');};
    const getRepository=(context:NativeNoteContext)=>{verify(context);return connectedNotesRepository(user!,context.workspaceId,context.workspaceId?workspace?.role:undefined);};
    const snapshot=(context:NativeNoteContext):NativeNoteSnapshot=>{
      verify(context);
      if(context.local){const state=localRepository(context).session.getSnapshot(),note=state.notes.find(note=>note.id===context.noteId&&!note.deletedAt);if(!note)throw Error('This device note is unavailable.');return{note,readOnly:false,status:state.status||'Saved locally on this device.',error:state.error,conflict:false};}
      const state=getRepository(context).session.getSnapshot(),entry=state.notes.find(row=>row.note.id===context.noteId&&!row.row.deleted_at);if(!entry)throw Error('Note access is unavailable.');return{note:entry.note,readOnly:!['edit','manage'].includes(entry.permission)||state.conflicts.includes(context.noteId),status:state.status,error:state.error,conflict:state.conflicts.includes(context.noteId)};
    };
    const publish=async(label:string,context:NativeNoteContext)=>{try{await nativeNotesControl('snapshot',{label,snapshot:snapshot(context)});}catch{if(active){await nativeNotesControl('close',{label}).catch(()=>{});const previous=subscriptions.get(label);previous?.unsubscribe();previous?.release();subscriptions.delete(label);media.delete(label);}}};
    const register=async(label:string,context:NativeNoteContext)=>{
      if(context.local)return;
      if(subscriptions.has(label))return;
      const repository=getRepository(context),release=repository.acquire();
      const unsubscribe=repository.session.subscribe(()=>{void publish(label,context);});subscriptions.set(label,{release,unsubscribe,repository});
      await repository.session.refresh();
    };
    const open=async(context:NativeNoteContext,focus=false,preserveHidden=false)=>{await ready;verify(context);if(!context.local){const repository=getRepository(context),release=repository.acquire();try{await repository.session.refresh();snapshot(context);const label=await nativeNotesControl<string>('open',{context,focus,preserveHidden});await register(label,context);return label;}finally{release();}}await localRepository(context).session.whenReady();snapshot(context);return nativeNotesControl<string>('open',{context,focus,preserveHidden});};
    const restoreCatalog=async()=>{await ready;if(!active||!user)return;const saved=await nativeNotesControl<{contexts:NativeNoteContext[];retainedErrors:number}>('catalog');for(const context of saved.contexts){if(!active)return;verify(context);if(context.local!==user.isMock)continue;try{await open(context,false,true);}catch{/* Keep inaccessible/offline entries for a later authorized recovery. */}}if(saved.retainedErrors)window.dispatchEvent(new CustomEvent('kora:note-error',{detail:`${saved.retainedErrors} damaged placement records were retained. Open their original notes from Notes Manager.`}));};
    const online=()=>{void restoreCatalog().catch(reason=>{if(active)window.dispatchEvent(new CustomEvent('kora:note-error',{detail:String(reason)}));});};online();window.addEventListener('online',online);
    const localChanged=()=>{void nativeNotesControl<{label:string;context:NativeNoteContext}[]>('windows').then(windows=>Promise.all(windows.filter(entry=>entry.context.local).map(entry=>publish(entry.label,entry.context)))).catch(()=>{});};
    const onDetach=(event:Event)=>{void open((event as CustomEvent<NativeNoteContext>).detail).catch(reason=>window.dispatchEvent(new CustomEvent('kora:note-error',{detail:String(reason)})));};
    window.addEventListener(DETACH_NOTE,onDetach);window.addEventListener(NOTES_CHANGED,localChanged);
    const handle=async(request:Request)=>{
      try{
        await ready;verify(request.context);await register(request.label,request.context);const context=request.context;
        let result:unknown=null;
        if(request.action==='read'){if(context.local){const note=await localRepository(context).session.whenNoteDurable(context.noteId);result={...snapshot(context),note};}else{const note=await getRepository(context).session.whenDurable(context.noteId);if(!note)throw Error('The original note is unavailable.');result={...snapshot(context),note};}}
        else if(request.action==='change'){
          const current=snapshot(context);if(current.readOnly)throw Error('This note is read only.');

          const patch=Object.fromEntries(Object.entries(request.payload.patch as object??{}).filter(([key])=>patchKeys.has(key))) as Partial<StickyNote>;
          if(context.local){const session=localRepository(context).session;const note=request.payload.expectedRevision!==undefined?await session.retryFrame(context.noteId,patch,request.payload.expectedToken as string|undefined,request.label):(await session.change(context.noteId,patch,request.label),await session.whenNoteDurable(context.noteId));result={...snapshot(context),note};}
          else{const session=getRepository(context).session;if(request.payload.expectedRevision!==undefined&&!session.canRetryFrame(context.noteId,request.payload.expectedRevision,request.label))throw Error('The original changed in another session. Export the retained frame draft before reviewing it.');session.change(context.noteId,patch,request.label);const note=await session.whenDurable(context.noteId);if(!note)throw Error('The original note is unavailable.');result={...snapshot(context),note};}
        }else if(request.action==='retry'){if(context.local){const session=localRepository(context).session;await session.retry(context.noteId);const note=await session.whenNoteDurable(context.noteId);result={...snapshot(context),note};}else{const session=getRepository(context).session;session.retry();const note=await session.whenDurable(context.noteId);if(!note)throw Error('The original note is unavailable.');result={...snapshot(context),note};}}
        else if(request.action==='open_task'){const note=snapshot(context).note;if(note.taskId&&note.taskBoardId)routes.current.onOpenTask(note.taskId,note.taskBoardId);}
        else if(request.action==='recover'){if(!context.local){const session=getRepository(context).session;const draft=session.getSnapshot().drafts.find(row=>row.draft.note.id===context.noteId);if(draft)session.recover(draft.key,false);result=snapshot(context);}}
        else if(request.action==='media_upload'||request.action==='media_download'||request.action==='media_list'){
          snapshot(context);let repository=media.get(request.label);
          if(!repository){repository=context.local?deviceNoteMedia({userId:context.userId,workspaceId:context.workspaceId},context.noteId):connectedNoteMedia(context.userId,context.noteId,async()=>{const session=getRepository(context).session;await session.flush(context.noteId);if(session.hasPending(context.noteId))throw Error('Save the note before uploading an image.');});media.set(request.label,repository);}
          if(request.action==='media_list'){result=await repository.uploaded?.()??[];}
          else if(request.action==='media_download'){const blob=await repository.download(String(request.payload.id));result={data:await base64(blob),type:blob.type};}
          else{if(snapshot(context).readOnly)throw Error('This note is read only.');const data=String(request.payload.data);if(data.length>2_800_000)throw Error('Image exceeds the note limit.');const bytes=Uint8Array.from(atob(data),value=>value.charCodeAt(0)),file=new File([bytes],String(request.payload.name||'note-image'),{type:String(request.payload.type)});result=await repository.upload(file,String(request.payload.operationId));}
        }
        verify(context);await nativeNotesControl('reply',{nonce:request.nonce,result,error:null});
      }catch(reason){await nativeNotesControl('reply',{nonce:request.nonce,result:null,error:reason instanceof Error?reason.message:'Note request failed.'}).catch(()=>{});}
    };
    void mainWindow.listen<Request>('kora-note-request',event=>{void handle(event.payload);}).then(stop=>active?cleanups.push(stop):stop());
    void mainWindow.listen<{action:string;label?:string}>('kora-notes-command',event=>{void(async()=>{
      await ready;if(!active)return;
      if(event.payload.action==='manager')routes.current.onManager();
      if(event.payload.action==='restore_catalog')await restoreCatalog();
      if(event.payload.action==='window_closed'&&event.payload.label){const label=event.payload.label,previous=subscriptions.get(label);previous?.unsubscribe();previous?.release();subscriptions.delete(label);media.delete(label);window.dispatchEvent(new CustomEvent('kora:note-error',{detail:'An external note closed unexpectedly. Restore it from the tray or Notes Manager; its saved draft is retained.'}));}
      if(event.payload.action==='quit_blocked')window.dispatchEvent(new CustomEvent('kora:notes-quit-blocked',{detail:'Notes did not confirm durable storage. Retry or export retained edits before quitting.'}));
      if(event.payload.action==='capture'){
        try{if(!user)throw Error('Sign in before creating a note.');const context:NativeNoteContext={userId:user.id,workspaceId:null,noteId:'',local:user.isMock};
          if(user.isMock){context.noteId=await localRepository(context).session.create({expanded:true,floating:true});}
          else{const repository=getRepository(context),release=repository.acquire();try{await repository.session.refresh();context.noteId=repository.session.create({expanded:true,floating:true});await repository.session.whenDurable(context.noteId);await open(context,true);}finally{release();}}
          if(user.isMock)await open(context,true);
        }finally{await nativeNotesControl('capture_finished');}
      }
      if(event.payload.action==='quit'){
        await runNotesTransition(async()=>{try{await nativeNotesControl('quit_cancel');await nativeNotesControl('await_settled');if(user)await Promise.race([Promise.all([prepareConnectedNotesToClose(user.id),prepareDeviceNotesToClose(user.id)]),new Promise((_,reject)=>setTimeout(()=>reject(Error('Notes are still saving. Retry or export the retained draft before quitting.')),5000))]);await nativeNotesControl('quit');}
        catch(reason){await nativeNotesControl('quit_cancel');await nativeNotesControl('cancel_close');window.dispatchEvent(new CustomEvent('kora:notes-quit-blocked',{detail:String(reason)}));}});
      }
    })().catch(reason=>window.dispatchEvent(new CustomEvent('kora:note-error',{detail:String(reason)})));}).then(stop=>active?cleanups.push(stop):stop());
    return()=>{active=false;window.removeEventListener('online',online);cleanups.forEach(stop=>stop());localReleases.forEach(release=>release());window.removeEventListener(DETACH_NOTE,onDetach);window.removeEventListener(NOTES_CHANGED,localChanged);subscriptions.forEach(owner=>{owner.unsubscribe();owner.release();});subscriptions.clear();media.clear();void sequenceNativeNotesLifecycle(()=>nativeNotesControl<void>('identity',null));};
  },[user?.id,user?.isMock,workspace?.id,workspace?.role]);
  return null;
}
