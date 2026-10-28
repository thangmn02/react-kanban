import type { StickyNote } from './notes-store';
import { newNote } from './notes-store';
import { noteImageIds, type NoteMedia } from './note-media';
import { safeNoteHtml } from './safe-note-html';

export interface PortableImage { id:string;type:string;data:string }
export interface PortableNote { id:string;title:string;html:string;checklist:StickyNote['checklist'];taskId:string|null;taskBoardId:string|null;images:PortableImage[] }
export interface NotesBundle { format:'kora-notes';version:1;id:string;exportedAt:string;notes:PortableNote[] }
export interface ImportChoices { clearTaskLinks:boolean;omitUnavailableImages:boolean }
export interface NoteDestination {
  key:string;
  create:(note:StickyNote,importKey:string)=>Promise<StickyNote>;
  save:(note:StickyNote,expectedRevision:number,token:string)=>Promise<void>;
  complete?:(note:StickyNote)=>Promise<void>;
  media:(noteId:string)=>NoteMedia;
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const imageTypes=new Set(['image/png','image/jpeg','image/webp']);
export async function transferIdentity(value:string){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes.slice(0,16)].map(value=>value.toString(16).padStart(2,'0')).join('');return`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
const toBase64=async(blob:Blob)=>{const bytes=new Uint8Array(await blob.arrayBuffer());let raw='';for(let at=0;at<bytes.length;at+=16384)raw+=String.fromCharCode(...bytes.subarray(at,at+16384));return btoa(raw);};
export async function exportNotes(notes:StickyNote[],media:(id:string)=>NoteMedia,choices:ImportChoices):Promise<NotesBundle>{
  if(notes.length>100)throw Error('Export at most 100 selected notes at once.');
  const bundle:NotesBundle={format:'kora-notes',version:1,id:crypto.randomUUID(),exportedAt:new Date().toISOString(),notes:[]};let size=0;
  for(const note of notes){const document=new DOMParser().parseFromString(note.html,'text/html'),images:PortableImage[]=[];
    for(const id of noteImageIds(note.html)){try{const blob=await media(note.id).download(id);if(!imageTypes.has(blob.type)||blob.size>2*1024*1024)throw Error('An image is not portable.');const data=await toBase64(blob);size+=data.length;if(size>18*1024*1024)throw Error('Export media exceeds 18 MB. Select fewer notes.');images.push({id,type:blob.type,data});}catch(reason){if(!choices.omitUnavailableImages)throw reason;document.querySelectorAll('img[data-kora-note-image]').forEach(element=>{if(element.getAttribute('data-kora-note-image')?.toLowerCase()===id.toLowerCase())element.remove();});}}
    bundle.notes.push({id:note.id,title:note.title,html:document.body.innerHTML,checklist:note.checklist,taskId:choices.clearTaskLinks?null:note.taskId,taskBoardId:choices.clearTaskLinks?null:note.taskBoardId,images});
  }return bundle;
}
export function parseNotesBundle(text:string):NotesBundle{
  if(text.length>20*1024*1024)throw Error('Choose a Notes bundle under 20 MB.');
  const bundle=JSON.parse(text) as NotesBundle;
  if(!bundle||bundle.format!=='kora-notes'||bundle.version!==1||!uuid.test(bundle.id)||!Array.isArray(bundle.notes)||bundle.notes.length>100)throw Error('Unsupported Notes bundle. The original file was not changed.');
  const notes=new Set<string>();let bytes=0;
  for(const note of bundle.notes){
    if(!note||!uuid.test(note.id)||notes.has(note.id)||typeof note.title!=='string'||note.title.length>160||typeof note.html!=='string'||note.html.length>60000||!Array.isArray(note.checklist)||note.checklist.length>100||!Array.isArray(note.images)||note.images.length>100)throw Error('A note in this bundle is invalid.');notes.add(note.id);
    if(note.taskId!==null&&!uuid.test(note.taskId)||note.taskBoardId!==null&&!uuid.test(note.taskBoardId))throw Error('A task link is invalid.');
    const checks=new Set<string>(),images=new Set<string>();
    for(const item of note.checklist){if(!item||typeof item.id!=='string'||item.id.length>100||checks.has(item.id)||typeof item.text!=='string'||item.text.length>500||typeof item.isDone!=='boolean')throw Error('A checklist in this bundle is invalid.');checks.add(item.id);}
    for(const image of note.images){if(!image||!uuid.test(image.id)||images.has(image.id)||!imageTypes.has(image.type)||typeof image.data!=='string'||image.data.length>2_800_000||image.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(image.data))throw Error('An image in this bundle is invalid.');images.add(image.id);bytes+=image.data.length;if(bytes>18*1024*1024)throw Error('Bundle media exceeds 18 MB.');}
    note.html=safeNoteHtml(note.html);
  }return bundle;
}
export const bundleNoteMedia=(note:PortableNote):NoteMedia=>({
  async upload(){throw Error('Import sources are read only.');},
  async download(id){const image=note.images.find(image=>image.id.toLowerCase()===id.toLowerCase());if(!image)throw Error('An image is missing from the export. Choose explicitly whether to omit unavailable images.');return new Blob([Uint8Array.from(atob(image.data),value=>value.charCodeAt(0))],{type:image.type});},subscribe:()=>()=>{},
});
export async function copyNote(source:Pick<StickyNote,'id'|'title'|'html'|'checklist'|'taskId'|'taskBoardId'>&Partial<Pick<StickyNote,'pinned'|'minimized'|'expanded'|'x'|'y'|'width'|'height'>>,sourceMedia:NoteMedia,destination:NoteDestination,importKey:string,choices:ImportChoices){
  const candidate={...newNote(),title:source.title,expanded:true};
  for(const key of ['pinned','minimized','expanded','x','y','width','height'] as const){if(source[key]!==undefined)Object.assign(candidate,{[key]:source[key]});}
  const created=await destination.create(candidate,importKey);
  if(created.revision>1||created.html||created.checklist.length){await destination.complete?.(created);return{note:created,existing:true};}
  const document=new DOMParser().parseFromString(safeNoteHtml(source.html),'text/html'),media=destination.media(created.id);
  for(const id of noteImageIds(document.body.innerHTML)){
    try{const blob=await sourceMedia.download(id),operationId=await transferIdentity(`${destination.key}:${importKey}:${id}`),image=await media.upload(new File([blob],'imported-image',{type:blob.type}),operationId);
      document.querySelectorAll('img[data-kora-note-image]').forEach(element=>{if(element.getAttribute('data-kora-note-image')?.toLowerCase()===id.toLowerCase())element.setAttribute('data-kora-note-image',image.id);});
    }catch(reason){if(!choices.omitUnavailableImages)throw reason;document.querySelectorAll('img[data-kora-note-image]').forEach(element=>{if(element.getAttribute('data-kora-note-image')?.toLowerCase()===id.toLowerCase())element.remove();});}
  }
  const note={...created,title:source.title,html:document.body.innerHTML,checklist:source.checklist,taskId:choices.clearTaskLinks?null:source.taskId,taskBoardId:choices.clearTaskLinks?null:source.taskBoardId,convertedTaskId:null,peek:false,clickThrough:false,hidden:false,collapsed:false};
  await destination.save(note,created.revision,created.writeToken);await destination.complete?.(note);return{note,existing:false};
}
export function downloadNotesFile(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
