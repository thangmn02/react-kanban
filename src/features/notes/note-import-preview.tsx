import { useState } from 'react';
import type { StickyNote } from './notes-store';
import type { ImportChoices } from './note-transfer';
import { stripTaskHtml } from '../../utils/taskCollections';

export default function NoteImportPreview({notes,destination,busy,onImport,onClose}:{notes:Pick<StickyNote,'id'|'title'|'html'>[];destination:string;busy:boolean;onImport:(ids:string[],choices:ImportChoices)=>void;onClose:()=>void}){
  const[selected,setSelected]=useState<string[]>([]),[choices,setChoices]=useState<ImportChoices>({clearTaskLinks:false,omitUnavailableImages:false});
  return <section aria-label="Preview Notes import" className="mb-4 space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-800">
    <p>Select notes to import into {destination}. Copies start private. Originals stay unchanged. Retrying reuses each imported copy and preserves later edits.</p>
    <ul className="max-h-60 space-y-2 overflow-auto">{notes.map(note=><li key={note.id}><label className="flex gap-2 rounded-lg bg-white p-2"><input type="checkbox" checked={selected.includes(note.id)} onChange={event=>setSelected(current=>event.target.checked?[...current,note.id]:current.filter(id=>id!==note.id))}/><span className="min-w-0"><span className="block font-medium">{note.title||'Untitled note'}</span><span className="block truncate text-xs text-slate-500">{stripTaskHtml(note.html).slice(0,180)||'Empty note'}</span></span></label></li>)}</ul>
    {!notes.length&&<p>No device notes are available in this source scope.</p>}
    <label className="flex gap-2"><input type="checkbox" checked={choices.clearTaskLinks} onChange={event=>setChoices({...choices,clearTaskLinks:event.target.checked})}/>Import content without task links</label>
    <label className="flex gap-2"><input type="checkbox" checked={choices.omitUnavailableImages} onChange={event=>setChoices({...choices,omitUnavailableImages:event.target.checked})}/>Omit images that cannot be read or uploaded</label>
    <button type="button" disabled={busy||!selected.length} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 disabled:opacity-50" onClick={()=>onImport(selected,choices)}>Import {selected.length} private {selected.length===1?'copy':'copies'}</button>
    <button type="button" disabled={busy} className="ml-2 min-h-10 px-3" onClick={onClose}>Cancel</button>
  </section>;
}
