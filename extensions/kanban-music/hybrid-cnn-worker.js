import * as ort from './vendor/percussion/ort.wasm.min.mjs';
import {CnnBrowserFrontend} from '../../scripts/cnn-browser-frontend.mjs';
import {SoxrStream} from '../../scripts/research-cnn-live/soxr-wasm-adapter.mjs';
import {SourceSegmentGuard} from '../../scripts/research-cnn-live/source-segment-guard.mjs';
import {CnnHatEdges,cnnModelSha256,sameHybridOwner} from './hybrid-live-contract.js';
const epoch=()=>performance.timeOrigin+performance.now();
let config,session,module,coefficients,guard,frontend,resampler,origin=0,token=0,running=false,failed=false;
let pending=[],edges=new CnnHatEdges(),recordingId,sequence=0;
let probe;
function send(data){self.postMessage({...data,ownership:config.ownership,detectorModel:'CNN-B',diagnosticRecordingId:recordingId});}
function resetSegment(sample){
  resampler?.close();token++;pending=[];origin=sample/config.sampleRate;edges.reset();
  frontend=new CnnBrowserFrontend({...coefficients,oraclePower:null,observe(stage,frame,values){
    if(probe&&frame<(stage==='resampled'?config.parityFrameLimit*256+512:config.parityFrameLimit)){
      if(stage==='resampled')probe.resampled.push(values[0]);
      else if(Object.hasOwn(probe,stage))probe[stage].push(Array.from(values));
    }
    if(stage!=='tensor')return;
    if(pending.length>=32)throw Error('CNN frame backlog exceeded32');
    pending.push({tensor:values,frame,origin,token,frontendReadyTime:epoch(),
      requiredInputAudioTime:origin+frontend.received/config.sampleRate});
  }});
  frontend.reset(config.ownership.sourceGeneration);
  resampler=new SoxrStream(module,{sourceId:config.ownership.sourceId,generation:config.ownership.sourceGeneration,inputRate:config.sampleRate,
    observe(samples,identity){frontend.received=identity.observedInputSamples;for(const sample of samples)frontend.pushResampled(sample);}});
}
function fail(error){if(failed)return;failed=true;token++;pending=[];resampler?.close();send({kind:'failed',reason:String(error?.message||error)});}
async function drain(){
  if(running||failed)return;running=true;
  try{
    while(pending.length&&!failed){
      const row=pending.shift(),input=new ort.Tensor('float32',row.tensor,[1,3,7,96]);let output;
      const cnnInferenceStart=epoch();
      try{
        output=await session.run({input});const cnnInferenceEnd=epoch();
        if(row.token!==token||failed)continue;
        const logits=Array.from(output.logits.data),audioTime=row.origin+row.frame*256/22050;
        const event=edges.push(logits,row.frame,audioTime),detectorDecisionReady=epoch();
        const timing={sourceAudioTime:audioTime,analysisFrameIndex:row.frame,modelOutputFrameIndex:row.frame,segmentId:row.token,
          cnnInputStartSample:Math.round(row.origin*config.sampleRate),cnnInputEndSample:Math.round(row.requiredInputAudioTime*config.sampleRate),
          frontendReadyTime:row.frontendReadyTime,cnnInferenceStart,cnnInferenceEnd,
          detectorDecisionReady,decisionAt:detectorDecisionReady,workerPostTime:epoch(),
          requiredInputAudioTime:row.requiredInputAudioTime,queueDepth:pending.length,frontendFrames:frontend.frames,
          normalizationReference:frontend.runningPower,normalization:'observed-only running maximum; old dB frames never revised'};
        if(event)event.timing=timing;
        send({kind:'result',events:event?[event]:[],processedAudioTime:row.requiredInputAudioTime,
          durationMs:cnnInferenceEnd-cnnInferenceStart,queueDepth:pending.length,timing,
          ...(recordingId?{diagnostics:[{audioTime,scores:logits,scoreKind:'logits',frame:row.frame,segmentOrigin:row.origin,...timing}]}:{})});
      }finally{input.dispose();output&&Object.values(output).forEach(t=>t.dispose());}
    }
  }catch(error){fail(error);}finally{running=false;}
}
self.onmessage=async({data})=>{
  try{
    if(data.kind==='init'){
      if(config)throw Error('Worker already initialized');config=data;
      if(config.parityFrameLimit!==undefined){
        if(!Number.isSafeInteger(config.parityFrameLimit)||config.parityFrameLimit<1||config.parityFrameLimit>256)throw Error('Invalid finite parity probe limit');
        probe={resampled:[],power:[],mel:[],db:[],features:[],tensor:[]};
      }
      if(![44100,48000].includes(config.sampleRate))throw Error('Unsupported source rate');
      const base=new URL('./generated/hybrid/',import.meta.url);
      coefficients=await(await fetch(new URL('coefficients.json',base))).json();
      const bytes=await(await fetch(new URL('model.onnx',base))).arrayBuffer();
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
      if(digest!==cnnModelSha256)throw Error('Frozen CNN checkpoint mismatch');
      ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
      ort.env.wasm.wasmPaths={mjs:new URL('./vendor/percussion/ort-wasm-simd-threaded.mjs',import.meta.url).href,
        wasm:new URL('./vendor/percussion/ort-wasm-simd-threaded.wasm',import.meta.url).href};
      session=await ort.InferenceSession.create(bytes,{executionProviders:['wasm']});
      const {default:SoxrModule}=await import(/* @vite-ignore */new URL('soxr-glue.mjs',base).href);
      module=await SoxrModule({wasmBinary:await(await fetch(new URL('soxr_wasm.wasm',base))).arrayBuffer()});
      guard=new SourceSegmentGuard(config.ownership.sourceId,config.ownership.sourceGeneration);
      send({kind:'ready',modelSha256:cnnModelSha256});return;
    }
    if(!config||!sameHybridOwner(config.ownership,data.ownership)||failed)return;
    if(data.kind==='input-discontinuity'){send({...data,kind:'input-observation',workerReceiveTime:epoch()});return;}
    if(data.kind==='probe-stages'&&probe){
      const until=performance.now()+5000;
      while(running||pending.length){if(performance.now()>until)throw Error('Parity probe did not drain');await new Promise(resolve=>setTimeout(resolve,5));}
      send({kind:'probe-stages',stages:probe,requestId:data.requestId,retained:{db:frontend.db.length,features:frontend.features.length,pending:pending.length},wasmHeapBytes:module.HEAPU8.byteLength});return;
    }
    if(data.kind==='diagnostic-capture'){
      recordingId=data.enabled?data.recordingId:undefined;
      if(recordingId)send({kind:'diagnostic-start',modelSha256:cnnModelSha256,normalization:'running maximum',
        runningPower:frontend?.runningPower??0,sourceRate:config.sampleRate,segmentToken:token});return;
    }
    if(data.kind!=='pcm'||!session)return;
    if(data.sequence<=sequence)return;
    if(data.sequence!==sequence+1&&sequence>0)send({kind:'discontinuity',reason:'producer-sequence-gap'});
    sequence=data.sequence;
    const accepted=guard.accept({...data,sourceId:config.ownership.sourceId,generation:config.ownership.sourceGeneration});
    if(!accepted.accepted)return;
    if(!frontend||accepted.discontinuity){
      const discardedPending=pending.length,previousFrames=frontend?.contextFrames??0;
      resetSegment(data.sourceStartSample);
      send({kind:accepted.initial?'segment-start':'discontinuity',reason:accepted.initial?'initial-input':'source-sample-gap',
        originAudioTime:origin,segmentId:token,sourceStartSample:data.sourceStartSample,previousEndSample:accepted.previousEndSample,
        pcmSequenceNumber:data.sequence,discardedPending,previousFrames,workerReceiveTime:epoch()});
    }
    resampler.process(data.mono,config.ownership.sourceGeneration);
    send({kind:'pcm-ack',sequence:data.sequence,producerPostedAt:data.postedAtEpochMs,workerEnqueueTime:data.workerEnqueueTime,
      workerReceivedTime:epoch(),sourceStartSample:data.sourceStartSample,sourceEndSample:data.sourceEndSample,segmentId:token,
      observedInputSamples:resampler.received,resampledSamples:resampler.emitted,analysisFrames:frontend.frames,contextFrames:frontend.contextFrames});
    void drain();
  }catch(error){fail(error);}
};
