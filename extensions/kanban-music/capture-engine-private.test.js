import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('./beat-candidate.js',()=>({privateBeatCandidate:true}));
import {createCaptureEngine} from './capture-engine.js';
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
function fixture() {
  const nodes=[],node=()=>{const n={connect:vi.fn(),disconnect:vi.fn()};nodes.push(n);return n;};
  const source=node(),gain=()=>Object.assign(node(),{gain:{value:1,setTargetAtTime:vi.fn()}});
  const track={stop:vi.fn(),readyState:'live',addEventListener:vi.fn()},stream={getTracks:()=>[track],getAudioTracks:()=>[track],getVideoTracks:()=>[]};
  let time=1,model;
  const context={sampleRate:44100,state:'running',get currentTime(){return time;},destination:{},baseLatency:.01,outputLatency:.02,
    resume:vi.fn().mockResolvedValue(),close:vi.fn().mockResolvedValue(),createMediaStreamSource:()=>source,
    createAnalyser:()=>Object.assign(node(),{frequencyBinCount:1024,getFloatFrequencyData:array=>array.fill(-50)}),
    createGain:gain,createDelay:()=>Object.assign(node(),{delayTime:{value:0}})};
  const deps={getUserMedia:vi.fn().mockResolvedValue(stream),createAudioContext:()=>context,onBeat:vi.fn(),onStop:vi.fn(),
    createPercussion:vi.fn(async options=>{model=options;return {stop:vi.fn()};}),createAudioTap:vi.fn(async()=>({stop:vi.fn()}))};
  const engine=createCaptureEngine(deps);
  return {engine,deps,source,nodes,track,context,event:(audioTime=time-.25)=>model.onEvent({band:'clap',audioTime,confidence:.9,classMargin:.4}),advance:value=>{time+=value;}};
}
it('calibrates without typed predictions and keeps analysis outside the delayed output branch',async()=>{
  const f=fixture();expect(await f.engine.start('stream','owner',{candidate:true})).toBe(true);
  expect(f.deps.getUserMedia).toHaveBeenCalledWith({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:'stream'}}});
  for(let i=0;i<40;i++){f.advance(.01);f.event();}
  expect(f.engine.calibration).toEqual({samples:40,p95Ms:250,p99Ms:250});
  expect(f.deps.onBeat).not.toHaveBeenCalled();
  const targets=f.source.connect.mock.calls.map(([target])=>target);
  expect(targets).toHaveLength(2); // Analyser and independent audible output.
  expect(f.engine.configureSynchronization('owner',{bufferMs:290,eligible:true,paused:true,allowTypedPreview:true})).toBe(true);
  expect(f.engine.delaySeconds).toBe(.29);
  await vi.advanceTimersByTimeAsync(20);
  expect(f.source.disconnect).toHaveBeenCalledWith(targets[1]);
  f.engine.stop();await vi.advanceTimersByTimeAsync(20);expect(f.track.stop).toHaveBeenCalled();
});
it('rejects native, unowned, unpaused and oversized routing configurations',async()=>{
  const f=fixture();await f.engine.start('stream','owner',{candidate:true});
  for(const settings of [{bufferMs:501,eligible:true,paused:true},{bufferMs:300,eligible:false,paused:true},{bufferMs:300,eligible:true,paused:false}])
    expect(f.engine.configureSynchronization('owner',settings)).toBe(false);
  expect(f.engine.configureSynchronization('other',{bufferMs:300,eligible:true,paused:true})).toBe(false);
  expect(f.engine.delaySeconds).toBe(0);f.engine.stop();await vi.advanceTimersByTimeAsync(20);
});
it('retains audible output when model initialization fails',async()=>{
  const f=fixture();f.deps.createPercussion.mockRejectedValue(new Error('Model unavailable'));
  expect(await f.engine.start('stream','owner',{candidate:true})).toBe(true);
  expect(f.track.stop).not.toHaveBeenCalled();expect(f.context.close).not.toHaveBeenCalled();
  f.engine.stop();await vi.advanceTimersByTimeAsync(20);
});
it('rejects Spotify before opening a stream or output branch',async()=>{
  const f=fixture();expect(await f.engine.start('stream','owner',{candidate:true,sourceProvider:'spotify'})).toBe(false);
  expect(f.deps.getUserMedia).not.toHaveBeenCalled();
});
it('drops in-flight pre-enable and pre-pause inference after a synchronization boundary',async()=>{
  const f=fixture();await f.engine.start('stream','owner',{candidate:true});
  const inFlight=Promise.resolve().then(()=>f.event(.9));
  expect(f.engine.configureSynchronization('owner',{bufferMs:300,eligible:true,paused:true,allowTypedPreview:true,epoch:'first'})).toBe(true);
  await inFlight;expect(f.engine.health.queuedEvents).toBe(0);
  f.advance(.5);f.event(1.4);expect(f.engine.health.queuedEvents).toBe(1);
  f.engine.configureSynchronization('owner',{bufferMs:300,eligible:true,paused:true,flush:true,allowTypedPreview:true,epoch:'resumed'});
  await Promise.resolve().then(()=>f.event(1.4));expect(f.engine.health.queuedEvents).toBe(0);
  expect(f.engine.health.droppedSemanticEvents).toBe(2);
  f.advance(.2);f.event(1.6);expect(f.engine.health.queuedEvents).toBe(1);
  f.engine.stop();await vi.advanceTimersByTimeAsync(20);
});
