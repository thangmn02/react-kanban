import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {prepareNativeCompanionDelay,assertNativeDelayGuide} from './native-companion-delay-package.mjs';

const names=['beat-sync.js','beat-mode.js','widget-bridge.js','beat-telemetry.js','beat-timing.js','protocol.js','media-asset.js','companion-update.js','beat-candidate.js'];
const input=()=>Promise.all(names.map(async name=>({name,bytes:await readFile(new URL('../extensions/kanban-music/'+name,import.meta.url))})));
test('private transformation is hash-bound, atomic and leaves unrelated files unchanged',async()=>{
  const files=await input(),before=files.map(file=>Buffer.from(file.bytes));
  files[0].bytes=Buffer.concat([files[0].bytes,Buffer.from('\n// unrelated edit')]);
  assert.throws(()=>prepareNativeCompanionDelay(files),/input changed/);
  for(let i=1;i<files.length;i++)assert.deepEqual(files[i].bytes,before[i]);
  const valid=await input();const proof=prepareNativeCompanionDelay(valid);assert.equal(proof.files.length,3);
  for(let i=3;i<valid.length;i++)assert.deepEqual(valid[i].bytes,before[i]);
});
test('final packaged guide preserves personal installations and an existing output is never overwritten',async()=>{
  const scratch=resolve('scratch'),root=await mkdtemp(join(scratch,'native-delay-guide-')),output=join(root,'candidate');
  assert.ok(root.startsWith(scratch+sep));
  try{
    const args=['scripts/package-music-extension.mjs','--private','--native-delay','--output-root='+output];
    const result=spawnSync(process.execPath,args,{encoding:'utf8',timeout:30000});assert.equal(result.status,0,result.stderr);
    const guide=await readFile(join(output,'Private listening guide.html'),'utf8');assertNativeDelayGuide(guide);
    const archive=await readFile(join(output,'kora-music-companion.zip'));
    for(const name of ['README.txt','ADTOF-LICENSE.txt','ONNX-RUNTIME-LICENSE.txt','ONNX-RUNTIME-NOTICES.txt','adtof-model-provenance.json']){
      const source=await readFile(join('public','third-party',name));
      assert.deepEqual(await readFile(join(output,'extension','third-party',name)),source);
      assert.ok(archive.includes(source),'The complete notice must also accompany the ZIP.');
    }
    const provenance=JSON.parse(await readFile(join(output,'extension/third-party/adtof-model-provenance.json'),'utf8'));
    assert.equal(createHash('sha256').update(await readFile(join(output,'extension/generated/percussion/percussion.onnx'))).digest('hex'),provenance.modelSha256);
    assert.equal(provenance.allWeightsAccountedFor,true);assert.equal(provenance.initializers.length,35);
    assert.throws(()=>assertNativeDelayGuide(guide+'Reload this unpacked extension'));
    assert.notEqual(spawnSync(process.execPath,args,{encoding:'utf8',timeout:30000}).status,0);
    assert.equal(await readFile(join(output,'Private listening guide.html'),'utf8'),guide);
  }finally{assert.ok(resolve(root).startsWith(scratch+sep));await rm(root,{recursive:true,force:true});}
});

