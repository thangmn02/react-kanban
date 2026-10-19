import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PercussionClassifier} from '../extensions/kanban-music/percussion-classifier.js';
import {quantiles} from './summarize-beat-delivery.mjs';

// Score frame c is emitted only by the frozen batch whose newest frame is r.
export function inputReleaseFrame(scoreFrame,{rightContext,stepFrames}) {
  assert(Number.isInteger(scoreFrame)&&scoreFrame>=0);
  assert(Number.isInteger(rightContext)&&rightContext>=0);
  assert(Number.isInteger(stepFrames)&&stepFrames>0);
  return Math.ceil((scoreFrame+rightContext+1)/stepFrames)*stepFrames-1;
}

export function replayRelease(frames,config,{firstScoreFrame}={}) {
  const classifier=new PercussionClassifier(config.thresholds,{onsetGuided:true});
  const first=frames[0]?.audioTime,events=[];
  for(const [decisionFrame,frame] of frames.entries()) {
    for(const event of classifier.push(frame.scores,frame.audioTime).events) {
      const peakFrame=Math.round((event.audioTime-first)*config.fps);
      const inputFrame=Number.isInteger(firstScoreFrame)?inputReleaseFrame(firstScoreFrame+decisionFrame,config):null;
      const futureFrames=decisionFrame-peakFrame+config.rightContext;
      events.push({band:event.band,audioTime:event.audioTime,peakFrame,decisionFrame,inputFrame,
        finalizationMs:(frame.audioTime-event.audioTime)*1000,
        requiredInputAfterPeakMs:inputFrame===null?null:(inputFrame-firstScoreFrame-peakFrame)/config.fps*1000+config.fftSize/2/config.sampleRate*1000,
        minimumRequiredInputAfterPeakMs:futureFrames/config.fps*1000+config.fftSize/2/config.sampleRate*1000,
        maximumRequiredInputAfterPeakMs:(futureFrames+config.stepFrames-1)/config.fps*1000+config.fftSize/2/config.sampleRate*1000,
        observedAvailableAfterPeakMs:Number.isFinite(frame.availableAudioTime)?(frame.availableAudioTime-event.audioTime)*1000:null});
    }
  }
  return events;
}

export function structuralFloor(config) {
  assert.equal(config.hopSize*config.fps,config.sampleRate);
  const checks=[];
  for(const classIndex of [0,1,3])for(let phase=0;phase<config.stepFrames;phase++) {
    const peak=20+phase;
    const frames=Array.from({length:60},(_,i)=>({audioTime:i/config.fps,
      scores:Array.from({length:5},(_,c)=>i===peak&&c===classIndex?1:0)}));
    const emitted=replayRelease(frames,config,{firstScoreFrame:0});
    assert.equal(emitted.length,1);assert.equal(emitted[0].peakFrame,peak);
    checks.push({classIndex,phase,...emitted[0]});
  }
  const extended=Array.from({length:140},(_,i)=>({audioTime:i/config.fps,
    scores:[0,i>=20&&i<120?(i%2===0?1:.51):0,0,0,0]}));
  const grouped=replayRelease(extended,config,{firstScoreFrame:0});
  return {scope:'Frozen classifier dependency audit on constructed activation streams, not acoustic recognition scores.',
    fftCenterMs:config.fftSize/2/config.sampleRate*1000,
    modelFutureMs:{minimum:config.rightContext/config.fps*1000,
      maximum:(config.rightContext+config.stepFrames-1)/config.fps*1000},
    singletonChecks:checks,
    singletonInputAgeMs:quantiles(checks.map(x=>x.requiredInputAfterPeakMs)),
    singletonFinalizationMs:quantiles(checks.map(x=>x.finalizationMs)),
    extendedGroupChecks:grouped,
    caveat:'Input availability excludes inference, worklet quantum/dispatch, IPC, rendering and output-clock mapping. Extended groups can wait longer than the singleton floor; this is not a universal upper bound or physical latency.'};
}

