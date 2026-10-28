import type { StickyNote } from './notes-store';

const databaseName='kora-workflow-storage';
type StoredScope={key:string;notes:StickyNote[]};
type StoredDraft={key:string;value:string};
export type DeviceNoteRevision={key:string;noteKey:string;note:StickyNote;savedAt:string};
function openDatabase(){return new Promise<IDBDatabase>((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(Error('Transactional device storage is unavailable. Existing notes are retained.'));return;}
  const request=indexedDB.open(databaseName,1);let unavailable=false;
  request.onupgradeneeded=()=>{const database=request.result;database.createObjectStore('scopes',{keyPath:'key'});database.createObjectStore('drafts',{keyPath:'key'});const revisions=database.createObjectStore('revisions',{keyPath:'key'});revisions.createIndex('note','noteKey');database.createObjectStore('records',{keyPath:'key'});};
  request.onerror=()=>reject(Error('Device storage could not open. Your originals are retained.'));request.onblocked=()=>{unavailable=true;reject(Error('Another tab is blocking the device storage upgrade. Close older Kora tabs and retry.'));};request.onsuccess=()=>{if(unavailable)request.result.close();else resolve(request.result);};
});}
function transact<T>(database:IDBDatabase,stores:string[],mode:IDBTransactionMode,operation:(transaction:IDBTransaction,accept:(value:T)=>void,reject:(reason:Error)=>void)=>void){return new Promise<T>((resolve,reject)=>{
  const transaction=database.transaction(stores,mode,{durability:'strict'});let result:T;
  const fail=(reason:Error)=>{try{transaction.abort();}catch{/* Already ended. */}reject(reason);};
  transaction.oncomplete=()=>resolve(result);transaction.onerror=transaction.onabort=()=>reject(Error('The device storage transaction failed. Your draft is retained.'));
  try{operation(transaction,value=>{result=value;},fail);}catch(reason){fail(reason instanceof Error?reason:Error('Device storage failed.'));}
});}
export async function readBrowserNotes(key:string,originals:()=>StickyNote[]):Promise<StickyNote[]>{
  const database=await openDatabase();try{return await transact<StickyNote[]>(database,['scopes'],'readwrite',(transaction,accept,reject)=>{const store=transaction.objectStore('scopes'),request=store.get(key);request.onsuccess=()=>{try{const current=request.result as StoredScope|undefined;if(current){accept(current.notes);return;}const notes=originals();store.add({key,notes} satisfies StoredScope);accept(notes);}catch(reason){reject(reason instanceof Error?reason:Error('The original device notes are unreadable.'));}};});}finally{database.close();}
}
export async function saveBrowserNote(key:string,note:StickyNote,revision:number|undefined,token:string,originals:()=>StickyNote[]):Promise<StickyNote[]>{
  const database=await openDatabase();try{return await transact<StickyNote[]>(database,['scopes','revisions'],'readwrite',(transaction,accept,reject)=>{const store=transaction.objectStore('scopes'),request=store.get(key);request.onsuccess=()=>{try{
    const rows=(request.result as StoredScope|undefined)?.notes??originals(),current=rows.find(row=>row.id===note.id);
    if(current?.writeToken===note.writeToken&&note.writeToken!==token){accept(rows);return;}
    if(current&&revision===undefined)throw Error('This note already exists. Reopen its acknowledged version before editing.');
    if(revision!==undefined&&(current?.revision!==revision||current?.writeToken!==token))throw Error('This note changed in another window. The device draft is retained.');
    if(note.title.length>160||note.html.length>60000||note.checklist.length>100||!current&&rows.length>=500)throw Error('The note exceeds its device storage limits.');
    const next={...note,width:Math.max(260,Math.min(900,note.width)),height:Math.max(280,Math.min(900,note.height)),x:Math.max(0,note.x),y:Math.max(0,note.y),writeToken:note.writeToken===current?.writeToken?crypto.randomUUID():note.writeToken,revision:(current?.revision??0)+1,updatedAt:new Date().toISOString()};
    const notes=current?rows.map(row=>row.id===note.id?next:row):[...rows,next];if(JSON.stringify(notes).length>4_000_000)throw Error('This device Notes scope exceeds 4 MB. Export or shorten notes before saving.');
    if(current&&JSON.stringify({title:current.title,html:current.html,checklist:current.checklist})!==JSON.stringify({title:next.title,html:next.html,checklist:next.checklist}))transaction.objectStore('revisions').put({key:JSON.stringify([key,current.id,current.revision,current.writeToken]),noteKey:JSON.stringify([key,current.id]),note:current,savedAt:new Date().toISOString()} satisfies DeviceNoteRevision);
    store.put({key,notes} satisfies StoredScope);accept(notes);
  }catch(reason){reject(reason instanceof Error?reason:Error('The note was not saved.'));}};});}finally{database.close();}
}
export async function writeBrowserDraft(key:string,value:string){
  const database=await openDatabase();try{await transact<void>(database,['drafts'],'readwrite',(transaction,accept)=>{transaction.objectStore('drafts').put({key,value} satisfies StoredDraft);accept();});}finally{database.close();}
}
export async function readBrowserDrafts(prefix:string){
  const database=await openDatabase();try{return await transact<StoredDraft[]>(database,['drafts'],'readonly',(transaction,accept)=>{const request=transaction.objectStore('drafts').getAll(IDBKeyRange.bound(prefix,prefix+'\uffff'));request.onsuccess=()=>accept(request.result);});}finally{database.close();}
}
export async function removeBrowserDraft(key:string,expected:string){
  const database=await openDatabase();try{return await transact<boolean>(database,['drafts'],'readwrite',(transaction,accept)=>{const store=transaction.objectStore('drafts'),request=store.get(key);request.onsuccess=()=>{const current=request.result as StoredDraft|undefined,matched=!current||current.value===expected;if(current&&matched)store.delete(key);accept(matched);};});}finally{database.close();}
}
export async function browserNoteHistory(key:string,noteId:string){
  const database=await openDatabase();try{return await transact<DeviceNoteRevision[]>(database,['revisions'],'readonly',(transaction,accept)=>{const request=transaction.objectStore('revisions').index('note').getAll(JSON.stringify([key,noteId]));request.onsuccess=()=>accept((request.result as DeviceNoteRevision[]).sort((a,b)=>b.note.revision-a.note.revision));});}finally{database.close();}
}
/** Small workflow records contain Saved references and task comments, not another Notes document store. */
export async function browserWorkflowRecord<T>(key:string,update?:(previous:T|undefined)=>T):Promise<T|undefined>{
  const database=await openDatabase();try{return await transact<T|undefined>(database,['records'],update?'readwrite':'readonly',(transaction,accept,reject)=>{const store=transaction.objectStore('records'),request=store.get(key);request.onsuccess=()=>{try{const previous=request.result?.value as T|undefined,next=update?update(previous):previous;if(update)store.put({key,value:next});accept(next);}catch(reason){reject(reason instanceof Error?reason:Error('The workflow record was not saved.'));}};});}finally{database.close();}
}
