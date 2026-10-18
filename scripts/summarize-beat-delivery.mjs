import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export function quantiles(values) {
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  return sorted.length?{n:sorted.length,median:sorted[Math.floor((sorted.length-1)*.5)],
    p95:sorted[Math.ceil((sorted.length-1)*.95)],worst:sorted.at(-1)}:null;
}

export function assessCaptureContinuity(samples,records,{startedAt,eofAt}={}) {
  const playing=samples.filter(sample=>!sample.playback?.ended);
  const failures=playing.filter(sample=>sample.health?.context!=='running'||sample.health?.bufferMs!==0
    ||sample.health?.dropReason!=='none'||sample.health?.workerFailures!==0||sample.playback?.paused);
  // Allow the pause/ended event ordering within one 100 ms source-clock poll.
  const bad=records.filter(row=>row.at>=startedAt&&(
    row.stage==='CAPTURE_REPLACED'||
    row.stage==='EVENT_DROPPED'&&['worker-failed','worker-stalled','worker-backlog','audio-backlog','transport','capture-disconnected'].includes(row.reason)||
    ['PREVIEW_REVOKED','CAPTURE_STOP'].includes(row.stage)&&!(Number.isFinite(eofAt)&&row.at>=eofAt-100&&
      (row.stage==='PREVIEW_REVOKED'&&row.previewReason==='not-playing'||
        row.stage==='CAPTURE_STOP'&&['stopped','ended','track-changed','not-playing'].includes(row.reason)))));
  const eof=samples.at(-1)?.playback?.ended===true;
  return {status:failures.length||bad.length?'FAIL':eof&&Number.isFinite(startedAt)&&Number.isFinite(eofAt)&&playing.length?'PASS':'PARTIAL',
    playingSamples:playing.length,unhealthySamples:failures.length,unexpectedLifecycleRecords:bad.length,
    naturalEof:eof,exactEofEventTimeRecorded:Number.isFinite(eofAt),eofEventToleranceMs:100,
    scope:'Five-second health samples plus collected lifecycle/failure records; not continuous PCM or physical synchronization proof.'};
}

export function summarizeDelivery(input) {
  const records=[...(input.offscreen?.telemetry?.records||[]),...(input.backgroundTelemetry?.records||[]),
    ...(input.trace?.telemetry?.records||input.telemetry?.records||[])];
  const events=new Map();
  for(const row of records) {
    if(!row.id||row.source!=='onset'||!['kick','snare','hat','bass'].includes(row.type))continue;
    const event=events.get(row.id)||{type:row.type,stages:{}};events.set(row.id,event);
    const key=row.component+':'+row.stage;
    if(!event.stages[key]||event.stages[key].at>row.at)event.stages[key]=row;
  }
  const pair=(a,b)=>quantiles([...events.values()].flatMap(event=>{
    const start=event.stages[a],end=event.stages[b];return start&&end?[end.at-start.at]:[];
  }));
  const byType={};
  for(const type of ['kick','snare','hat','bass']) {
    const selected=[...events.values()].filter(event=>event.type===type);
    const delay=stage=>quantiles(selected.flatMap(event=>{
      const row=event.stages['beat-renderer:'+stage];
      return row?.targetClock==='epoch-ms'&&Number.isFinite(row.targetTime)?[row.at-row.targetTime]:[];
    }));
    byType[type]={uniqueIds:selected.length,commitDelayMs:delay('EVENT_COMMITTED'),animationDelayMs:delay('EVENT_RENDERED')};
  }
  const timing=records.filter(row=>row.stage==='DETECTOR_TIMING');
  const difference=(end,start,scale=1)=>quantiles(timing.flatMap(row=>
    Number.isFinite(row[end])&&Number.isFinite(row[start])?[(row[end]-row[start])*scale]:[]));
  const batches=records.filter(row=>row.stage==='WORKER_BATCH');
  return {scope:'Software epoch/audio clocks only; source relative targets are model predictions, not verified acoustic onsets. Quantiles cannot be added.',
    byType,stageMs:{offscreenToBackground:pair('offscreen:EVENT_SENT','beat-sync:EVENT_RECEIVED'),
      backgroundToApp:pair('beat-sync:EVENT_SENT','media-bridge:EVENT_RECEIVED'),
      appToScheduler:pair('media-bridge:EVENT_RECEIVED','beat-scheduler:EVENT_SCHEDULED'),
      schedulerToController:pair('beat-scheduler:EVENT_SCHEDULED','beat-controller:EVENT_ACCEPTED'),
      controllerToDom:pair('beat-controller:EVENT_ACCEPTED','beat-renderer:EVENT_COMMITTED'),
      domToAnimation:pair('beat-renderer:EVENT_COMMITTED','beat-renderer:EVENT_RENDERED')},
    detectorMs:{peakFeatureCenterAndBatch:difference('peakFeatureAvailableAudioTime','audioTime',1000),
      modelFutureAndBatch:difference('modelInputAudioTime','audioTime',1000),
      finalInputFftCenter:difference('modelInputAvailableAudioTime','modelInputAudioTime',1000),
      workletToWorker:difference('workerReceivedAt','featurePostedAt'),
      workerQueue:difference('inferenceStartedAt','workerReceivedAt'),
      inference:difference('inferenceEndedAt','inferenceStartedAt'),
      peakFinalizationAudio:difference('decisionAudioTime','audioTime',1000),
      peakFinalizationWall:difference('decisionAt','inferenceEndedAt'),
      resultToCapture:difference('receivedAt','decisionAt')},
    batches:{n:batches.length,durationMs:quantiles(batches.map(row=>row.durationMs)),
      featureComputeMs:quantiles(batches.map(row=>row.featureComputeMs)),
      maxQueueDepth:batches.length?Math.max(...batches.map(row=>row.queueDepth||0)):null},
    explicitDrops:records.filter(row=>row.stage==='EVENT_DROPPED').reduce((out,row)=>{
      const key=(row.component||'unknown')+':'+(row.reason||'unknown');out[key]=(out[key]||0)+1;return out;
    },{})};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const output=process.argv.find(value=>value.startsWith('--output='))?.slice(9);
  const paths=process.argv.slice(2).filter(value=>!value.startsWith('--'));
  if(!paths.length)throw Error('Provide one or more exported live/offline trace JSON paths');
  const runs=[];for(const path of paths)runs.push({path,...summarizeDelivery(JSON.parse(await readFile(path,'utf8')))});
  const result=JSON.stringify({runs},null,2);if(output)await writeFile(output,result);else console.log(result);
}
