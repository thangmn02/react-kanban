import {NoteMediaProvider} from './note-media-provider';
import { useEffect, useRef, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import MiniEditor from './mini-editor';
import NoteAppearance from './note-appearance';
import { processDeviceImage, type NoteMedia, type UploadedNoteImage } from './note-media';
import { nativeNoteRequest, type NativeNoteContext, type NativeNoteFlags, type NativeNoteSnapshot } from './native-note-bridge';
import { noteColors, notePresentationPreferences } from './note-presentation';
import type { StickyNote } from './notes-store';
import { downloadNotesFile } from './note-transfer';
import './native-note-window.css';

type Reply = { nonce:string; result:unknown; error:string|null };
export default function NativeNoteWindow() {
  const [snapshot,setSnapshot]=useState<NativeNoteSnapshot|null>(null),[flags,setFlags]=useState<NativeNoteFlags>({alwaysOnTop:true,opacity:0.96,collapsed:false,ghost:false,peek:false}),[error,setError]=useState(''),[hasFailed,setHasFailed]=useState(false);
  const requests=useRef(new Map<string,{resolve:(value:unknown)=>void;reject:(reason:Error)=>void;timer:ReturnType<typeof setTimeout>}>()),early=useRef(new Map<string,Reply>()),active=useRef(false),latest=useRef<NativeNoteSnapshot|null>(null),writing=useRef(0),mediaListeners=useRef(new Set<()=>void>());
  const send=useRef<<T,>(action:string,payload?:unknown)=>Promise<T>>(()=>Promise.reject(Error('The note is preparing.')));
  const context=useRef<NativeNoteContext|null>(null);
  const acknowledged=useRef<NativeNoteSnapshot|null>(null),failed=useRef(false),writerId=useRef(''),editVersion=useRef(0),closing=useRef(false),closeCancellation=useRef(0);
  const [preparingClose,setPreparingClose]=useState(false);
  useEffect(()=>{
    const noteWindow=getCurrentWebviewWindow(),pendingRequests=requests.current,earlyReplies=early.current,listeners=mediaListeners.current;active.current=true;document.documentElement.classList.add('native-note-document');const cleanups:(()=>void)[]=[];
    const apply=(value:NativeNoteSnapshot)=>{if(context.current?.noteId&&value.note.id!==context.current.noteId)return false;latest.current=value;if(!writing.current&&!failed.current){setSnapshot(value);if(/^(Saved locally|All changes saved)/.test(value.status))acknowledged.current=value;}return true;};
    const reply=(event:Reply)=>{const pending=requests.current.get(event.nonce);if(!pending){early.current.set(event.nonce,event);return;}clearTimeout(pending.timer);requests.current.delete(event.nonce);if(event.error)pending.reject(Error(event.error));else pending.resolve(event.result);};
    send.current=async<T,>(action:string,payload:unknown={}):Promise<T>=>{
      const result=await nativeNoteRequest<{nonce:string}>(action,payload);
      return new Promise<T>((resolve,reject)=>{if(!active.current){reject(Error('The note window closed.'));return;}const timer=setTimeout(()=>{requests.current.delete(result.nonce);reject(Error('The main Notes repository did not respond. Your draft stays in this window; retry or export it.'));},55000);requests.current.set(result.nonce,{resolve:resolve as(value:unknown)=>void,reject,timer});const arrived=early.current.get(result.nonce);if(arrived){early.current.delete(result.nonce);reply(arrived);}});
    };
    void(async()=>{
      const replyStop=await noteWindow.listen<Reply>('kora-note-reply',event=>reply(event.payload));if(!active.current){replyStop();return;}cleanups.push(replyStop);
      const snapshotStop=await noteWindow.listen<NativeNoteSnapshot>('kora-note-snapshot',event=>{const previous=latest.current;if(!apply(event.payload))return;if(previous?.note.revision!==event.payload.note.revision||previous?.readOnly!==event.payload.readOnly)mediaListeners.current.forEach(invalidate=>invalidate());});if(!active.current){snapshotStop();return;}cleanups.push(snapshotStop);
      const flagStop=await noteWindow.listen<NativeNoteFlags>('kora-note-flags',event=>setFlags(event.payload));if(!active.current){flagStop();return;}cleanups.push(flagStop);
      const prepareClose=(nonce:string)=>{void(async()=>{
        closing.current=true;setPreparingClose(true);
        for(let attempt=0;attempt<45&&(writing.current||!acknowledged.current)&&!failed.current;attempt++)await new Promise(resolve=>setTimeout(resolve,100));
        if(active.current&&!writing.current&&!failed.current&&acknowledged.current)await nativeNoteRequest('close_ready',{nonce,writerId:writerId.current});
      })().catch(()=>{});};
      const closeStop=await noteWindow.listen<{nonce:string}>('kora-note-prepare-close',event=>prepareClose(event.payload.nonce));if(!active.current){closeStop();return;}cleanups.push(closeStop);
      const cancelStop=await noteWindow.listen('kora-note-close-cancel',()=>{closeCancellation.current++;closing.current=false;setPreparingClose(false);});if(!active.current){cancelStop();return;}cleanups.push(cancelStop);
      const contextCancellation=closeCancellation.current;
      const initial=await nativeNoteRequest<NativeNoteFlags&{context:NativeNoteContext;writerId:string;closeNonce?:string}>('context');if(!active.current)return;context.current=initial.context;writerId.current=initial.writerId;setFlags(initial);if(initial.closeNonce&&contextCancellation===closeCancellation.current)prepareClose(initial.closeNonce);
      const first=await send.current<NativeNoteSnapshot>('read');acknowledged.current=first;apply(first);
      requestAnimationFrame(()=>document.querySelector<HTMLElement>('[contenteditable="true"]')?.focus());
    })().catch(reason=>{if(active.current)setError(String(reason));});
    return()=>{active.current=false;cleanups.forEach(stop=>stop());pendingRequests.forEach(pending=>{clearTimeout(pending.timer);pending.reject(Error('The note window closed.'));});pendingRequests.clear();earlyReplies.clear();listeners.clear();document.documentElement.classList.remove('native-note-document');};
  },[]);
  const [media]=useState<NoteMedia>(()=>{
    const uploads=new WeakMap<File,string>();
    return{
      async upload(file){const operationId=uploads.get(file)??crypto.randomUUID();uploads.set(file,operationId);const processed=await processDeviceImage(file);const bytes=new Uint8Array(await processed.blob.arrayBuffer());let raw='';for(let at=0;at<bytes.length;at+=16384)raw+=String.fromCharCode(...bytes.subarray(at,at+16384));return send.current<UploadedNoteImage>('media_upload',{data:btoa(raw),type:processed.blob.type,name:file.name,operationId});},
      async download(id){const image=await send.current<{data:string;type:string}>('media_download',{id});return new Blob([Uint8Array.from(atob(image.data),value=>value.charCodeAt(0))],{type:image.type});},
      subscribe(listener){mediaListeners.current.add(listener);return()=>{mediaListeners.current.delete(listener);};},
      uploaded(){return send.current<(UploadedNoteImage&{createdAt:string})[]>('media_list');},
    };
  });
  const change=(patch:Partial<StickyNote>)=>{
    if(!snapshot||snapshot.readOnly||closing.current)return;
    if(patch.opacity!==undefined){void nativeNoteRequest('flags',{opacity:patch.opacity}).catch(reason=>setError(String(reason)));return;}
    if(patch.collapsed!==undefined){void nativeNoteRequest('flags',{collapsed:patch.collapsed}).catch(reason=>setError(String(reason)));return;}
    if(patch.clickThrough||patch.peek){void nativeNoteRequest('flags',{ghost:true,peek:!!patch.peek}).catch(reason=>setError(String(reason)));return;}
    const version=++editVersion.current;writing.current++;setSnapshot(previous=>previous?{...previous,note:{...previous.note,...patch},status:'Saving locally…'}:previous);
    void nativeNoteRequest('edit_state',{writerId:writerId.current,version,settled:false}).then(()=>send.current<NativeNoteSnapshot>('change',{patch})).then(value=>{latest.current=value;acknowledged.current=value;if(!failed.current)setError('');}).catch(reason=>{failed.current=true;setHasFailed(true);setError(String(reason));setSnapshot(current=>current?{...current,status:'Local save failed. Export the retained draft before closing.'}:current);}).finally(()=>{writing.current--;if(!writing.current&&!failed.current&&latest.current){setSnapshot(latest.current);void nativeNoteRequest('edit_state',{writerId:writerId.current,version:editVersion.current,settled:true}).catch(()=>{});}});
  };
  if(!snapshot)return <div role="status" className="m-1 rounded-xl bg-amber-50 p-4 text-sm text-slate-800">{error||'Opening Kora Note…'}</div>;
  const note=snapshot.note,presentation=notePresentationPreferences(note),color=noteColors[presentation.color];
  return <NoteMediaProvider media={media}>
    <div className="native-note-root" style={{'--note-font-size':`${presentation.fontSize}px`,color:color.text} as React.CSSProperties}>
      <article style={{display:flags.collapsed?'none':undefined,background:color.surface,borderColor:color.border,opacity:flags.peek?0.08:flags.opacity}} className="native-note-card">
        <header className="flex shrink-0 items-center gap-1 border-b border-black/10 p-1.5">
          <button type="button" aria-label="Move external note" className="min-h-8 cursor-grab px-2" onPointerDown={()=>{void nativeNoteRequest('drag').catch(reason=>setError(String(reason)));}}>⠿</button>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">{note.title||'Kora Note'}</span>
          <button type="button" aria-label="Always on Top" aria-pressed={flags.alwaysOnTop} className="min-h-8 rounded px-2 text-xs hover:bg-black/5" onClick={()=>{void nativeNoteRequest('flags',{alwaysOnTop:!flags.alwaysOnTop}).catch(reason=>setError(String(reason)));}}>{flags.alwaysOnTop?'On top':'Pin'}</button>
          <button type="button" aria-label="Collapse external note" className="min-h-8 px-2" onClick={()=>{void nativeNoteRequest('flags',{collapsed:true});}}>−</button>
          <button type="button" aria-label="Hide external note" className="min-h-8 px-2" onClick={()=>{void nativeNoteRequest('hide');}}>×</button>
        </header>
        <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
          <input aria-label="Note title" value={note.title} maxLength={160} readOnly={snapshot.readOnly||preparingClose} className="w-full bg-transparent text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue-500" placeholder="Untitled note" onChange={event=>change({title:event.target.value})}/>
          <MiniEditor html={note.html} compact={false} minimal readOnly={snapshot.readOnly||preparingClose} onChange={html=>change({html})}/>
          {!!note.checklist.length&&<ul className="space-y-2">{note.checklist.map(item=><li key={item.id}><label className="flex gap-2 text-sm"><input type="checkbox" disabled={snapshot.readOnly||preparingClose} checked={item.isDone} onChange={event=>change({checklist:note.checklist.map(row=>row.id===item.id?{...row,isDone:event.target.checked}:row)})}/><span className={item.isDone?'line-through opacity-60':''}>{item.text}</span></label></li>)}</ul>}
          {note.taskId&&<button type="button" className="min-h-8 text-xs underline" onClick={()=>{void send.current('open_task');}}>Open linked task</button>}
          {(error||snapshot.error)&&<p role="alert" className="rounded bg-white p-2 text-xs text-rose-700">{error||snapshot.error}{hasFailed&&<button type="button" className="ml-2 min-h-8 underline" onClick={()=>downloadNotesFile(snapshot.note,'kora-native-draft.json')}>Export retained draft</button>}</p>}
          {snapshot.conflict&&<button type="button" className="min-h-8 text-xs underline" onClick={()=>{void send.current<NativeNoteSnapshot>('recover').then(setSnapshot).catch(reason=>setError(String(reason)));}}>Review retained draft in Notes Manager</button>}
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-1 border-t border-black/10 px-2 py-1">
          <div className="min-w-0"><p role="status" className="truncate text-[10px] opacity-80">{snapshot.status||'Editing'}</p><button type="button" className="min-h-6 text-[10px] underline" disabled={preparingClose} onClick={()=>{const version=editVersion.current,action=failed.current?'change':'retry',payload=failed.current?{expectedRevision:acknowledged.current?.note.revision,expectedToken:acknowledged.current?.note.writeToken,patch:{title:snapshot.note.title,html:snapshot.note.html,checklist:snapshot.note.checklist}}:{};writing.current++;void send.current<NativeNoteSnapshot>(action,payload).then(value=>{acknowledged.current=value;latest.current=value;if(editVersion.current!==version||writing.current!==1){failed.current=true;setHasFailed(true);setError('Newer edits remain in this frame. Retry again to save them.');return;}failed.current=false;setHasFailed(false);setError('');setSnapshot(value);void nativeNoteRequest('edit_state',{writerId:writerId.current,version,settled:true}).catch(()=>{});}).catch(reason=>setError(String(reason))).finally(()=>{writing.current--;});}}>Retry save / sync</button></div>
          <NoteAppearance note={{...note,opacity:flags.opacity}} onChange={change} onHide={()=>{void nativeNoteRequest('hide');}}/>
          <button type="button" aria-label="Resize external note" className="min-h-8 cursor-nwse-resize px-2" onPointerDown={()=>{void nativeNoteRequest('resize').catch(reason=>setError(String(reason)));}}>↘</button>
        </footer>
      </article>
      {flags.collapsed&&<button type="button" aria-label={`Restore external note: ${note.title||'Untitled note'}`} title="Click to restore; drag to move" className="native-note-bubble" style={{background:color.surface}} onClick={()=>{void nativeNoteRequest('flags',{collapsed:false});}} onPointerDown={event=>{const start={x:event.clientX,y:event.clientY};const move=(next:PointerEvent)=>{if(Math.hypot(next.clientX-start.x,next.clientY-start.y)>6){window.removeEventListener('pointermove',move);void nativeNoteRequest('drag');}};window.addEventListener('pointermove',move);window.addEventListener('pointerup',()=>window.removeEventListener('pointermove',move),{once:true});}}>▤</button>}
    </div>
  </NoteMediaProvider>;
}
