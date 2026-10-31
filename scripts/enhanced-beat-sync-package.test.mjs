import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,join,sep,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareSourceAudioDelay} from './source-audio-delay-package.mjs';
import {prepareEnhancedBeatSync,enhancedBeatSyncVersion} from './enhanced-beat-sync-package.mjs';

let root,createBeatSync,manifest;
before(async()=>{
 root=await mkdtemp(resolve('scratch/enhanced-beat-sync-test-'));
 const source='extensions/kanban-music/',files=[];
 for(const name of await readdir(source))if(name.endsWith('.js')&&!name.endsWith('.test.js')||name==='manifest.json')files.push({name,bytes:await readFile(source+name)});
 prepareSourceAudioDelay(files);prepareEnhancedBeatSync(files);
 for(const file of files){const target=join(root,file.name);await mkdir(dirname(target),{recursive:true});await writeFile(target,file.bytes);}
 manifest=JSON.parse(files.find(file=>file.name==='manifest.json').bytes);
 ({createBeatSync}=await import(pathToFileURL(join(root,'beat-sync.js'))));
});
after(async()=>{if(root){assert.ok(root.startsWith(resolve('scratch')+sep));await rm(root,{recursive:true,force:true});}});

const tick=(ms=20)=>new Promise(done=>setTimeout(done,ms));
function fixture(owner={native:'owner',nativeAudio:false},{refuseResume=false}={}){
 const view={active:false,window:'normal'},messages=[],watches=[];let sync;
 const session={id:'source',src:'https://music.youtube.com/watch?v=abcdefghijk',source:'music.youtube.com',tabId:12,documentId:'document',index:0,playing:true,paused:false,
  playbackRate:1,currentTime:10,sampledAt:Date.now(),generation:1,mediaFacts:{kind:'audio-only',singleSource:true,noVideo:true,noFrames:true}};
 const api={runtime:{getURL:name=>'chrome-extension://companion/'+name,getContexts:async()=>[{}],sendMessage:async message=>{
   messages.push(message);if(message.kind==='start')queueMicrotask(()=>sync.offscreen({kind:'audible',captureId:message.captureId},{url:'chrome-extension://companion/offscreen.html'}));
   if(refuseResume&&message.kind==='synchronization'&&message.settings?.resume===true)return {ok:false};
   return {ok:true,calibration:{samples:64,p95Ms:240,p99Ms:250}};}},
  tabs:{sendMessage:async(_tab,message)=>{watches.push(message);return {ok:true};},get:async()=>({active:view.active,windowId:1})},windows:{get:async()=>({state:view.window})},
  offscreen:{closeDocument:async()=>{}},tabCapture:{getMediaStreamId:async()=>'stream',getCapturedTabs:async()=>[{tabId:12,status:'active'}]},
  scripting:{executeScript:async()=>[]},alarms:{create(){},clear(){},onAlarm:{addListener(){}}}};
 sync=createBeatSync(api,()=>{});
 return {sync,session,owner,messages,view,watch:()=>watches.filter(m=>m.kind==='watch').at(-1),
  clock(patch){sync.clock({token:watches.filter(m=>m.kind==='watch').at(-1).token,valid:true,clock:{...session,...patch,sampledAt:Date.now()}},{tab:{id:12},documentId:'document'});},
  async start(){await sync.start(session,owner,'subscription');const until=Date.now()+1000;while(sync.status(session).mode!=='capture'&&Date.now()<until)await tick(5);
   assert.equal(sync.status(session).mode,'capture');this.clock({});await tick();},
  config(enabled=true){const status=sync.status(session);return enabled?{enabled:true,captureId:status.captureId,generation:status.capability?.generation??1,compensationMs:170,intentionalDelay:true,outputHeard:true,authorizedAudio:true,preview:true}
   :{enabled:false,captureId:status.captureId,generation:1,compensationMs:0,preview:false};},
  async approveWhilePaused(){this.clock({paused:true,playing:false});await tick();assert.equal(await sync.configure(session,owner,this.config()),true);this.clock({paused:false,playing:true});await tick();},
  async seek(){this.clock({seeking:true,currentTime:60,generation:2});await tick();this.clock({seeking:false,currentTime:60.1,generation:2});
   const until=Date.now()+1500;while(Date.now()<until&&!(sync.status(session).mode==='capture'&&sync.status(session).capability?.bufferMs>0))await tick(10);this.clock({currentTime:60.2,generation:2});await tick();}};
}

