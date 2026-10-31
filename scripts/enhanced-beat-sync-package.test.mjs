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
function fixture(owner={native:'owner',nativeAudio:false}){
 const view={active:false,window:'normal'},messages=[],watches=[];let sync;
 const session={id:'source',src:'https://music.youtube.com/watch?v=abcdefghijk',source:'music.youtube.com',tabId:12,documentId:'document',index:0,playing:true,paused:false,
  playbackRate:1,currentTime:10,sampledAt:Date.now(),generation:1,mediaFacts:{kind:'audio-only',singleSource:true,noVideo:true,noFrames:true}};
 const api={runtime:{getURL:name=>'chrome-extension://companion/'+name,getContexts:async()=>[{}],sendMessage:async message=>{
   messages.push(message);if(message.kind==='start')queueMicrotask(()=>sync.offscreen({kind:'audible',captureId:message.captureId},{url:'chrome-extension://companion/offscreen.html'}));
   return {ok:true,calibration:{samples:64,p95Ms:240,p99Ms:250}};}},
  tabs:{sendMessage:async(_tab,message)=>{watches.push(message);return {ok:true};},get:async()=>({active:view.active,windowId:1})},windows:{get:async()=>({state:view.window})},
  offscreen:{closeDocument:async()=>{}},tabCapture:{getMediaStreamId:async()=>'stream',getCapturedTabs:async()=>[{tabId:12,status:'active'}]},
  scripting:{executeScript:async()=>[]},alarms:{create(){},clear(){},onAlarm:{addListener(){}}}};
 sync=createBeatSync(api,()=>{});
 return {sync,session,owner,messages,view,
  clock(patch){sync.clock({token:watches.find(m=>m.kind==='watch').token,valid:true,clock:{...session,...patch,sampledAt:Date.now()}},{tab:{id:12},documentId:'document'});},
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
test('an approved delay is re-applied after a seek restarts capture, without another pause',async()=>{
 const f=fixture();try{
  await f.start();await f.approveWhilePaused();assert.equal(f.sync.status(f.session).capability.bufferMs,170);
  const firstCapture=f.sync.status(f.session).captureId;
  await f.seek();
  const status=f.sync.status(f.session);assert.notEqual(status.captureId,firstCapture,'The seek restarted capture.');
  assert.equal(status.capability.bufferMs,170,'The standing approval re-applied the delay.');
  const restore=f.messages.filter(m=>m.kind==='synchronization'&&m.captureId===status.captureId).at(-1);
  assert.equal(restore.settings.bufferMs,170);assert.equal(restore.settings.resume,true);assert.equal(restore.settings.flush,true);
 }finally{await f.sync.stop();}
});
test('turning Enhanced Beat Sync off clears the standing approval',async()=>{
 const f=fixture();try{
  await f.start();await f.approveWhilePaused();
  assert.equal(await f.sync.configure(f.session,f.owner,f.config(false)),true);assert.equal(f.sync.status(f.session).capability.bufferMs,0);
  await f.seek();await tick(200);assert.equal(f.sync.status(f.session).capability.bufferMs,0);
 }finally{await f.sync.stop();}
});
test('a standing approval is not applied while the source is ineligible',async()=>{
 const f=fixture();try{
  await f.start();await f.approveWhilePaused();
  f.session.mediaFacts={kind:'video',singleSource:true,noVideo:false,noFrames:true};f.view.active=true;await tick(550);f.clock({});await tick();f.clock({});await tick();
  assert.equal(f.sync.status(f.session).capability.bufferMs,0,'A visible video revokes the delay.');
  await f.seek();await tick(200);assert.equal(f.sync.status(f.session).capability.bufferMs,0,'It stays off while the video is visible.');
 }finally{await f.sync.stop();}
});
