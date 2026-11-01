import {createPercussionRuntime} from './percussion-runtime.js';
import {acceptsHybridEvent,sameHybridOwner} from './hybrid-live-contract.js';

// One warm CNN worker survives between captures when the caller opts in (see percussion-runtime.js).
let parkedWorker;
// Light drums: on a device too slow for ADTOF, its Kick/Snare arrive too late to show. The CNN already scores
// Kick/Snare/Hat in one pass, so it takes all three and ADTOF stops. Sustained lateness, or ADTOF failing on two
// songs in a row, marks the device for a few hours; a single failure is light for that song only. ADTOF runs ~0.2 s
// behind on a capable device, so only a median over 0.35 s counts as late.
const lightKey='kora-light-drums',lightHours=6,lateSeconds=.35,lateWindow=12;
let adtofFailures=0;
const remembered=()=>{try{return Date.now()-Number(localStorage.getItem(lightKey))<lightHours*3600000;}catch{return false;}};
const remember=()=>{try{localStorage.setItem(lightKey,String(Date.now()));}catch{/* Not stored; detected again next time. */}};

export async function createHybridPercussionRuntime(options){
  const {context,source,signal,ownership,hybridMode,onEvent,onFailure=()=>{}}=options;
  const controller=new AbortController();
  let live=true,adtof,node,worker,timer,watchdog,inFlight=0,lastProgress=performance.now(),recording,workerReady=false,workerFailed=false;
  let light=hybridMode==='H-LIVE'&&remembered();const lateness=[];
  const goLight=(reason,device=true)=>{
    if(!live||light||hybridMode!=='H-LIVE')return false;
    light=true;if(device)remember();adtof?.stop();adtof=undefined;options.onLightDrums?.(reason);return true;
  };
  let resolveReady=()=>{};
  const stop=()=>{
    if(!live)return;live=false;clearTimeout(timer);clearInterval(watchdog);resolveReady(false);
    signal?.removeEventListener('abort',stop);controller.abort();adtof?.stop();
    if(options.reuseWorker&&workerReady&&!workerFailed&&!parkedWorker){worker.onmessage=null;worker.onerror=null;worker.postMessage({kind:'park'});parkedWorker=worker;}
    else worker?.terminate();
    if(node){node.port.onmessage=null;node.port.close?.();try{source.disconnect(node);}catch{/* Already detached. */}node.disconnect();}
  };
  const fail=reason=>{if(!live)return;workerFailed=true;stop();onFailure('hybrid-cnn-'+reason);};
  signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted){stop();return null;}
  const observe=data=>{
    const received={...data,mainThreadReceivedAt:performance.timeOrigin+performance.now(),receivedAudioTime:context.currentTime};
    try{options.onDiagnostic?.(received);if(data.diagnosticRecordingId)options.onCaptureDiagnostic?.(received);}catch{/* Observers cannot interrupt delivery. */}
  };
  try{
    timer=setTimeout(()=>fail('startup-timeout'),10000);
    worker=options.reuseWorker&&parkedWorker||new Worker(new URL('./hybrid-cnn-worker.js',import.meta.url),{type:'module'});
    if(worker===parkedWorker)parkedWorker=undefined;
    const ready=new Promise(resolve=>{resolveReady=resolve;});
    worker.onerror=()=>fail('worker-error');
    worker.onmessage=({data})=>{
      if(!live||!sameHybridOwner(ownership,data.ownership))return;
      if(data.kind==='ready'){workerReady=true;resolveReady(true);}
      if(data.kind==='failed'){observe(data);fail(data.reason||'failed');return;}
      if(data.kind==='pcm-ack'){inFlight=Math.max(0,inFlight-1);lastProgress=performance.now();return;}
      observe(data);
      if(data.kind==='result'){
        options.onProgress?.();
        const companionReceiveTime=performance.timeOrigin+performance.now();
        for(const event of data.events||[])if(live&&acceptsHybridEvent(hybridMode,'CNN-B',event,light))onEvent({...event,...ownership,
          timing:{...event.timing,companionReceiveTime}});
      }
    };
    worker.postMessage({kind:'init',ownership,sampleRate:context.sampleRate});
    // The original ADTOF runtime owns its own frontend and semantic decisions.
    if(!light)adtof=await createPercussionRuntime({...options,signal:controller.signal,
      onFailure:reason=>{if(!goLight('adtof-'+reason,++adtofFailures>=2))fail(reason);},onEvent(event){
        if(!live||light)return;
        // Every ADTOF decision, whatever its band, shows how far behind the music it runs on this device.
        lateness.push(context.currentTime-event.audioTime);if(lateness.length>lateWindow)lateness.shift();
        if(lateness.length===lateWindow){if([...lateness].sort((a,b)=>a-b)[lateWindow>>1]>lateSeconds){goLight('adtof-late');return;}adtofFailures=0;}
        if(acceptsHybridEvent(hybridMode,'ADTOF-A',event))onEvent(event);
      }});
    if(!live){adtof?.stop();return null;}
    if(!adtof&&!light)goLight('adtof-unavailable',++adtofFailures>=2);
    if(!adtof&&!light||!await ready||!live){stop();return null;}
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
