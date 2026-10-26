import {createPercussionRuntime} from './percussion-runtime.js';
import {acceptsHybridEvent,sameHybridOwner} from './hybrid-live-contract.js';

export async function createHybridPercussionRuntime(options){
  const {context,source,signal,ownership,hybridMode,onEvent,onFailure=()=>{}}=options;
  const controller=new AbortController();
  let live=true,adtof,node,worker,timer,watchdog,inFlight=0,lastProgress=performance.now(),recording;
  let resolveReady=()=>{};
  const stop=()=>{
    if(!live)return;live=false;clearTimeout(timer);clearInterval(watchdog);resolveReady(false);
    signal?.removeEventListener('abort',stop);controller.abort();adtof?.stop();worker?.terminate();
    if(node){node.port.onmessage=null;node.port.close?.();try{source.disconnect(node);}catch{/* Already detached. */}node.disconnect();}
  };
  const fail=reason=>{if(!live)return;stop();onFailure('hybrid-cnn-'+reason);};
  signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted){stop();return null;}
  const observe=data=>{
    const received={...data,mainThreadReceivedAt:performance.timeOrigin+performance.now(),receivedAudioTime:context.currentTime};
    try{options.onDiagnostic?.(received);if(data.diagnosticRecordingId)options.onCaptureDiagnostic?.(received);}catch{/* Observers cannot interrupt delivery. */}
  };
  try{
    timer=setTimeout(()=>fail('startup-timeout'),10000);
    worker=new Worker(new URL('./hybrid-cnn-worker.js',import.meta.url),{type:'module'});
    const ready=new Promise(resolve=>{resolveReady=resolve;});
    worker.onerror=()=>fail('worker-error');
    worker.onmessage=({data})=>{
      if(!live||!sameHybridOwner(ownership,data.ownership))return;
      if(data.kind==='ready')resolveReady(true);
      if(data.kind==='failed'){observe(data);fail(data.reason||'failed');return;}
      if(data.kind==='pcm-ack'){inFlight=Math.max(0,inFlight-1);lastProgress=performance.now();return;}
      observe(data);
      if(data.kind==='result'){
        options.onProgress?.();
        const companionReceiveTime=performance.timeOrigin+performance.now();
        for(const event of data.events||[])if(live&&acceptsHybridEvent(hybridMode,'CNN-B',event))onEvent({...event,...ownership,
          timing:{...event.timing,companionReceiveTime}});
      }
    };
    worker.postMessage({kind:'init',ownership,sampleRate:context.sampleRate});
    // The original ADTOF runtime owns its own frontend and semantic decisions.
    adtof=await createPercussionRuntime({...options,signal:controller.signal,onFailure:fail,onEvent(event){
      if(live&&acceptsHybridEvent(hybridMode,'ADTOF-A',event))onEvent(event);
    }});
    if(!live){adtof?.stop();return null;}
    if(!adtof||!await ready||!live){stop();return null;}
    await context.audioWorklet.addModule(new URL('./hybrid-pcm-worklet.js',import.meta.url));
    if(!live)return null;
    node=new AudioWorkletNode(context,'kora-hybrid-pcm',{processorOptions:{ownership}});
    node.port.onmessage=({data})=>{
      if(!live||!sameHybridOwner(ownership,data.ownership))return;
      if(data.kind!=='pcm'){
        if(recording)worker.postMessage(data);
        else if(options.onDiagnostic)observe({...data,detectorModel:'CNN-B'});
        return;
      }
      if(++inFlight>64){fail('pcm-backlog');return;}
      worker.postMessage({...data,mainThreadReceivedTime:Date.now(),workerEnqueueTime:performance.timeOrigin+performance.now()},[data.mono.buffer]);
    };
    source.connect(node);node.connect(context.destination);clearTimeout(timer);
    watchdog=setInterval(()=>{if(context.state==='running'&&inFlight>0&&performance.now()-lastProgress>2000)fail('stalled');},250);
    return {stop,recordDiagnostics(recordingId,enabled){
      if(!live)return false;
      recording=enabled?recordingId:undefined;
      node.port.postMessage({kind:'diagnostic-capture',recordingId,enabled,ownership});
      worker.postMessage({kind:'diagnostic-capture',recordingId,enabled,ownership});
      return adtof.recordDiagnostics?.(recordingId,enabled)===true;
    }};
  }catch(error){fail(error.message||'startup');return null;}
}