async function fixture(){
  const root=await mkdtemp(join(tmpdir(),'kora-private-delay-'));assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));
  try{
    const files=await input();prepareNativeCompanionDelay(files);
    for(const file of files){const bytes=file.name==='beat-candidate.js'?file.bytes.toString().replace('privateBeatCandidate = false','privateBeatCandidate = true'):file.bytes;await writeFile(join(root,file.name),bytes);}
    await writeFile(join(root,'package.json'),''+JSON.stringify({type:'module'}));
    const {createBeatSync}=await import(pathToFileURL(join(root,'beat-sync.js')));
    const {createWidgetBridge}=await import(pathToFileURL(join(root,'widget-bridge.js')));
    const messages=[],watches=[],events=[];let sync,failAck=false,captureStarts=0;
    const session={id:'source',src:'https://www.youtube.com/watch?v=abcdefghijk',source:'www.youtube.com',tabId:12,documentId:'media',index:0,playing:true,paused:false,playbackRate:1,currentTime:10,sampledAt:Date.now(),generation:1,mediaFacts:{kind:'video',singleSource:true,noVideo:false,noFrames:true}};
    const api={runtime:{getURL:name=>`chrome-extension://private/${name}`,getContexts:async()=>[{}],sendMessage:async message=>{
      messages.push(message);if(message.kind==='start'){captureStarts++;queueMicrotask(()=>sync.offscreen({kind:'audible',captureId:message.captureId},{url:'chrome-extension://private/offscreen.html'}));}
      if(message.kind==='synchronization'&&failAck){failAck=false;return {ok:false};}return {ok:true,calibration:{samples:64,p95Ms:240,p99Ms:250}};
    }},tabs:{sendMessage:async(_tab,message)=>{watches.push(message);return {ok:true};}},offscreen:{closeDocument:async()=>{}},tabCapture:{getMediaStreamId:async()=> 'stream',getCapturedTabs:async()=>[{tabId:12,status:'active'}]},scripting:{executeScript:async()=>[]}};
    sync=createBeatSync(api,(_owner,event)=>events.push(event));
    const owner={native:'native-owner',nativeAudio:false};
    const clock=sample=>sync.clock({token:watches.find(message=>message.kind==='watch').token,valid:true,clock:{...session,...sample,sampledAt:Date.now()}},{tab:{id:12},documentId:'media'});
    const wait=async()=>{const until=Date.now()+1000;while(sync.status(session).mode!=='capture'&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(sync.status(session).mode,'capture');};
    const config=()=>({enabled:true,captureId:sync.status(session).captureId,generation:1,compensationMs:250,intentionalDelay:true,outputHeard:true,authorizedAudio:true,preview:true});
    return {sync,createWidgetBridge,owner,session,messages,events,clock,wait,config,get starts(){return captureStarts;},failNextAck(){failAck=true;},async close(){await sync.stop();assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));await rm(root,{recursive:true,force:true});}};
  }catch(error){assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));await rm(root,{recursive:true,force:true});throw error;}
}
test('native tab owner requires pause and exact consent, retains capture, and can turn delay off while playing',async()=>{
  const f=await fixture();try{
    await f.sync.start(f.session,f.owner,'sub');await f.wait();
    assert.equal(f.sync.status(f.session).capability.compensationEligible,true);
    assert.equal(await f.sync.configure(f.session,f.owner,f.config()),false);
    f.clock({playing:false,paused:true});
    assert.equal(await f.sync.configure(f.session,{...f.owner,native:'another-owner'},f.config()),false);
    assert.equal(await f.sync.configure(f.session,f.owner,{...f.config(),generation:2}),false);
    assert.equal(await f.sync.configure(f.session,f.owner,f.config()),true);
    assert.equal(f.sync.status(f.session).capability.bufferMs,250);
    f.clock({playing:true,paused:false});assert.equal(f.starts,1);
    await f.sync.start(f.session,f.owner,'sub');assert.equal(f.sync.status(f.session).capability.bufferMs,250);
    assert.equal(await f.sync.configure(f.session,f.owner,{...f.config(),enabled:false,preview:false,compensationMs:0}),true);
    assert.equal(f.sync.status(f.session).capability.bufferMs,0);
  }finally{await f.close();}
});
test('native delay rolls back failed acknowledgements and revokes on seek without changing ownership',async()=>{
  const f=await fixture();try{
    await f.sync.start(f.session,f.owner,'sub');await f.wait();f.clock({playing:false,paused:true});f.failNextAck();
    assert.equal(await f.sync.configure(f.session,f.owner,f.config()),false);
    assert.equal(f.sync.status(f.session).capability.bufferMs,0);
    assert.equal(f.messages.filter(message=>message.kind==='synchronization').at(-1).settings.flush,true);
    assert.equal(await f.sync.configure(f.session,f.owner,f.config()),true);
    f.clock({playing:true,paused:false,currentTime:40,generation:2,seeking:true});
    assert.equal(f.sync.status(f.session).capability.bufferMs,0);
  }finally{await f.close();}
});
test('Windows monitor owners and protected providers do not gain tab-delay eligibility',async()=>{
  const f=await fixture();try{
    await f.sync.start(f.session,{...f.owner,nativeAudio:true},'sub');
    assert.equal(f.starts,0);assert.equal(f.sync.status(f.session).capability.compensationEligible,false);
    assert.equal(await f.sync.configure(f.session,{...f.owner,nativeAudio:true},f.config()),false);
    const protectedSource={...f.session,asset:{provider:'spotify',id:'track'}};
    await f.sync.start(protectedSource,f.owner,'other');
    assert.equal(f.sync.status(protectedSource).capability.allowCapture,false);
    assert.equal(f.starts,0);
  }finally{await f.close();}
});
test('private widget bridge admits only bounded configuration on its exact nonce connection',async()=>{
  const f=await fixture();let bridge;try{
    const calls=[],sockets=[];
    class Socket{readyState=1;send(){}close(){this.readyState=3;this.onclose?.();}constructor(){sockets.push(this);}}
    bridge=f.createWidgetBridge({Socket,handle:async(...args)=>{calls.push(args);return{ok:true};},disconnected:async()=>{}});bridge.connect();
    const socket=sockets[0],nonce='abcdefghijklmnopabcdefghijklmnop1234';
    const receive=value=>socket.onmessage({data:JSON.stringify(value)});
    await receive({type:'hello',protocol:'kora-widget-v1',nonce});
    const request={type:'request',requestId:'one',nonce,action:'beat.experimental.configure',sessionId:'source',configuration:{enabled:true,captureId:'capture',generation:1,compensationMs:250,intentionalDelay:true,outputHeard:true,authorizedAudio:true,preview:true}};
    await receive({...request,nonce:'wrong'});
    await receive({...request,configuration:{...request.configuration,compensationMs:999}});
    await receive({...request,configuration:{...request.configuration,authorizedAudio:false}});
    await receive({...request,action:'system.audio'});assert.equal(calls.length,0);
    await receive(request);assert.equal(calls.length,1);assert.deepEqual(calls[0],[request,{native:nonce}]);
  }finally{bridge?.close();await f.close();}
});
