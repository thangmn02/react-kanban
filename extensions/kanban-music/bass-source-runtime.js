import {sameHybridOwner} from './hybrid-live-contract.js';
export async function createBassSourceRuntime({context,source,ownership,signal,windowStartSample,windowEndSample,onEvent,onDiagnostic=()=>{},onFailure=()=>{},
  createWorker=()=>new Worker(new URL('./bass-source-worker.js',import.meta.url),{type:'module'}),
  createNode=()=>new AudioWorkletNode(context,'kora-hybrid-pcm',{processorOptions:{ownership}})}){
  let live=true,node,worker,timer,watchdog,inFlight=0,lastSequence=0,lastProgress=performance.now(),resolveReady=()=>{};
  const stop=()=>{if(!live)return;live=false;clearTimeout(timer);clearInterval(watchdog);resolveReady(false);worker?.terminate();signal?.removeEventListener('abort',stop);
    if(node){node.port.onmessage=null;node.port.close?.();try{source.disconnect(node);}catch{/* Already detached. */}node.disconnect();}};
  const fail=reason=>{if(live){stop();onFailure(reason);}};
  signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted){stop();return null;}
  try{
    worker=createWorker();const ready=new Promise(resolve=>{resolveReady=resolve;});timer=setTimeout(()=>fail('bass-startup-timeout'),10000);
    worker.onerror=()=>fail('bass-worker-error');worker.onmessage=({data})=>{
      if(!live||!sameHybridOwner(ownership,data.ownership))return;
      if(data.kind==='ready'){resolveReady(true);return;}
      if(data.kind==='failed'){fail(data.reason);return;}
      if(data.kind!=='result')return;
      if(data.sequence!==lastSequence+1){fail('bass-result-sequence');return;}lastSequence=data.sequence;
      inFlight=Math.max(0,inFlight-1);lastProgress=performance.now();
      try{onDiagnostic({...data,receivedAt:performance.timeOrigin+performance.now(),inFlight});}catch{/* Diagnostic observers cannot suppress a Bass event. */}
      for(const frame of data.frames)for(const event of frame.events)if(live)onEvent({...event,...ownership,readyAt:performance.timeOrigin+performance.now()});
    };
    worker.postMessage({kind:'init',ownership,sampleRate:context.sampleRate,windowStartSample,windowEndSample});
    if(!await ready||!live)return null;
    await context.audioWorklet.addModule(new URL('./hybrid-pcm-worklet.js',import.meta.url));if(!live)return null;
    node=createNode();node.port.onmessage=({data})=>{
      if(!live||!sameHybridOwner(ownership,data.ownership)||data.kind!=='pcm')return;
      if(++inFlight>64){fail('bass-pcm-backlog');return;}
      worker.postMessage(data,[data.mono.buffer]);
    };
    source.connect(node);node.connect(context.destination);clearTimeout(timer);
    watchdog=setInterval(()=>{if(context.state==='running'&&inFlight&&performance.now()-lastProgress>2000)fail('bass-worker-stalled');},250);
    return {stop};
  }catch(error){fail(error.message);return null;}
}