test('the public Companion is versioned for release and keeps web owners on the normal path',async()=>{
 assert.equal(manifest.version,enhancedBeatSyncVersion);assert.equal(manifest.name,'Kora Music Companion');assert.equal(manifest.version_name,undefined);
 const f=fixture({tabId:42,documentId:'web'});try{await f.start();assert.equal(f.sync.status(f.session).capability,undefined);assert.equal(await f.sync.configure(f.session,f.owner,f.config()),false);}finally{await f.sync.stop();}
});
const restarted=async(f,first)=>{const until=Date.now()+1500;while(Date.now()<until&&!(f.sync.status(f.session).mode==='capture'&&f.sync.status(f.session).captureId!==first))await tick(10);await tick(100);};
async function seekOnly(f){const first=f.sync.status(f.session).captureId;f.clock({seeking:true,currentTime:60,generation:2});await tick();f.clock({seeking:false,currentTime:60.1,generation:2});await restarted(f,first);return first;}
test('after a seek the Companion re-applies the approved delay at the boundary, in the two steps its engine accepts',async()=>{
 const f=fixture();try{
  await f.start();await f.approveWhilePaused();
  const first=await seekOnly(f),status=f.sync.status(f.session);
  assert.notEqual(status.captureId,first);assert.equal(status.capability.bufferMs,170,'Restored at the boundary without a pause.');
  const steps=f.messages.filter(m=>m.kind==='synchronization'&&m.captureId===status.captureId).map(m=>({paused:m.settings.paused,resume:m.settings.resume===true,bufferMs:m.settings.bufferMs}));
  assert.deepEqual(steps.slice(-2),[{paused:true,resume:false,bufferMs:170},{paused:false,resume:true,bufferMs:170}]);
  const starts=f.messages.filter(m=>m.kind==='start').length;await tick(400);assert.equal(f.messages.filter(m=>m.kind==='start').length,starts,'Capture is stable.');
 }finally{await f.sync.stop();}
});
test('a refused boundary restore falls back to normal output once, without restarting capture in a loop',async()=>{
 const f=fixture(undefined,{refuseResume:true});try{
  await f.start();await f.approveWhilePaused();
  await seekOnly(f);const status=f.sync.status(f.session);assert.equal(status.mode,'capture');assert.equal(status.capability.bufferMs,0);
  const starts=f.messages.filter(m=>m.kind==='start').length;await tick(500);
  assert.equal(f.messages.filter(m=>m.kind==='start').length,starts,'No restart loop.');
  assert.equal(f.messages.filter(m=>m.kind==='synchronization'&&m.captureId===status.captureId&&m.settings.bufferMs===0).length,1,'One fallback to normal output.');
 }finally{await f.sync.stop();}
});
test('turning Enhanced Beat Sync off clears the standing approval',async()=>{
 const f=fixture();try{
  await f.start();await f.approveWhilePaused();
  assert.equal(await f.sync.configure(f.session,f.owner,f.config(false)),true);assert.equal(f.sync.status(f.session).capability.bufferMs,0);
  await seekOnly(f);await tick(200);assert.equal(f.sync.status(f.session).capability.bufferMs,0);
 }finally{await f.sync.stop();}
});
test('a standing approval is not applied while the source is ineligible',async()=>{
 const f=fixture();try{
  await f.start();await f.approveWhilePaused();
  f.session.mediaFacts={kind:'video',singleSource:true,noVideo:false,noFrames:true};f.view.active=true;await tick(550);f.clock({});await tick();f.clock({});await tick();
  assert.equal(f.sync.status(f.session).capability.bufferMs,0,'A visible video revokes the delay.');
  await seekOnly(f);await tick(200);assert.equal(f.sync.status(f.session).capability.bufferMs,0,'It stays off while the video is visible.');
 }finally{await f.sync.stop();}
});
test('a track change that swaps the media source in the same tab keeps the approval',async()=>{
 const f=fixture();try{
  await f.start();await f.approveWhilePaused();assert.equal(f.sync.status(f.session).capability.bufferMs,170);
  const next={...f.session,src:'https://music.youtube.com/watch?v=lmnopqrstuv',currentTime:0,generation:2};
  await f.sync.start(next,f.owner,'subscription');
  const until=Date.now()+1500;while(Date.now()<until&&!(f.sync.status(next).mode==='capture'&&f.sync.status(next).capability?.bufferMs>0)){
   f.sync.clock({token:f.watch().token,valid:true,clock:{...next,sampledAt:Date.now()}},{tab:{id:12},documentId:'document'});await tick(20);}
  assert.equal(f.sync.status(next).capability.bufferMs,170,'The successor state re-applied the approved delay.');
 }finally{await f.sync.stop();}
});
