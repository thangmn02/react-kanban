import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({options:null,stop:vi.fn(),initialFailure:false}));
vi.mock('./percussion-runtime.js',()=>({createPercussionRuntime:vi.fn(async options=>{state.options=options;return {stop:state.stop,recordDiagnostics:()=>true};})}));
import {createHybridPercussionRuntime} from './hybrid-percussion-runtime.js';
let workers,nodes;
beforeEach(()=>{
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
