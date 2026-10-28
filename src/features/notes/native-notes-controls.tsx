import { useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { nativeNotesControl } from './native-note-bridge';

export default function NativeNotesControls({userId}:{userId:string}){
  const key=`kora:notes-native-shortcut:${userId}`;
  const [shortcut,setShortcut]=useState(()=>localStorage.getItem(key)||'Control+Alt+Shift+N'),[enabled,setEnabled]=useState(()=>!!localStorage.getItem(key)),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
  if(!isTauri())return null;
  return <details className="mb-3 rounded-xl border border-slate-200 p-3 text-sm"><summary>Windows Quick Notes</summary><div className="mt-3 space-y-3">
    <p className="text-xs leading-5 text-slate-600">Use a note’s Appearance menu to open an external window. The Kora tray has New Quick Note and Restore Notes, including when the main window is minimized.</p>
    <button type="button" className="min-h-9 rounded border border-slate-200 px-3" onClick={()=>{void nativeNotesControl('restore').then(()=>setStatus('Notes restored to interactive mode.')).catch(reason=>setStatus(String(reason)));}}>Restore external notes · leave Ghost</button>
    <form className="flex flex-wrap items-center gap-2" onSubmit={event=>{event.preventDefault();setBusy(true);void nativeNotesControl('shortcut',{value:enabled?shortcut.trim():''}).then(()=>{if(enabled)localStorage.setItem(key,shortcut.trim());else localStorage.removeItem(key);setStatus(enabled?'Global Quick Note shortcut registered.':'Global shortcut disabled. App shortcut and tray remain available.');}).catch(reason=>setStatus(String(reason))).finally(()=>setBusy(false));}}>
      <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/>Enable global Quick Note shortcut</label>
      <input aria-label="Global Quick Note shortcut" value={shortcut} onChange={event=>setShortcut(event.target.value)} maxLength={100} className="min-h-9 rounded border border-slate-200 px-2"/>
      <button type="submit" disabled={busy} className="min-h-9 rounded border border-slate-200 px-3 disabled:opacity-50">Apply shortcut</button>
    </form><p role="status" className="text-xs text-slate-600">{status}</p>
  </div></details>;
}
