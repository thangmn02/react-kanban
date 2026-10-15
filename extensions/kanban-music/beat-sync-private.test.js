import {expect,it,vi} from 'vitest';
vi.mock('./beat-candidate.js',()=>({privateBeatCandidate:true,candidateDetector:{id:'adtof',version:'1',privateUseAllowed:true,trained:true,accuracyQualified:false}}));
import {createBeatSync} from './beat-sync.js';
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
    sync.clock({token,valid:true,clock:{...session,...sample,sampledAt:Date.now()}},sender);};
  return {sync,api,session,owner,clock,setCalibration:value=>{calibration=value;}};
}
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
