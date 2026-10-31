import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
let root,createBeatSync;
before(async()=>{
 root=await mkdtemp(resolve('scratch/source-delay-test-'));
 const built=spawnSync(process.execPath,['scripts/package-music-extension.mjs','--source-audio-delay','--output-root='+join(root,'candidate')],{encoding:'utf8',timeout:30000});assert.equal(built.status,0,built.stderr);
 ({createBeatSync}=await import(pathToFileURL(join(root,'candidate/extension/beat-sync.js'))));
});
after(async()=>{if(root){assert.ok(root.startsWith(resolve('scratch')+sep));await rm(root,{recursive:true,force:true});}});
function fixture(owner={native:'owner',nativeAudio:false},patch={}){
 // The video tab is in the background by default; tests reveal it by making it the active tab.
 const view={active:false,window:'normal'};
 const messages=[],watches=[],events=[];let sync;
 const session={id:'source',src:'https://www.youtube.com/watch?v=abcdefghijk',source:'www.youtube.com',tabId:12,documentId:'document',index:0,playing:true,paused:false,playbackRate:1,currentTime:10,sampledAt:Date.now(),generation:1,mediaFacts:{kind:'video',singleSource:true,noVideo:false,noFrames:true},...patch};
 const api={runtime:{getURL:name=>'chrome-extension://candidate/'+name,getContexts:async()=>[{}],sendMessage:async message=>{
  messages.push(message);if(message.kind==='start')queueMicrotask(()=>sync.offscreen({kind:'audible',captureId:message.captureId},{url:'chrome-extension://candidate/offscreen.html'}));return {ok:true,calibration:{samples:64,p95Ms:240,p99Ms:250}};
 }},tabs:{sendMessage:async(_tab,message)=>{watches.push(message);return {ok:true};},get:async()=>({active:view.active,windowId:1})},windows:{get:async()=>({state:view.window})},offscreen:{closeDocument:async()=>{}},tabCapture:{getMediaStreamId:async()=>'stream',getCapturedTabs:async()=>[{tabId:12,status:'active'}]},scripting:{executeScript:async()=>[]}};
 sync=createBeatSync(api,(_owner,event)=>events.push(event));
 return {sync,session,owner,messages,events,view,
  async start(){await sync.start(session,owner,'subscription');if(!owner.nativeAudio&&!session.protectedMedia&&session.asset?.provider!=='spotify'){const until=Date.now()+1000;while(sync.status(session).mode!=='capture'&&Date.now()<until)await new Promise(done=>setTimeout(done,5));assert.equal(sync.status(session).mode,'capture');}
   // Live clock samples arrive every 100 ms; let the first browser tab-state check settle.
   this.clock({});await new Promise(done=>setTimeout(done,20));},
  clock(patch){sync.clock({token:watches.find(m=>m.kind==='watch').token,valid:true,clock:{...session,...patch,sampledAt:Date.now()}},{tab:{id:12},documentId:'document'});},
  config(){return {enabled:true,captureId:sync.status(session).captureId,generation:1,compensationMs:170,intentionalDelay:true,outputHeard:true,authorizedAudio:true,preview:true};}};
}
test('candidate excludes research assets and preserves the normal web and Windows paths',async()=>{
 const manifest=JSON.parse(await readFile(join(root,'candidate/extension/manifest.json'),'utf8'));assert.equal(manifest.version,'0.3.29');
 const provenance=JSON.parse(await readFile(join(root,'candidate/extension/SOURCE-AUDIO-DELAY-PROVENANCE.json'),'utf8'));
 for(const file of provenance.files)assert.equal(createHash('sha256').update(await readFile(join(root,'candidate/extension',file.name))).digest('hex'),file.outputSha256,'Final package provenance must include all later public stripping.');
 const names=JSON.parse(await readFile(join(root,'candidate/package-files.json'),'utf8'));
 assert.ok(!names.some(name=>/live-diagnostic-recorder|early-percussion-classifier|generated\/hybrid\/|soxr/.test(name)));
 assert.match(await readFile(join(root,'candidate/extension/beat-candidate.js'),'utf8'),/privateBeatCandidate = false/);
 for(const owner of [{native:'owner',nativeAudio:true},{tabId:42,documentId:'web'}]){
  const f=fixture(owner);try{await f.start();assert.equal(f.sync.status(f.session).capability,undefined);assert.ok(f.messages.every(m=>m.kind!=='start'||m.candidate!==true));assert.equal(await f.sync.configure(f.session,owner,f.config()),false);}finally{await f.sync.stop();}
 }
});
test('source delay is OFF initially, needs paused exact consent and supports immediate OFF while playing',async()=>{
 const f=fixture();try{
  await f.start();assert.equal(f.sync.status(f.session).capability.bufferMs,0);assert.equal(f.sync.status(f.session).capability.allowTypedPreview,false);
  assert.equal(await f.sync.configure(f.session,f.owner,f.config()),false);f.clock({paused:true,playing:false});
  assert.equal(await f.sync.configure(f.session,f.owner,{...f.config(),authorizedAudio:false}),false);
  assert.equal(await f.sync.configure(f.session,f.owner,f.config()),true);assert.equal(f.sync.status(f.session).capability.bufferMs,170);
  f.clock({paused:false,playing:true});assert.equal(await f.sync.configure(f.session,f.owner,{...f.config(),enabled:false,preview:false,compensationMs:0}),true);assert.equal(f.sync.status(f.session).capability.bufferMs,0);
 }finally{await f.sync.stop();}
});
test('source delay rejects research modes, foreign owners, stale generations and protected sources',async()=>{
 const f=fixture();try{
  await f.start();f.clock({paused:true,playing:false});
  for(const change of [{live:true},{detectorVariant:'L1-gap0'},{detectorVariant:'H-LIVE'},{compensationMs:500},{generation:2}])assert.equal(await f.sync.configure(f.session,f.owner,{...f.config(),...change}),false);
  assert.equal(await f.sync.configure(f.session,{native:'foreign',nativeAudio:false},f.config()),false);
  assert.equal(await f.sync.configure(f.session,f.owner,f.config()),true);f.clock({seeking:true,currentTime:40,generation:2,playing:true,paused:false});assert.equal(f.sync.status(f.session).capability.bufferMs,0);
 }finally{await f.sync.stop();}
 for(const patch of [{protectedMedia:true},{asset:{provider:'spotify',id:'track'}}]){const denied=fixture(undefined,patch);try{await denied.start();assert.ok(!denied.messages.some(m=>m.kind==='start'));assert.equal(await denied.sync.configure(denied.session,denied.owner,denied.config()),false);}finally{await denied.sync.stop();}}
});
test('source delay never trails a visible video picture and revokes when the video tab is revealed while playing',async()=>{
 const tick=()=>new Promise(done=>setTimeout(done,20)),settle=async f=>{for(let i=0;i<30&&(await tick(),true);i++)f.clock({});};
 for(const reveal of [{active:true,window:'normal'}]){
  const visible=fixture();Object.assign(visible.view,reveal);try{
   await visible.start();visible.clock({paused:true,playing:false});await new Promise(done=>setTimeout(done,550));visible.clock({paused:true,playing:false});await tick();
   assert.equal(await visible.sync.configure(visible.session,visible.owner,visible.config()),false);
  }finally{await visible.sync.stop();}
 }
 const f=fixture();try{
  await f.start();f.clock({paused:true,playing:false});await tick();assert.equal(await f.sync.configure(f.session,f.owner,f.config()),true);
  f.clock({paused:false,playing:true});assert.equal(f.sync.status(f.session).capability.bufferMs,170);
  f.view.active=true;await new Promise(done=>setTimeout(done,550));f.clock({paused:false,playing:true});await tick();f.clock({paused:false,playing:true});
  assert.equal(f.sync.status(f.session).capability.bufferMs,0);
 }finally{await f.sync.stop();}
 const minimized=fixture();Object.assign(minimized.view,{active:true,window:'minimized'});try{
  await minimized.start();minimized.clock({paused:true,playing:false});await tick();
  assert.equal(await minimized.sync.configure(minimized.session,minimized.owner,minimized.config()),true);
 }finally{await minimized.sync.stop();}
});
test('candidate output fades before capture release and reads tab visibility from the browser',async()=>{
 const engine=await readFile(join(root,'candidate/extension/capture-engine.js'),'utf8');
 assert.match(engine,/source-delay-audio-output\.js/);assert.match(engine,/outputReleased\.then\(release,release\)/);
 const sync=await readFile(join(root,'candidate/extension/beat-sync.js'),'utf8');
 assert.match(sync,/hidden:current\.tabHidden===true/);assert.match(sync,/state==='minimized'/);
});
