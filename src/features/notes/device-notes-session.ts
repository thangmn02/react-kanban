import { NOTES_CHANGED, newNote, notesKey, readNotes, readDurableDeviceNotes, saveNoteSafely, type StickyNote } from './notes-store';
import type { StorageScope } from '../../shared/storage/storageAdapter';
import { readDeviceDrafts,writeDeviceDraft,retireDeviceDraft } from './native-note-bridge';



interface Snapshot { notes:StickyNote[];error:string;status:string;drafts:{key:string;note:StickyNote;baseRevision?:number;baseToken?:string;ownTokens?:string[]}[] }
/** One local writer queue shared by manager, Quick Notes and the native broker. */
class DeviceNotesSession {
  private snapshot:Snapshot={notes:[],error:'',status:'',drafts:[]};
  private listeners=new Set<()=>void>();private queues=new Map<string,Promise<boolean>>();private pending=0;private writer=crypto.randomUUID();private versions=new Map<string,number>();
  private scope:StorageScope;
  private ready:Promise<void>|null=null;
  private draftCache=new Map<string,string>();
  private durableDrafts=new Map<string,string>();
  private acknowledged=new Map<string,StickyNote>();private committedSources=new Map<string,{token:string;source?:string}>();
  private recoveryBase=new Map<string,{revision:number|undefined;token:string;tokens:Set<string>}>();
  constructor(scope:StorageScope){this.scope=scope;this.reload();}
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  getSnapshot=()=>this.snapshot;
  private emit(patch:Partial<Snapshot>){this.snapshot={...this.snapshot,...patch};this.listeners.forEach(listener=>listener());}
  private prefix(){return`kora:device-notes-draft:${notesKey(this.scope)}:`;}
  private draftKey(id:string){return`${this.prefix()}${id}:${this.writer}`;}
  private drafts(){const result:Snapshot['drafts']=[],keys=new Set(this.draftCache.keys());for(let index=0;index<localStorage.length;index++){const key=localStorage.key(index);if(key?.startsWith(this.prefix()))keys.add(key);}for(const key of keys){try{const stored=JSON.parse(this.draftCache.get(key)??localStorage.getItem(key)!),note=stored.note??stored;if(typeof note.id==='string'&&typeof note.html==='string')result.push({key,note,baseRevision:stored.baseRevision,baseToken:stored.baseToken,ownTokens:stored.ownTokens});}catch{/* Retain malformed originals. */}}return result;}
  private reload=()=>{if(this.pending)return;try{this.emit({notes:readNotes(this.scope),drafts:this.drafts()});}catch(reason){this.emit({error:String(reason)});}};
  private reloadDurable=async()=>{if(this.pending)return;try{const notes=await readDurableDeviceNotes(this.scope);if(!this.pending)this.emit({notes,drafts:this.drafts()});}catch(reason){this.emit({error:String(reason)});}};
  start=()=>{this.ready=Promise.all([this.reloadDurable(),readDeviceDrafts(this.scope.workspaceId??'personal',this.prefix()).then(records=>{for(const record of records){if(!this.draftCache.has(record.key))this.draftCache.set(record.key,record.value);}this.emit({drafts:this.drafts()});})]).then(()=>{}).catch(reason=>{this.emit({error:String(reason)});});const changed=()=>{void this.reloadDurable();};const external=(event:StorageEvent)=>{if(event.key===notesKey(this.scope)||event.key===null)changed();};window.addEventListener('storage',external);window.addEventListener(NOTES_CHANGED,changed);return()=>{window.removeEventListener('storage',external);window.removeEventListener(NOTES_CHANGED,changed);};};
  isSaving=()=>this.pending>0;
  whenReady=()=>this.ready??Promise.resolve();
  whenNoteDurable=async(id:string)=>{await this.ready;let captured:Promise<boolean>|undefined;do{captured=this.queues.get(id);if(captured&&!await captured)throw Error(this.snapshot.error||'The current device edit is not saved.');}while(this.queues.get(id)!==captured);const note=(await readDurableDeviceNotes(this.scope)).find(row=>row.id===id);if(!note)throw Error('The original note is unavailable.');return note;};
  create=async(patch:Partial<StickyNote>={})=>{const note={...newNote(this.snapshot.notes.length),...patch,id:crypto.randomUUID()};const saved=await this.save(note);if(!saved)throw Error(this.snapshot.error||'The note was not saved.');return note.id;};
  change=async(id:string,patch:Partial<StickyNote>,source?:string)=>{const current=this.snapshot.notes.find(note=>note.id===id);if(!current)throw Error('This device note is unavailable.');if(!await this.save({...current,...patch},current.revision,source))throw Error(this.snapshot.error||'The edit was not saved.');};
  save=(note:StickyNote,expectedRevision?:number,source?:string):Promise<boolean>=>{
    const before=this.snapshot.notes.find(row=>row.id===note.id),version=(this.versions.get(note.id)??0)+1,optimistic={...note,writeToken:crypto.randomUUID(),revision:(expectedRevision??0)+1,updatedAt:new Date().toISOString()};this.versions.set(note.id,version);
    if(!this.recoveryBase.has(note.id))this.recoveryBase.set(note.id,{revision:expectedRevision,token:note.writeToken,tokens:new Set()});const base=this.recoveryBase.get(note.id)!;base.tokens.add(optimistic.writeToken);
    const draftKey=this.draftKey(note.id),raw=JSON.stringify({note:optimistic,baseRevision:base.revision??0,baseToken:base.token,ownTokens:[...base.tokens]});this.draftCache.set(draftKey,raw);try{localStorage.setItem(draftKey,raw);}catch{/* Commit the durable outbox before acknowledging this edit. */}
    this.pending++;this.emit({notes:before?this.snapshot.notes.map(row=>row.id===note.id?optimistic:row):[...this.snapshot.notes,optimistic],status:'Saving locally…',drafts:this.drafts()});
    const previous=this.queues.get(note.id)??Promise.resolve(true);
    const operation=previous.then(async success=>{await this.ready;await writeDeviceDraft(this.scope.workspaceId??'personal',draftKey,raw);this.durableDrafts.set(draftKey,raw);if(!success)throw Error('An earlier local save failed. Use Retry local save or export the retained draft.');const rows=await saveNoteSafely(this.scope,optimistic,expectedRevision,note.writeToken);this.acknowledged.set(note.id,rows.find(row=>row.id===note.id)!);this.committedSources.set(note.id,{token:rows.find(row=>row.id===note.id)!.writeToken,source});if(this.versions.get(note.id)===version){await retireDeviceDraft(this.scope.workspaceId??'personal',draftKey,raw);this.draftCache.delete(draftKey);this.durableDrafts.delete(draftKey);this.removeMirror(draftKey,raw);this.recoveryBase.delete(note.id);const saved=rows.find(row=>row.id===note.id)!;const drafts=this.drafts();this.emit({notes:this.snapshot.notes.map(row=>row.id===note.id?saved:row),error:drafts.length?this.snapshot.error:'',status:this.pending>1?'Saving locally…':drafts.length?'Device drafts need review.':'Saved locally on this device.',drafts});}return true;}).catch(reason=>{this.emit({error:reason instanceof Error?reason.message:'The local save failed.',status:'Local save failed. The draft is retained.',drafts:this.drafts()});return false;}).finally(()=>{this.pending--;});
    this.queues.set(note.id,operation);return operation;
  };
  retry=async(id:string,key?:string)=>{
    if(this.pending)throw Error('Wait for current local saves to finish before retrying.');
    const candidates=this.drafts().filter(row=>row.note.id===id),draft=key?candidates.find(row=>row.key===key):candidates.find(row=>row.key===this.draftKey(id))??(candidates.length===1?candidates[0]:undefined);if(!draft){if(candidates.length>1)throw Error('Several retained drafts exist. Choose the exact draft in Notes Manager before retrying.');return;}
    const original=this.draftCache.get(draft.key)??localStorage.getItem(draft.key),latest=draft.note;
    const rows=await readDurableDeviceNotes(this.scope),current=rows.find(note=>note.id===id);
    if(current&&current.writeToken!==draft.baseToken&&!(draft.ownTokens??[]).includes(current.writeToken))throw Error('This note changed in another window. The retained draft is available for export or a separate copy.');
    if(!current&&(draft.baseRevision??0)>0)throw Error('The original note is unavailable. Export the retained draft before making a copy.');
    this.queues.delete(id);this.recoveryBase.delete(id);
    const accepted=await this.save({...latest,writeToken:current?.writeToken??latest.writeToken},current?.revision);
    if(accepted&&original){await retireDeviceDraft(this.scope.workspaceId??'personal',draft.key,original);if(this.draftCache.get(draft.key)===original)this.draftCache.delete(draft.key);this.removeMirror(draft.key,original);}this.emit({drafts:this.drafts()});if(!accepted)throw Error(this.snapshot.error);
  };
  retryFrame=async(id:string,patch:Partial<StickyNote>,expectedToken?:string,source?:string)=>{await this.flushAll();const current=(await readDurableDeviceNotes(this.scope)).find(note=>note.id===id);if(!current||current.deletedAt)throw Error('The original note is unavailable.');if(current.writeToken!==expectedToken&&!(source&&this.committedSources.get(id)?.source===source&&current.writeToken===this.committedSources.get(id)?.token))throw Error('This note changed in another window. Export the retained frame draft before reviewing its original.');this.queues.delete(id);this.recoveryBase.delete(id);if(!await this.save({...current,...patch},current.revision,source))throw Error(this.snapshot.error);return this.whenNoteDurable(id);};
  private removeMirror(key:string,raw:string){try{if(localStorage.getItem(key)===raw)localStorage.removeItem(key);}catch{/* A stale compatibility mirror can be recovered separately. */}}
  flushAll=()=>Promise.allSettled([...this.queues.values()]);
  prepareToClose=async()=>{let captured:Promise<boolean>[];do{captured=[...this.queues.values()];await Promise.allSettled(captured);}while([...this.queues.values()].some(promise=>!captured.includes(promise)));for(const id of this.versions.keys()){const key=this.draftKey(id),raw=this.draftCache.get(key);if(raw&&this.durableDrafts.get(key)!==raw)throw Error('A device draft is not saved yet. Retry or export it before closing.');}};
}
const repositories=new Map<string,{session:DeviceNotesSession;references:number;stop?:()=>void}>();
export async function prepareDeviceNotesToClose(userId:string){await Promise.all([...repositories].filter(([key])=>key.startsWith(`kanban:${userId}:`)).map(([,entry])=>entry.session.prepareToClose()));}
export function deviceNotesRepository(scope:StorageScope){const key=notesKey(scope);let owner=repositories.get(key);if(!owner){owner={session:new DeviceNotesSession(scope),references:0};repositories.set(key,owner);}const entry=owner;return{session:entry.session,acquire(){if(++entry.references===1)entry.stop=entry.session.start();let released=false;return()=>{if(released)return;released=true;if(--entry.references===0){entry.stop?.();void entry.session.flushAll().finally(()=>{if(!entry.references)repositories.delete(key);});}};}};}
