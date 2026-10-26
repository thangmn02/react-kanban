import {afterEach,expect,it,vi} from 'vitest';
import {createBassSourceRuntime} from './bass-source-runtime.js';
const ownership={captureId:'capture',sourceId:'source',sourceGeneration:1,synchronizationEpoch:'epoch'};
afterEach(()=>{vi.useRealTimers();});
function fixture(ready=true){
 const worker={terminate:vi.fn(),postMessage:vi.fn(message=>{if(ready&&message.kind==='init')queueMicrotask(()=>worker.onmessage({data:{kind:'ready',ownership}}));})};
 const node={port:{close:vi.fn()},connect:vi.fn(),disconnect:vi.fn()},source={connect:vi.fn(),disconnect:vi.fn()};
 const context={sampleRate:44100,state:'running',destination:{},audioWorklet:{addModule:vi.fn(async()=>{})}};
 return {worker,node,source,context,options:{ownership,source,context,createWorker:()=>worker,createNode:()=>node}};
}
it('aborts a pending startup without leaving a Worker, node or failure callback',async()=>{
 vi.useFakeTimers();const f=fixture(false),controller=new AbortController(),onFailure=vi.fn();
 const pending=createBassSourceRuntime({...f.options,signal:controller.signal,onEvent:vi.fn(),onFailure});controller.abort();
 expect(await pending).toBe(null);expect(f.worker.terminate).toHaveBeenCalledOnce();expect(f.source.connect).not.toHaveBeenCalled();expect(onFailure).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
it('rejects stale owners and duplicate results; observers cannot suppress a valid attack',async()=>{
 vi.useFakeTimers();const f=fixture(),onEvent=vi.fn(),onFailure=vi.fn();
 const runtime=await createBassSourceRuntime({...f.options,onEvent,onFailure,onDiagnostic(){throw Error('Observer');}});
 const event={band:'bass',audioTime:1,sourceFrame:44100,version:'bass-source-clock-v1'};
 const data={kind:'result',sequence:1,ownership,frames:[{events:[event]}]};
 f.worker.onmessage({data:{...data,ownership:{...ownership,synchronizationEpoch:'retired'}}});expect(onEvent).not.toHaveBeenCalled();
 f.worker.onmessage({data});expect(onEvent).toHaveBeenCalledOnce();expect(onEvent.mock.calls[0][0]).toMatchObject({...event,...ownership});
 f.worker.onmessage({data});expect(onEvent).toHaveBeenCalledOnce();expect(onFailure).toHaveBeenCalledWith('bass-result-sequence');
 expect(f.worker.terminate).toHaveBeenCalledOnce();expect(f.source.disconnect).toHaveBeenCalledWith(f.node);runtime.stop();expect(vi.getTimerCount()).toBe(0);
});
it('cancels delivery and releases the connected graph after ownership abort',async()=>{
 vi.useFakeTimers();const f=fixture(),controller=new AbortController(),onEvent=vi.fn();
 const runtime=await createBassSourceRuntime({...f.options,signal:controller.signal,onEvent});controller.abort();
 f.worker.onmessage({data:{kind:'result',sequence:1,ownership,frames:[{events:[{band:'bass'}]}]}});
 expect(onEvent).not.toHaveBeenCalled();expect(f.node.port.close).toHaveBeenCalledOnce();expect(f.node.disconnect).toHaveBeenCalledOnce();runtime.stop();expect(vi.getTimerCount()).toBe(0);
});
