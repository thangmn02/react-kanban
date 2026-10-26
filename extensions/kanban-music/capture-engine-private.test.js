import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const flags=vi.hoisted(()=>({privateBeatCandidate:true,privatePercussionDiagnostics:false,privatePercussionClassifier:'onset-guided',semanticPrecisionGuards:{mode:'off'},privateHatLabelMapping:'off'}));
vi.mock('./beat-candidate.js',()=>flags);
import {createCaptureEngine} from './capture-engine.js';
import {beatTelemetry} from './beat-telemetry.js';
beforeEach(()=>{vi.useFakeTimers();flags.privatePercussionDiagnostics=false;flags.privateHatLabelMapping='off';});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();beatTelemetry.enable(false);beatTelemetry.clear();});
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
    createPercussion:vi.fn(async options=>{model=options;return {stop:vi.fn(),recordDiagnostics:vi.fn(()=>true)};}),createAudioTap:vi.fn(async()=>({stop:vi.fn()}))};
  deps.createHybrid=vi.fn(async options=>{model=options;return {stop:vi.fn(),recordDiagnostics:vi.fn(()=>true)};});
  const engine=createCaptureEngine(deps);
  return {engine,deps,source,nodes,track,context,model:()=>model,event:(audioTime=time-.25)=>model.onEvent({band:'clap',audioTime,confidence:.9,classMargin:.4}),advance:value=>{time+=value;}};
}
it('switches Hybrid ownership atomically, rejects old callbacks and restores L0 on rollback',async()=>{
  const f=fixture();await f.engine.start('stream','owner',{candidate:true});
  const old=f.model();
  expect(f.engine.configureSynchronization('owner',{bufferMs:170,eligible:true,paused:true,allowTypedPreview:true,epoch:'hybrid',detectorVariant:'H-LIVE'})).toBe(true);
  await Promise.resolve();expect(f.deps.createHybrid).toHaveBeenCalledOnce();expect(f.engine.health.hybridMode).toBe('H-LIVE');
  f.advance(1);old.onEvent({band:'hat',audioTime:1.9,confidence:.9,classMargin:.4});
  f.model().onEvent({band:'hat',audioTime:1.9,confidence:.9,classMargin:.4,classIndex:3});
  expect(f.engine.health.queuedEvents).toBe(0);
  f.model().onEvent({band:'hat',detectorModel:'CNN-B',audioTime:1.9,confidence:.9,classMargin:.4,classIndex:2});
  expect(f.engine.health.queuedEvents).toBe(1);
  expect(f.engine.configureSynchronization('owner',{bufferMs:0,eligible:false,paused:true,flush:true,epoch:'rollback',detectorVariant:'L0'})).toBe(true);
  expect(f.engine.health.hybridMode).toBe('L0');expect(f.engine.health.queuedEvents).toBe(0);
  expect(f.deps.createPercussion).toHaveBeenCalledTimes(2);f.engine.stop();await vi.advanceTimersByTimeAsync(20);
});
it('retains bounded shadow observations without an explicit capture and clears them on source transition',async()=>{
  const f=fixture();await f.engine.start('stream','owner',{candidate:true});
  f.engine.configureSynchronization('owner',{bufferMs:0,eligible:true,paused:false,live:true,allowTypedPreview:true,epoch:'shadow',detectorVariant:'H-SHADOW'});
  await Promise.resolve();const old=f.model();
  for(let i=0;i<600;i++)old.onDiagnostic({kind:'result',detectorModel:'CNN-B',events:[{band:'hat',audioTime:i}],mainThreadReceivedAt:i});
  expect(f.engine.health.hybridObservedEvents).toBe(512);expect(f.engine.health.queuedEvents).toBe(0);
  f.engine.configureSynchronization('owner',{bufferMs:0,eligible:false,paused:true,flush:true,epoch:'next',detectorVariant:'L0'});
  old.onDiagnostic({kind:'result',detectorModel:'CNN-B',events:[{band:'hat',audioTime:700}]});
  expect(f.engine.health.hybridObservedEvents).toBe(0);f.engine.stop();await vi.advanceTimersByTimeAsync(20);
});
it('records on demand without a detector restart and invalidates capture across an epoch reset',async()=>{
  const f=fixture();await f.engine.start('stream','owner',{candidate:true});await Promise.resolve();
  expect(beatTelemetry.enabled).toBe(false);
  const calls=f.deps.createPercussion.mock.calls.length;
  expect(f.engine.diagnosticCapture('owner','start','record').ok).toBe(true);expect(f.deps.createPercussion).toHaveBeenCalledTimes(calls);
  const old=f.model();old.onCaptureDiagnostic({kind:'diagnostic-start',diagnosticRecordingId:'record',classifierState:{}});
  old.onCaptureDiagnostic({kind:'result',diagnosticRecordingId:'record',diagnostics:[{audioTime:1,scores:[0,0,0,0,0]}]});
  expect(f.engine.diagnosticCapture('owner','read','record').recording.frames).toHaveLength(1);
  f.engine.configureSynchronization('owner',{bufferMs:0,eligible:true,paused:true,allowTypedPreview:true,epoch:'new'});
  old.onCaptureDiagnostic({kind:'result',diagnosticRecordingId:'record',diagnostics:[{audioTime:2,scores:[0,0,0,1,0]}]});
  const result=f.engine.diagnosticCapture('owner','read','record').recording;
  expect(result).toMatchObject({status:'INTERRUPTED',complete:false});expect(result.frames).toHaveLength(1);
  expect(beatTelemetry.enabled).toBe(false);
  f.engine.stop();await vi.advanceTimersByTimeAsync(20);
});
it('retains the original private Hat head on its exact trace without changing delivery mapping',async()=>{
  beatTelemetry.enable();const f=fixture();await f.engine.start('stream','owner',{candidate:true});
  expect(f.engine.configureSynchronization('owner',{bufferMs:0,eligible:true,paused:true,allowTypedPreview:true,epoch:'review'})).toBe(true);
  await Promise.resolve();f.advance(1);
  f.model().onEvent({band:'hat',classIndex:4,audioTime:1.9,confidence:.8,classMargin:.3});
  const record=beatTelemetry.snapshot().records.find(row=>row.stage==='EVENT_QUEUED'&&row.type==='hat');
  expect(record).toMatchObject({originalClassIndex:4,percussionLabelMapping:'M0'});
  expect(f.engine.health.queuedEvents).toBe(1);f.engine.stop();await vi.advanceTimersByTimeAsync(20);
});
it.each([0,170])('bounds and resets label provenance across %sms output transitions',async bufferMs=>{
  flags.privateHatLabelMapping='shadow';const f=fixture();
  await f.engine.start('stream','owner',{candidate:true,sourceId:'song',sourceGeneration:1});
  const settings={bufferMs,eligible:true,paused:true,allowTypedPreview:true,epoch:'a'};
  expect(f.engine.configureSynchronization('owner',settings)).toBe(true);
  await Promise.resolve();const old=f.model();expect(old.hatLabelMapping).toBe('shadow');expect(old.semanticPrecisionGuards.mode).toBe('off');
  old.onDiagnostic({labelCandidates:Array.from({length:520},(_,i)=>({audioTime:i/100,originalClassIndex:4})),diagnostics:[]});
  expect(f.engine.labelDiagnostics.candidates).toHaveLength(512);
  expect(f.engine.configureSynchronization('owner',{...settings,flush:true,epoch:'b'})).toBe(true);
  await Promise.resolve();old.onDiagnostic({labelCandidates:[{audioTime:99,originalClassIndex:4}]});
  old.onEvent({band:'hat',classIndex:4,audioTime:99,confidence:.9,classMargin:.4});
  expect(f.engine.labelDiagnostics.candidates).toHaveLength(0);expect(f.engine.health.queuedEvents).toBe(0);
  expect(f.engine.delaySeconds).toBe(bufferMs/1000);expect(f.deps.getUserMedia).toHaveBeenCalledOnce();expect(f.context.close).not.toHaveBeenCalled();
  f.engine.stop();await vi.advanceTimersByTimeAsync(20);
});
it('gates buffered audio during pause and resumes through a clean delay without replacing the context or stream',async()=>{
  const f=fixture();await f.engine.start('stream','owner',{candidate:true});
  const settings={bufferMs:170,eligible:true,paused:true,allowTypedPreview:true,epoch:'paused'};
  expect(f.engine.configureSynchronization('owner',settings)).toBe(true);
  const pausedGain=f.nodes.filter(node=>node.gain).at(-1),old=f.model();
  expect(pausedGain.gain.value).toBe(0);
  expect(f.engine.configureSynchronization('owner',{...settings,paused:false,resume:true,flush:true,epoch:'resumed'})).toBe(true);
  expect(pausedGain.disconnect).toHaveBeenCalledOnce();expect(f.nodes.filter(node=>node.gain).at(-1).gain.value).toBe(1);
  expect(old.signal.aborted).toBe(true);expect(f.context.close).not.toHaveBeenCalled();expect(f.deps.getUserMedia).toHaveBeenCalledOnce();
  expect(f.engine.configureSynchronization('owner',{...settings,paused:false,resume:true,flush:true,bufferMs:200})).toBe(false);
  f.engine.stop();
});
it('flushes delayed audio, temporal owners and a pending PCM tap on a synchronization handoff',async()=>{
  const f=fixture();let finishTap;const oldTap={stop:vi.fn(),read:vi.fn(()=>({pcm:'old',sequence:1,endTime:1}))};
  f.deps.createAudioTap.mockImplementationOnce(()=>new Promise(resolve=>{finishTap=resolve;}));
  await f.engine.start('stream','owner',{candidate:true,sourceId:'song',sourceGeneration:1});
  f.engine.configureSynchronization('owner',{bufferMs:170,eligible:true,paused:true,allowTypedPreview:true,epoch:'a'});
  const oldWorker=f.model();const waiting=f.engine.readAudio('owner');
  f.engine.configureSynchronization('owner',{bufferMs:170,eligible:true,paused:true,flush:true,allowTypedPreview:true,epoch:'b'});
  expect(oldWorker.signal.aborted).toBe(true);
  oldWorker.onEvent({band:'hat',audioTime:10,confidence:.9,classMargin:.5});
  finishTap(oldTap);expect(await waiting).toBeUndefined();expect(oldTap.stop).toHaveBeenCalledOnce();
  expect(f.engine.health.queuedEvents).toBe(0);expect(f.context.close).not.toHaveBeenCalled();
  f.engine.stop();await Promise.resolve();expect(f.context.close).toHaveBeenCalledOnce();
});
it('immediately disconnects a buffered route on capture stop and ignores all old model callbacks',async()=>{
  const f=fixture();await f.engine.start('stream','A',{candidate:true});
  f.engine.configureSynchronization('A',{bufferMs:250,eligible:true,paused:true,allowTypedPreview:true,epoch:'a'});
  const old=f.model(),delay=f.nodes.find(node=>node.delayTime);
  f.engine.stop();expect(delay.disconnect).toHaveBeenCalledOnce();expect(old.signal.aborted).toBe(true);
  old.onEvent({band:'hat',audioTime:99,confidence:.9,classMargin:.5});
  expect(f.deps.onBeat).not.toHaveBeenCalled();expect(f.track.stop).toHaveBeenCalledOnce();
});
it('stops compensated output on device change without affecting OFF playback',async()=>{
  const f=fixture();let listener;f.context.addEventListener=vi.fn((name,fn)=>{if(name==='sinkchange')listener=fn;});
  f.context.removeEventListener=vi.fn();await f.engine.start('stream','owner',{candidate:true});
  listener();expect(f.track.stop).not.toHaveBeenCalled();
  f.engine.configureSynchronization('owner',{bufferMs:170,eligible:true,paused:true,allowTypedPreview:true,epoch:'a'});
  listener();expect(f.track.stop).toHaveBeenCalledOnce();expect(f.deps.onStop).toHaveBeenCalledWith('owner','output-device-changed');
  expect(f.context.removeEventListener).toHaveBeenCalledWith('sinkchange',listener);
});
it('keeps diagnostic recording off by default and bounds explicit private recording',async()=>{
  const plain=fixture();await plain.engine.start('stream','owner',{candidate:true});
  expect(plain.model().onDiagnostic).toBeUndefined();expect(plain.engine.percussionDiagnostics).toBeUndefined();
  expect(plain.engine.percussionClock).toBeUndefined();
  plain.engine.stop();await vi.advanceTimersByTimeAsync(20);
  flags.privatePercussionDiagnostics=true;
  const traced=fixture();await traced.engine.start('stream','owner',{candidate:true});
  const callback=traced.model().onDiagnostic;
  callback({diagnostics:Array.from({length:1805},(_,i)=>({audioTime:i/100,scores:[0,0,0,0,0]})),receivedAudioTime:20});
  for(let i=0;i<405;i++)callback({kind:'features',times:[i/100],data:[0]});
  for(let i=0;i<520;i++)traced.event();
  const result=traced.engine.percussionDiagnostics;
  expect(result.frames).toHaveLength(1800);expect(result.evictedFrames).toBe(5);
  expect(result.featureBlocks).toHaveLength(400);expect(result.featureBlocks[0].times).toEqual([.05]);
  expect(traced.engine.percussionClock).toMatchObject({contextState:'running',currentAudioTime:1,bufferMs:0});
  expect(result.predictions).toHaveLength(512);expect(result.predictions[0].rejected).toBe('typed-preview-disabled');
  traced.engine.stop();callback({diagnostics:[{audioTime:99}]});
  expect(traced.engine.percussionDiagnostics).toBeUndefined();await vi.advanceTimersByTimeAsync(20);
});
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
it('enables a zero-delay live preview without rebuilding output and drops prior inference',async()=>{
  const f=fixture();await f.engine.start('stream','owner',{candidate:true});
  const connections=f.source.connect.mock.calls.length,nodes=f.nodes.length;
  expect(f.engine.configureSynchronization('owner',{bufferMs:0,eligible:true,paused:false,live:true,allowTypedPreview:true,epoch:'live'})).toBe(true);
  expect(f.engine.delaySeconds).toBe(0);expect(f.source.connect).toHaveBeenCalledTimes(connections);expect(f.nodes).toHaveLength(nodes);
  f.event(.9);expect(f.engine.health.queuedEvents).toBe(0);
  f.advance(.5);f.event(1.4);expect(f.engine.health.queuedEvents).toBe(1);
  expect(f.engine.configureSynchronization('owner',{bufferMs:100,eligible:true,paused:false,live:true,allowTypedPreview:true})).toBe(false);
  expect(f.engine.configureSynchronization('owner',{bufferMs:0,eligible:false,paused:false,live:true,allowTypedPreview:false,flush:true,epoch:'off'})).toBe(true);
  expect(f.source.connect).toHaveBeenCalledTimes(connections);expect(f.nodes).toHaveLength(nodes);
  f.advance(.5);f.event();expect(f.engine.health.queuedEvents).toBe(0);
  f.engine.stop();await vi.advanceTimersByTimeAsync(20);
});
it('switches only the drum worker and fences old callbacks during L1 and L0 rollback',async()=>{
  const f=fixture();await f.engine.start('stream','owner',{candidate:true});
  const old=f.model(),connections=f.source.connect.mock.calls.length;
  const settings={bufferMs:0,eligible:true,paused:false,live:true,allowTypedPreview:true};
  expect(f.engine.configureSynchronization('owner',{...settings,detectorVariant:'L1-gap0'})).toBe(true);
  await Promise.resolve();
  expect(f.model().classifier).toBe('early-finalization');
  expect(old.signal.aborted).toBe(true);
  old.onEvent({band:'clap',audioTime:1.2,confidence:.9,classMargin:.4});
  expect(f.engine.health.queuedEvents).toBe(0);
  f.advance(.5);f.event(1.4);expect(f.engine.health.queuedEvents).toBe(1);
  const candidate=f.model();
  expect(f.engine.configureSynchronization('owner',{...settings,detectorVariant:'L0'})).toBe(true);
  await Promise.resolve();
  expect(candidate.signal.aborted).toBe(true);expect(f.model().classifier).toBe('onset-guided');
  expect(f.engine.health.queuedEvents).toBe(0);expect(f.engine.delaySeconds).toBe(0);
  expect(f.source.connect).toHaveBeenCalledTimes(connections);
  expect(f.deps.getUserMedia).toHaveBeenCalledOnce();expect(f.track.stop).not.toHaveBeenCalled();
  expect(f.engine.configureSynchronization('owner',{...settings,detectorVariant:'unknown'})).toBe(false);
  expect(f.engine.configureSynchronization('owner',{...settings,live:false,detectorVariant:'L1-gap0'})).toBe(false);
  f.engine.stop();await vi.advanceTimersByTimeAsync(20);
});
