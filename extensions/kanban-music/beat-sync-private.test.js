import {expect,it,vi} from 'vitest';
vi.mock('./beat-candidate.js',()=>({privateBeatCandidate:true,candidateDetector:{id:'adtof',version:'1',privateUseAllowed:true,trained:true,accuracyQualified:false,earlyDecisionAvailable:true}}));
import {createBeatSync} from './beat-sync.js';
import {beatTelemetry} from './beat-telemetry.js';
it('labels selected L1 without qualifying semantics and returns to L0 on rollback',async()=>{
  const f=fixture();await f.sync.start(f.session,f.owner,'sub');
  await vi.waitFor(()=>expect(f.sync.status(f.session).mode).toBe('capture'));
  const captureId=f.sync.status(f.session).captureId;
  const config={enabled:true,captureId,generation:1,live:true,latencyAccepted:true,
    intentionalDelay:false,authorizedAudio:true,outputHeard:true,preview:true};
  expect(await f.sync.configure(f.session,f.owner,{...config,detectorVariant:'L1-gap0'})).toBe(true);
  expect(f.sync.status(f.session).capability).toMatchObject({detectorId:'adtof-early-finalization',detectorVersion:'L1-gap0',
    mode:'experimental-live',allowSemantic:false,physicalVerified:false,bufferMs:0});
  expect(f.api.runtime.sendMessage.mock.calls.filter(([m])=>m.kind==='synchronization').at(-1)[0].settings.detectorVariant).toBe('L1-gap0');
  expect(await f.sync.configure(f.session,f.owner,{...config,detectorVariant:'L0'})).toBe(true);
  expect(f.sync.status(f.session).capability.detectorId).toBe('adtof');
  await f.sync.stop();
});
function fixture() {
  const facts={kind:'audio-only',noVideo:true,noFrames:true,singleSource:true};
  const session={id:'source',src:'http://127.0.0.1:5174/test.wav',tabId:12,documentId:'media',index:0,
    playing:true,paused:false,playbackRate:1,currentTime:10,sampledAt:Date.now(),generation:1,mediaFacts:facts};
  const owner={tabId:24,documentId:'app'},sender={tab:{id:12},documentId:'media'};
  let sync,calibration={samples:64,p95Ms:240,p99Ms:250};
  const api={runtime:{getURL:name=>`chrome-extension://private/${name}`,getContexts:vi.fn(async()=>[{}]),
    sendMessage:vi.fn(async message=>{
      if(message.kind==='start')queueMicrotask(()=>sync.offscreen({kind:'audible',captureId:message.captureId},{url:'chrome-extension://private/offscreen.html'}));
      return {ok:true,calibration};
    })},tabs:{sendMessage:vi.fn(async()=>({ok:true}))},offscreen:{closeDocument:vi.fn(async()=>{})},
    tabCapture:{getMediaStreamId:vi.fn(async()=> 'stream'),getCapturedTabs:vi.fn(async()=>[{tabId:12,status:'active'}])},
    scripting:{executeScript:vi.fn(async()=>[])}};
  sync=createBeatSync(api);
  const clock=sample=>{const token=api.tabs.sendMessage.mock.calls.find(([,message])=>message.kind==='watch')[1].token;
    sync.clock({token,valid:true,clock:{...session,...sample,sampledAt:sample.sampledAt??Date.now()}},sender);};
  return {sync,api,session,owner,clock,setCalibration:value=>{calibration=value;}};
}
it.each([
  ['buffering with paused=false',{buffering:true,paused:false,playing:true},0],
  ['short reported stall',{buffering:true,paused:false,playing:false},0],
  ['long reported stall',{buffering:true,paused:false,playing:false,currentTime:10},0],
  ['genuine seek',{generation:2,seeking:true,currentTime:40},0],
  ['source loses single-source proof',{mediaFacts:{kind:'audio-only',singleSource:false,noVideo:true,noFrames:true}},0],
  ['unsupported playback rate',{playbackRate:1.25},0],
  ['harmless advancing clock',{currentTime:10.001},170],
  ['same-source pause',{playing:false,paused:true},170],
  ['older asynchronous observation',{buffering:true,sampledAt:1},170],
])('preserves compensation safety for %s',async(_name,sample,expected)=>{
  const f=fixture();try{
    await f.sync.start(f.session,f.owner,'sub');await vi.waitFor(()=>expect(f.sync.status(f.session).mode).toBe('capture'));
    f.clock({playing:false,paused:true});const captureId=f.sync.status(f.session).captureId;
    expect(await f.sync.configure(f.session,f.owner,{enabled:true,captureId,generation:1,compensationMs:170,
      intentionalDelay:true,authorizedAudio:true,outputHeard:true,preview:true})).toBe(true);
    f.clock({playing:true,paused:false});f.clock(sample);
    expect(f.sync.status(f.session).capability.bufferMs).toBe(expected);
    if(expected===0){
      if(sample.seeking||sample.playbackRate!==undefined)await vi.waitFor(()=>expect(f.api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({kind:'stop',captureId})));
      else expect(f.api.runtime.sendMessage.mock.calls.filter(([m])=>m.kind==='synchronization').at(-1)[0].settings).toMatchObject({bufferMs:0,flush:true,eligible:false});
    }
  }finally{await f.sync.stop();}
});
it('binds one raw recording to the current app owner and rejects stale diagnostic replies',async()=>{
  const f=fixture();await f.sync.start(f.session,f.owner,'sub');await vi.waitFor(()=>expect(f.sync.status(f.session).mode).toBe('capture'));
  const original=f.api.runtime.sendMessage.getMockImplementation();
  f.api.runtime.sendMessage.mockImplementation(async message=>{
    if(message.kind!=='diagnostic-capture')return original(message);
    const start=f.api.runtime.sendMessage.mock.calls.find(([m])=>m.kind==='start')[0];
    return {ok:true,recording:{id:message.recordingId,startedAt:Date.now(),meta:{captureId:message.captureId,sourceId:start.sourceId,
      sourceGeneration:start.sourceGeneration,synchronizationEpoch:start.synchronizationEpoch},status:'RECORDING'}};
  });
  expect((await f.sync.diagnostics(f.session,{...f.owner,documentId:'other'},{operation:'start',recordingId:'r'})).ok).toBe(false);
  expect((await f.sync.diagnostics(f.session,f.owner,{operation:'start',recordingId:'r'})).ok).toBe(true);
  const read=await f.sync.diagnostics(f.session,f.owner,{operation:'read',recordingId:'r'});
  expect(read.source.clocks.length).toBeGreaterThan(0);expect(read.source).not.toHaveProperty('src');
  let resolve;f.api.runtime.sendMessage.mockImplementation(message=>message.kind==='diagnostic-capture'?new Promise(done=>{resolve=done;}):original(message));
  const pending=f.sync.diagnostics(f.session,f.owner,{operation:'read',recordingId:'r'});
  f.clock({currentTime:40,generation:2,seeking:true});resolve(read);
  expect(await pending).toMatchObject({ok:false,error:'source-changed'});await f.sync.stop();
});
it.each(['stop','replace'])('restores diagnostic instrumentation before awaiting direct %s teardown',async operation=>{
  beatTelemetry.enable(false);const f=fixture();let release;
  try{
    await f.sync.start(f.session,f.owner,'sub');await vi.waitFor(()=>expect(f.sync.status(f.session).mode).toBe('capture'));
    const original=f.api.runtime.sendMessage.getMockImplementation();
    f.api.runtime.sendMessage.mockImplementation(message=>{
      if(message.kind==='stop')return new Promise(resolve=>{release=()=>resolve({ok:true});});
      if(message.kind!=='diagnostic-capture')return original(message);
      const start=f.api.runtime.sendMessage.mock.calls.find(([m])=>m.kind==='start')[0];
      return Promise.resolve({ok:true,recording:{id:message.recordingId,startedAt:Date.now(),status:'RECORDING',
        meta:{captureId:message.captureId,sourceId:start.sourceId,sourceGeneration:start.sourceGeneration,synchronizationEpoch:start.synchronizationEpoch}}});
    });
    expect((await f.sync.diagnostics(f.session,f.owner,{operation:'start',recordingId:'recording'})).ok).toBe(true);
    expect(beatTelemetry.enabled).toBe(true);
    const pending=operation==='stop'?f.sync.stop():f.sync.start({...f.session,id:'replacement',src:'replacement.wav'},f.owner,'next');
    await vi.waitFor(()=>expect(release).toBeTypeOf('function'));
    expect(beatTelemetry.enabled).toBe(false);release();await pending;
    f.api.runtime.sendMessage.mockImplementation(original);
  }finally{release?.();await f.sync.stop();beatTelemetry.enable(false);beatTelemetry.clear();}
});
it('recreates offscreen after a failed old stop and blocks replacement when both cleanup paths fail',async()=>{
  const f=fixture();let contexts=[{}];f.api.runtime.getContexts.mockImplementation(async()=>contexts);
  f.api.offscreen.createDocument=vi.fn(async()=>{contexts=[{}];});
  f.api.offscreen.closeDocument.mockImplementation(async()=>{contexts=[];});
  await f.sync.start(f.session,f.owner,'sub');await vi.waitFor(()=>expect(f.sync.status(f.session).mode).toBe('capture'));
  const send=f.api.runtime.sendMessage.getMockImplementation();
  f.api.runtime.sendMessage.mockImplementation(message=>message.kind==='stop'?Promise.reject(Error('transport')):send(message));
  const next={...f.session,id:'next',src:'next.wav'};
  await f.sync.start(next,f.owner,'new-sub');await vi.waitFor(()=>expect(f.sync.status(next).mode).toBe('capture'));
  expect(f.api.offscreen.closeDocument).toHaveBeenCalledOnce();
  expect(f.api.offscreen.createDocument).toHaveBeenCalledOnce();
  f.api.offscreen.closeDocument.mockRejectedValueOnce(Error('offscreen unavailable'));
  const requests=f.api.tabCapture.getMediaStreamId.mock.calls.length;
  await expect(f.sync.start({...next,id:'third',src:'third.wav'},f.owner,'third-sub')).rejects.toThrow('Previous audio ownership');
  expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledTimes(requests);await f.sync.stop();
});
it('rolls both owners to the same epoch after a failed configuration and permits a subsequent activation',async()=>{
  const f=fixture();await f.sync.start(f.session,f.owner,'sub');await vi.waitFor(()=>expect(f.sync.status(f.session).mode).toBe('capture'));
  const captureId=f.sync.status(f.session).captureId,send=f.api.runtime.sendMessage.getMockImplementation();let rejectOnce=true;
  f.api.runtime.sendMessage.mockImplementation(message=>{
    if(message.kind==='synchronization'&&!message.settings.flush&&rejectOnce){rejectOnce=false;return Promise.resolve({ok:false});}
    return send(message);
  });
  const config={enabled:true,captureId,generation:1,live:true,latencyAccepted:true,outputHeard:true,authorizedAudio:true,preview:true};
  expect(await f.sync.configure(f.session,f.owner,config)).toBe(false);
  const rollback=f.api.runtime.sendMessage.mock.calls.filter(([m])=>m.kind==='synchronization').at(-1)[0].settings.epoch;
  const boundary=f.api.tabs.sendMessage.mock.calls.filter(([,m])=>m.kind==='sync.state').at(-1)[1];
  expect(rollback).toBe(boundary.synchronizationEpoch);
  expect(await f.sync.configure(f.session,f.owner,config)).toBe(true);
  const epoch=f.api.runtime.sendMessage.mock.calls.filter(([m])=>m.kind==='synchronization').at(-1)[0].settings.epoch;
  const before=f.api.tabs.sendMessage.mock.calls.filter(([,m])=>m.kind==='onset').length;
  f.sync.offscreen({kind:'onset',captureId,bands:['hat'],synchronizationEpoch:epoch},{url:'chrome-extension://private/offscreen.html'});
  expect(f.api.tabs.sendMessage.mock.calls.filter(([,m])=>m.kind==='onset')).toHaveLength(before+1);await f.sync.stop();
});
it('compensates owned video with a fixed hypothesis, fences all event kinds on seek and permits immediate OFF',async()=>{
  const f=fixture();Object.assign(f.session.mediaFacts,{kind:'video',noVideo:false,noFrames:false});
  await f.sync.start(f.session,f.owner,'sub');await vi.waitFor(()=>expect(f.sync.status(f.session).mode).toBe('capture'));
  f.clock({playing:false,paused:true});
  const captureId=f.sync.status(f.session).captureId;
  const configuration={enabled:true,captureId,generation:1,compensationMs:170,intentionalDelay:true,authorizedAudio:true,outputHeard:true,preview:true};
  expect(await f.sync.configure(f.session,f.owner,configuration)).toBe(true);
  f.clock({playing:true,paused:false,mediaFacts:{kind:'video',singleSource:true,noVideo:false,noFrames:false}});
  expect(f.sync.status(f.session).capability.bufferMs).toBe(170);
  const oldEpoch=f.api.runtime.sendMessage.mock.calls.filter(([m])=>m.kind==='synchronization').at(-1)[0].settings.epoch;
  expect(await f.sync.configure(f.session,f.owner,{...configuration,enabled:false,compensationMs:0})).toBe(true);
  expect(f.sync.status(f.session).capability.bufferMs).toBe(0);
  const count=()=>f.api.tabs.sendMessage.mock.calls.filter(([,m])=>['onset','tempo.state','tempo.tick'].includes(m.kind)).length;
  const before=count();f.clock({currentTime:40,generation:2,seeking:true,playing:false,paused:false});
  for(const message of [{kind:'onset',bands:['hat']},{kind:'tempo.state',tempo:{locked:true,bpm:120,confidence:1}},{kind:'tempo.tick',tick:{step:1,phase:0,beatPosition:1,subdivision:2}}])
    f.sync.offscreen({...message,captureId,synchronizationEpoch:oldEpoch},{url:'chrome-extension://private/offscreen.html'});
  expect(count()).toBe(before);await f.sync.stop();
});
it('records the precise transient clock reason while still revoking live preview immediately',async()=>{
 beatTelemetry.enable();const f=fixture();try{
  await f.sync.start(f.session,f.owner,'sub');await vi.waitFor(()=>expect(f.sync.status(f.session).mode).toBe('capture'));await f.sync.start(f.session,f.owner,'sub');
  const captureId=f.sync.status(f.session).captureId;
  expect(await f.sync.configure(f.session,f.owner,{enabled:true,captureId,generation:1,live:true,latencyAccepted:true,outputHeard:true,authorizedAudio:true,preview:true})).toBe(true);
  f.clock({buffering:true});expect(f.sync.status(f.session).capability.allowTypedPreview).toBe(false);
  expect(beatTelemetry.snapshot().records.find(r=>r.stage==='PREVIEW_REVOKED')).toMatchObject({trigger:'clock',previewReason:'clock-unreliable',buffering:true,captureId});
 }finally{await f.sync.stop();beatTelemetry.enable(false);beatTelemetry.clear();}
});
it('retains consent on app SPA loading updates but releases capture on source navigation',async()=>{
 const f=fixture();await f.sync.start(f.session,f.owner,'sub');await vi.waitFor(()=>expect(f.sync.status(f.session).mode).toBe('capture'));await f.sync.start(f.session,f.owner,'sub');const captureId=f.sync.status(f.session).captureId;
 expect(await f.sync.configure(f.session,f.owner,{enabled:true,captureId,generation:1,live:true,latencyAccepted:true,outputHeard:true,authorizedAudio:true,preview:true})).toBe(true);
 f.sync.tabLoading(f.owner.tabId);await Promise.resolve();expect(f.sync.status(f.session).captureId).toBe(captureId);expect(f.sync.status(f.session).capability.mode).toBe('experimental-live');
 f.sync.tabLoading(f.session.tabId);await vi.waitFor(()=>expect(f.sync.status(f.session).captureId).toBeUndefined());await f.sync.stop();
});
it('freezes measured buffer sizing and revokes it when video appears',async()=>{
  const f=fixture();await f.sync.start(f.session,f.owner,'sub');
  await vi.waitFor(()=>expect(f.sync.status(f.session).mode).toBe('capture'));
  await f.sync.start(f.session,f.owner,'sub');
  expect(f.sync.status(f.session).capability.bufferEligible).toBe(true);
  f.clock({playing:false,paused:true});
  const captureId=f.sync.status(f.session).captureId;
  const configuration={enabled:true,captureId,generation:1,intentionalDelay:true,outputHeard:true,authorizedAudio:true,preview:true};
  expect(await f.sync.configure(f.session,{...f.owner,documentId:'other'},configuration)).toBe(false);
  expect(await f.sync.configure(f.session,f.owner,configuration)).toBe(true);
  expect(f.sync.status(f.session).capability).toMatchObject({mode:'experimental-buffered',bufferMs:290,allowSemantic:false});
  const onsetCount=()=>f.api.tabs.sendMessage.mock.calls.filter(([,message])=>message.kind==='onset').length;
  const epoch=()=>f.api.runtime.sendMessage.mock.calls.filter(([message])=>message.kind==='synchronization').at(-1)[0].settings.epoch;
  const sendOnset=value=>f.sync.offscreen({kind:'onset',captureId,bands:['clap'],synchronizationEpoch:value},{url:'chrome-extension://private/offscreen.html'});
  f.clock({playing:true,paused:false});
  sendOnset('old-configuration');expect(onsetCount()).toBe(0);
  const priorEpoch=epoch();sendOnset(priorEpoch);expect(onsetCount()).toBe(1);
  f.clock({playing:false,paused:true});f.clock({playing:true,paused:false});
  sendOnset(priorEpoch);expect(onsetCount()).toBe(1);
  sendOnset(epoch());expect(onsetCount()).toBe(2);
  f.setCalibration({samples:512,p95Ms:500,p99Ms:900});await f.sync.start(f.session,f.owner,'sub');
  f.clock({playing:true,paused:false});
  expect(f.sync.status(f.session).capability).toMatchObject({mode:'experimental-buffered',bufferMs:290,requiredBufferMs:290});
  f.clock({mediaFacts:{kind:'video',noVideo:false,noFrames:true,singleSource:true}});
  expect(f.sync.status(f.session).capability).toMatchObject({mode:'degraded',bufferMs:0,allowTypedPreview:false});
  expect(f.api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({kind:'synchronization',settings:expect.objectContaining({bufferMs:0,flush:true})}));
  await f.sync.stop();
});
it('blocks Spotify capture before obtaining a stream ID',async()=>{
  const f=fixture();f.session.asset={provider:'spotify',id:'0'.repeat(22)};
  await f.sync.start(f.session,f.owner,'sub');
  expect(f.sync.status(f.session).capability.support).toBe('policy-blocked');
  expect(f.api.tabCapture.getMediaStreamId).not.toHaveBeenCalled();await f.sync.stop();
});
it('opts into live video while playing, publishes only its epoch, and revokes on pause',async()=>{
  const f=fixture();Object.assign(f.session.mediaFacts,{kind:'video',noVideo:false,noFrames:false});
  f.setCalibration({});await f.sync.start(f.session,f.owner,'sub');
  await vi.waitFor(()=>expect(f.sync.status(f.session).mode).toBe('capture'));
  const captureId=f.sync.status(f.session).captureId;
  const config={enabled:true,captureId,generation:1,live:true,latencyAccepted:true,
    intentionalDelay:false,authorizedAudio:true,outputHeard:true,preview:true};
  expect(await f.sync.configure(f.session,f.owner,{...config,latencyAccepted:false})).toBe(false);
  expect(await f.sync.configure(f.session,{...f.owner,documentId:'other'},config)).toBe(false);
  expect(await f.sync.configure(f.session,f.owner,config)).toBe(true);
  expect(f.sync.status(f.session).capability).toMatchObject({mode:'experimental-live',allowTypedPreview:true,bufferMs:0,allowSemantic:false});
  const epoch=f.api.runtime.sendMessage.mock.calls.filter(([message])=>message.kind==='synchronization').at(-1)[0].settings.epoch;
  const onsetCount=()=>f.api.tabs.sendMessage.mock.calls.filter(([,message])=>message.kind==='onset').length;
  const send=token=>f.sync.offscreen({kind:'onset',captureId,bands:['clap'],synchronizationEpoch:token},{url:'chrome-extension://private/offscreen.html'});
  send('old');expect(onsetCount()).toBe(0);send(epoch);expect(onsetCount()).toBe(1);
  f.clock({playing:false,paused:true});send(epoch);expect(onsetCount()).toBe(1);
  expect(f.sync.status(f.session).capability).toMatchObject({allowTypedPreview:false,bufferMs:0});
  await f.sync.stop();
});
it('revokes a live preview when another source starts in the captured tab',async()=>{
  const f=fixture();await f.sync.start(f.session,f.owner,'sub');
  await vi.waitFor(()=>expect(f.sync.status(f.session).mode).toBe('capture'));
  const captureId=f.sync.status(f.session).captureId;
  expect(await f.sync.configure(f.session,f.owner,{enabled:true,captureId,generation:1,live:true,latencyAccepted:true,
    intentionalDelay:false,authorizedAudio:true,outputHeard:true,preview:true})).toBe(true);
  f.clock({mediaFacts:{kind:'audio-only',singleSource:false,noVideo:true,noFrames:true}});
  expect(f.sync.status(f.session).capability).toMatchObject({allowTypedPreview:false,bufferMs:0});
  expect(f.api.runtime.sendMessage.mock.calls.filter(([message])=>message.kind==='synchronization').at(-1)[0].settings)
    .toMatchObject({bufferMs:0,allowTypedPreview:false,flush:true,live:true});await f.sync.stop();
});
it('cancels a raced live activation without replacing its zero-delay output graph',async()=>{
  const f=fixture();await f.sync.start(f.session,f.owner,'sub');
  await vi.waitFor(()=>expect(f.sync.status(f.session).mode).toBe('capture'));
  const captureId=f.sync.status(f.session).captureId,send=f.api.runtime.sendMessage.getMockImplementation();
  let finish;
  f.api.runtime.sendMessage.mockImplementation(message=>message.kind==='synchronization'&&!message.settings.flush
    ?new Promise(resolve=>{finish=resolve;}):send(message));
  const activation=f.sync.configure(f.session,f.owner,{enabled:true,captureId,generation:1,live:true,latencyAccepted:true,
    intentionalDelay:false,authorizedAudio:true,outputHeard:true,preview:true});
  await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
  f.clock({playing:false,paused:true});finish({ok:true});expect(await activation).toBe(false);
  expect(f.api.runtime.sendMessage.mock.calls.filter(([message])=>message.kind==='synchronization').at(-1)[0].settings)
    .toMatchObject({bufferMs:0,eligible:false,allowTypedPreview:false,flush:true,live:true});
  expect(f.sync.status(f.session).capability).toMatchObject({allowTypedPreview:false,bufferMs:0});await f.sync.stop();
});
it.each(['frames','multiple-sources','ownership-loss'])('flushes actual output when %s revokes eligibility during playback',async(reason)=>{
  const f=fixture();await f.sync.start(f.session,f.owner,'sub');
  await vi.waitFor(()=>expect(f.sync.status(f.session).mode).toBe('capture'));
  await f.sync.start(f.session,f.owner,'sub');f.clock({playing:false,paused:true});
  const captureId=f.sync.status(f.session).captureId;
  expect(await f.sync.configure(f.session,f.owner,{enabled:true,captureId,generation:1,
    intentionalDelay:true,authorizedAudio:true,outputHeard:true,preview:true})).toBe(true);
  f.clock({playing:true,paused:false});
  if(reason==='ownership-loss') {
    f.api.tabCapture.getCapturedTabs.mockResolvedValue([{tabId:12,status:'stopped'}]);
    await f.sync.start(f.session,f.owner,'sub');f.clock({});
  }else f.clock({mediaFacts:{kind:'audio-only',noVideo:true,noFrames:reason!=='frames',singleSource:reason!=='multiple-sources'}});
  expect(f.sync.status(f.session).capability).toMatchObject({bufferMs:0,allowTypedPreview:false});
  expect(f.api.runtime.sendMessage.mock.calls.filter(([message])=>message.kind==='synchronization').at(-1)[0].settings)
    .toMatchObject({bufferMs:0,eligible:false,flush:true});
  await f.sync.stop();
});
