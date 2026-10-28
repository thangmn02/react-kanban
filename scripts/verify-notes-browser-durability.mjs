/** Real IndexedDB transactions, concurrent tabs, interruption and retained outbox proof. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import ts from 'typescript';

const output='scratch/notes-completion-261027-1806/browser-durability';await mkdir(output,{recursive:true});
const source=await readFile('src/features/notes/notes-browser-storage.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const script=`window.exports={};${compiled};window.store=window.exports;`;
const server=createServer((_request,response)=>{response.writeHead(200,{'Content-Type':'text/html'});response.end('<!doctype html><title>Isolated Notes storage qualification</title>');});
let browser;const results=[];
try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(1439,'127.0.0.1',resolve);});
  await writeFile(`${output}/process.json`,JSON.stringify({command:process.argv,pid:process.pid,port:1439,startedAt:new Date().toISOString(),worktree:process.cwd()},null,2));
  browser=await chromium.launch({headless:true});const context=await browser.newContext();
  const open=async()=>{const page=await context.newPage();await page.goto('http://127.0.0.1:1439');await page.addScriptTag({content:script});return page;};
  let page=await open();
  const note={id:crypto.randomUUID(),title:'Original',html:'<p>Before edit</p>',checklist:[],revision:1,writeToken:crypto.randomUUID(),updatedAt:new Date().toISOString(),width:310,height:360,x:0,y:0};
  const key='kanban:qualification:personal:notes-preview:v1';
  await page.evaluate(async({key,note})=>{await store.readBrowserNotes(key,()=>[note]);}, {key,note});
  const next={...note,title:'Acknowledged edit',writeToken:crypto.randomUUID()};
  const saved=await page.evaluate(async({key,note,next})=>store.saveBrowserNote(key,next,1,note.writeToken,()=>[]),{key,note,next});assert.equal(saved[0].revision,2);
  await page.close();page=await open();
  const recovered=await page.evaluate(async key=>store.readBrowserNotes(key,()=>{throw Error('Legacy unavailable');}),key);assert.equal(recovered[0].title,next.title);
  const history=await page.evaluate(async({key,id})=>store.browserNoteHistory(key,id),{key,id:note.id});assert.equal(history[0].note.title,'Original');results.push('Acknowledged canonical content and before-image survive tab destruction without a legacy cache.');
  const other=await open(),left={...recovered[0],title:'Concurrent left',writeToken:crypto.randomUUID()},right={...recovered[0],title:'Concurrent right',writeToken:crypto.randomUUID()};
  // Supply the predecessor explicitly in both tabs; IndexedDB serializes the CAS.
  const concurrent=await Promise.allSettled([page,other].map((tab,index)=>tab.evaluate(async({key,next,token})=>store.saveBrowserNote(key,next,2,token,()=>[]),{key,next:index?right:left,token:recovered[0].writeToken})));
  assert.equal(concurrent.filter(result=>result.status==='fulfilled').length,1);results.push('Two tabs competing for one revision produce one commit and one retained conflict.');
  const actual=(await page.evaluate(async key=>store.readBrowserNotes(key,()=>[]),key))[0];
  const retry=await page.evaluate(async({key,actual})=>store.saveBrowserNote(key,actual,2,'previous-token',()=>[]),{key,actual});assert.equal(retry[0].revision,3);results.push('Retry after an ambiguous response returns the same operation without an extra revision.');
  const draftKey=`kora:notes-draft:qualification:personal:${note.id}:writer`,draft='retained interrupted draft',changed='newer retained draft';
  await page.evaluate(async({draftKey,draft})=>store.writeBrowserDraft(draftKey,draft),{draftKey,draft});await page.close();page=await open();
  assert.equal((await page.evaluate(()=>store.readBrowserDrafts('kora:notes-draft:qualification:personal:')))[0].value,draft);
  await page.evaluate(async({draftKey,changed})=>store.writeBrowserDraft(draftKey,changed),{draftKey,changed});assert.equal(await page.evaluate(async({draftKey,draft})=>store.removeBrowserDraft(draftKey,draft),{draftKey,draft}),false);results.push('Outbox survives interruption; conditional retirement preserves a newer draft.');
  const aborted=await page.evaluate(async({key,actual})=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='scopes'){this.transaction.abort();throw Error('Injected disk transaction failure');}return original.apply(this,args);};try{await store.saveBrowserNote(key,{...actual,title:'Must not commit',writeToken:crypto.randomUUID()},3,actual.writeToken,()=>[]);return false;}catch{return true;}finally{IDBObjectStore.prototype.put=original;}},{key,actual});assert.equal(aborted,true);
  await page.close();page=await open();assert.equal((await page.evaluate(async key=>store.readBrowserNotes(key,()=>[]),key))[0].title,actual.title);
  const afterHistory=await page.evaluate(async({key,id})=>store.browserNoteHistory(key,id),{key,id:note.id});assert.equal(afterHistory.length,2);results.push('An aborted content transaction commits neither content nor a phantom history revision.');
  assert.deepEqual(await page.evaluate(()=>store.readBrowserDrafts('kora:notes-draft:another-account:')),[]);assert.deepEqual(await page.evaluate(()=>store.readBrowserNotes('kanban:other:personal:notes-preview:v1',()=>[])),[]);results.push('Canonical documents and drafts remain separated by account and destination.');
  await writeFile(`${output}/results.json`,JSON.stringify({at:new Date().toISOString(),results},null,2));console.log(JSON.stringify({groups:results.length,passed:true}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
