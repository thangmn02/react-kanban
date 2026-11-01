import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({options:null,stop:vi.fn(),initialFailure:false}));
vi.mock('./percussion-runtime.js',()=>({createPercussionRuntime:vi.fn(async options=>{state.options=options;return {stop:state.stop,recordDiagnostics:()=>true};})}));
import {createHybridPercussionRuntime} from './hybrid-percussion-runtime.js';
import {createPercussionRuntime} from './percussion-runtime.js';
import {CnnDrumEdges} from './hybrid-live-contract.js';
let workers,nodes;
beforeEach(()=>{
  try{localStorage.clear();}catch{/* No storage in this environment. */}
  vi.useFakeTimers();workers=[];nodes=[];state.initialFailure=false;state.stop.mockClear();
  vi.stubGlobal('Worker',class{
    constructor(){workers.push(this);this.terminate=vi.fn();}
    postMessage=vi.fn(data=>{if(data.kind==='init')queueMicrotask(()=>this.onmessage({data:{kind:state.initialFailure?'failed':'ready',ownership:data.ownership,reason:'initialization-failed'}}));});
    emit(data){this.onmessage({data});}
  });
  vi.stubGlobal('AudioWorkletNode',class{constructor(){this.port={close:vi.fn(),postMessage:vi.fn()};nodes.push(this);}connect(){}disconnect(){}});
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
const fixture=mode=>{
  const ownership={captureId:'c',sourceId:'s',sourceGeneration:1,synchronizationEpoch:'e'};
  const options={hybridMode:mode,ownership,context:{sampleRate:44100,state:'running',currentTime:2,audioWorklet:{addModule:async()=>{}},destination:{}},
    source:{connect:vi.fn(),disconnect:vi.fn()},onEvent:vi.fn(),onFailure:vi.fn(),onCaptureDiagnostic:vi.fn()};
  return {ownership,options};
};
it('keeps one authoritative Hat detector and rejects old-generation Worker replies',async()=>{
  const f=fixture('H-LIVE'),runtime=await createHybridPercussionRuntime(f.options);
  state.options.onEvent({band:'hat'});state.options.onEvent({band:'kick'});state.options.onEvent({band:'clap'});
  workers[0].emit({kind:'result',ownership:{...f.ownership,sourceGeneration:0},events:[{band:'hat'}]});
  expect(f.options.onEvent.mock.calls.map(([e])=>e.band)).toEqual(['kick','clap']);
  workers[0].emit({kind:'result',ownership:f.ownership,events:[{band:'hat',detectorModel:'CNN-B'}]});
  expect(f.options.onEvent.mock.calls.at(-1)[0]).toMatchObject({band:'hat',sourceGeneration:1,synchronizationEpoch:'e'});
  runtime.stop();expect(state.stop).toHaveBeenCalledOnce();expect(workers[0].terminate).toHaveBeenCalledOnce();
  workers[0].emit({kind:'result',ownership:f.ownership,events:[{band:'hat'}]});expect(f.options.onEvent).toHaveBeenCalledTimes(3);
});
it('logs shadow CNN events while leaving L0 events authoritative',async()=>{
  const f=fixture('H-SHADOW'),runtime=await createHybridPercussionRuntime(f.options);
  state.options.onEvent({band:'hat'});
  workers[0].emit({kind:'result',ownership:f.ownership,diagnosticRecordingId:'r',events:[{band:'hat',detectorModel:'CNN-B'}]});
  expect(f.options.onEvent).toHaveBeenCalledTimes(1);expect(f.options.onCaptureDiagnostic).toHaveBeenCalledOnce();runtime.stop();
});
it('fails closed on CNN initialization or runtime failure without retaining ADTOF as a hidden fallback',async()=>{
  const f=fixture('H-LIVE');state.initialFailure=true;
  const runtime=await createHybridPercussionRuntime(f.options);expect(runtime).toBe(null);
  expect(f.options.onFailure).toHaveBeenCalledWith('hybrid-cnn-initialization-failed');expect(state.stop).toHaveBeenCalledOnce();
  state.options.onEvent({band:'hat'});expect(f.options.onEvent).not.toHaveBeenCalled();
});
it('does not bounce normal input observations through the worker; snapshots require explicit recording',async()=>{
  const f=fixture('H-LIVE');delete f.options.onCaptureDiagnostic;
  const runtime=await createHybridPercussionRuntime(f.options),worker=workers[0],node=nodes[0];
  const observation={kind:'input-discontinuity',ownership:f.ownership,reason:'repeated-quantum-clock'};
  const before=worker.postMessage.mock.calls.length;node.port.onmessage({data:observation});expect(worker.postMessage).toHaveBeenCalledTimes(before);
  runtime.recordDiagnostics('recording',true);expect(node.port.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({enabled:true,ownership:f.ownership}));
  node.port.onmessage({data:observation});expect(worker.postMessage).toHaveBeenLastCalledWith(observation);
  runtime.recordDiagnostics('recording',false);const after=worker.postMessage.mock.calls.length;
  node.port.onmessage({data:observation});expect(worker.postMessage).toHaveBeenCalledTimes(after);runtime.stop();
});
const cnn=(f,band)=>workers[0].emit({kind:'result',ownership:f.ownership,events:[{band,detectorModel:'CNN-B'}]});
it('switches a device too slow for ADTOF to light drums: CNN Kick/Snare/Hat, ADTOF stopped',async()=>{
  const f=fixture('H-LIVE');f.options.onLightDrums=vi.fn();const runtime=await createHybridPercussionRuntime(f.options);
  cnn(f,'kick');expect(f.options.onEvent).not.toHaveBeenCalled();
  for(let i=0;i<11;i++)state.options.onEvent({band:'kick',audioTime:1.5});
  expect(f.options.onEvent).toHaveBeenCalledTimes(11);expect(state.stop).not.toHaveBeenCalled();
  state.options.onEvent({band:'kick',audioTime:1.5});
  expect(f.options.onLightDrums).toHaveBeenCalledWith('adtof-late');expect(state.stop).toHaveBeenCalledOnce();
  state.options.onEvent({band:'clap',audioTime:1.99});expect(f.options.onEvent).toHaveBeenCalledTimes(11);
  cnn(f,'kick');cnn(f,'clap');cnn(f,'hat');
  expect(f.options.onEvent.mock.calls.slice(11).map(([e])=>[e.band,e.detectorModel])).toEqual([['kick','CNN-B'],['clap','CNN-B'],['hat','CNN-B']]);
  expect(f.options.onFailure).not.toHaveBeenCalled();runtime.stop();
});
it('keeps ADTOF when it keeps up with the music',async()=>{
  const f=fixture('H-LIVE');const runtime=await createHybridPercussionRuntime(f.options);
  for(let i=0;i<30;i++)state.options.onEvent({band:'kick',audioTime:1.8});
  expect(state.stop).not.toHaveBeenCalled();cnn(f,'kick');expect(f.options.onEvent).toHaveBeenCalledTimes(30);runtime.stop();
});
it('an ADTOF failure moves that song to light drums; only a second one in a row marks the device',async()=>{
  let storage;try{storage=localStorage;}catch{/* Node without storage. */}
  if(!storage){vi.stubGlobal('localStorage',(()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),clear:()=>m.clear()};})());}
  let f=fixture('H-LIVE');let runtime=await createHybridPercussionRuntime(f.options);
  state.options.onFailure('worker-stalled');
  expect(f.options.onFailure).not.toHaveBeenCalled();cnn(f,'clap');expect(f.options.onEvent).toHaveBeenCalledOnce();runtime.stop();
  expect(localStorage.getItem('kora-light-drums')).toBe(null);
  workers=[];f=fixture('H-LIVE');runtime=await createHybridPercussionRuntime(f.options);state.options.onFailure('worker-stalled');runtime.stop();
  expect(localStorage.getItem('kora-light-drums')).not.toBe(null);
});
it('a remembered light device does not load ADTOF at all',async()=>{
  let storage;try{storage=localStorage;}catch{/* Node without storage. */}
  if(!storage){vi.stubGlobal('localStorage',(()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),clear:()=>m.clear()};})());}
  const first=fixture('H-LIVE');let runtime=await createHybridPercussionRuntime(first.options);
  for(let i=0;i<12;i++)state.options.onEvent({band:'kick',audioTime:1});runtime.stop();
  const calls=createPercussionRuntime.mock.calls.length;workers=[];
  const f=fixture('H-LIVE');runtime=await createHybridPercussionRuntime(f.options);
  expect(runtime).not.toBe(null);expect(createPercussionRuntime.mock.calls.length).toBe(calls);
  cnn(f,'kick');expect(f.options.onEvent).toHaveBeenCalledOnce();runtime.stop();
});
it('the CNN reports Kick, Snare and Hat rising edges with the published threshold',()=>{
  const edges=new CnnDrumEdges();
  expect(edges.push([1,1,1],0,0)).toEqual([]);
  expect(edges.push([1,-1,1],1,.01)).toEqual([]);
  expect(edges.push([1,1,-1],2,.02).map(e=>e.band)).toEqual(['clap']);
  expect(edges.push([-1,1,2],3,.03).map(e=>e.band)).toEqual(['hat']);
  expect(edges.push([2,-1,2],4,.04).map(e=>[e.band,e.originalClassName])).toEqual([['kick','kick']]);
});