export function captureClockAges(input,config) {
  const rows=[...(input.offscreen?.telemetry?.records||[]),...(input.backgroundTelemetry?.records||[]),
    ...(input.trace?.telemetry?.records||[])];
  const events=[];
  for(const timing of rows.filter(r=>r.stage==='DETECTOR_TIMING')) {
    const queue=rows.find(r=>r.id===timing.id&&r.component==='capture-engine'&&r.stage==='EVENT_QUEUED');
    const mapped=rows.find(r=>r.id===timing.id&&r.component==='beat-sync'&&r.stage==='EVENT_SENT'&&r.targetClock==='epoch-ms');
    if(!queue||![queue.audioTime,queue.targetTime,timing.audioTime,timing.modelInputAudioTime,timing.decisionAudioTime].every(Number.isFinite))continue;
    const ahead=Math.round((timing.modelInputAudioTime-timing.audioTime)*config.fps)-config.rightContext;
    const horizon=Math.round((timing.decisionAudioTime-timing.audioTime)*config.fps);
    if(ahead<0||ahead>=config.stepFrames||horizon<0)continue;
    const decisionInput=timing.modelInputAudioTime+Math.ceil((horizon-ahead)/config.stepFrames)*config.stepFrames/config.fps;
    events.push({id:timing.id,type:timing.type,
      requiredInputAfterPeakMs:(decisionInput-timing.audioTime)*1000+config.fftSize/2/config.sampleRate*1000,
      inputAgeAtQueueMs:(queue.audioTime-timing.audioTime)*1000,
      estimatedOutputAdditionMs:(queue.targetTime-timing.audioTime)*1000,
      mappedTargetAgeAtQueueMs:mapped?queue.at-mapped.targetTime:null});
  }
  return {scope:'Joined frozen-model drum IDs. Audio-time release floor, actual input age and epoch mapped-target age are separate; output addition is an estimate, not physical calibration.',
    summary:Object.fromEntries(['requiredInputAfterPeakMs','inputAgeAtQueueMs','estimatedOutputAdditionMs','mappedTargetAgeAtQueueMs']
      .map(key=>[key,quantiles(events.map(e=>e[key]))])),events};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const output=process.argv.find(x=>x.startsWith('--output='))?.slice(9);
  const configPath='extensions/kanban-music/generated/percussion/percussion.json';
  const configBytes=await readFile(configPath),config=JSON.parse(configBytes);
  const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
  const replays=[];
  for(const path of process.argv.slice(2).filter(x=>!x.startsWith('--'))) {
    const bytes=await readFile(path),saved=JSON.parse(bytes);
    assert.equal(saved.model.sha256,config.sha256,'Only the frozen model activation stream is admissible');
    assert.equal(saved.candidate,'onset-guided','Replay must match the private frozen classifier');
    for(const run of saved.results) {
      const events=replayRelease(run.activations,config).filter(e=>e.audioTime>=run.audioOrigin&&e.audioTime<run.audioOrigin+run.seconds);
      const identities=rows=>rows.map(e=>e.band+':'+e.audioTime.toFixed(8)).sort();
      replays.push({path,sha256:sha(bytes),input:run.input,frames:run.activations.length,
        complete:!run.activationsTruncated&&!run.eventsTruncated,eventCount:events.length,
        savedEventParity:JSON.stringify(identities(events))===JSON.stringify(identities(run.events)),
        finalizationMs:quantiles(events.map(e=>e.finalizationMs)),
        phaseKnown:false,
        minimumRequiredInputAgeMs:quantiles(events.map(e=>e.minimumRequiredInputAfterPeakMs)),
        maximumRequiredInputAgeMs:quantiles(events.map(e=>e.maximumRequiredInputAfterPeakMs)),
        observedAvailableAgeMs:quantiles(events.map(e=>e.observedAvailableAfterPeakMs)),events});
    }
  }
  const deliveries=[];
  for(const argument of process.argv.filter(x=>x.startsWith('--delivery='))) {
    const path=argument.slice(11),bytes=await readFile(path);
    deliveries.push({path,sha256:sha(bytes),...captureClockAges(JSON.parse(bytes),config)});
  }
  const result={configSha256:sha(configBytes),modelSha256:config.sha256,
    classifierSha256:sha(await readFile('extensions/kanban-music/percussion-classifier.js')),
    floor:structuralFloor(config),replays,deliveries,physicalSynchronization:'UNVERIFIED'};
  const json=JSON.stringify(result,null,2);if(output)await writeFile(output,json);else console.log(json);
}
