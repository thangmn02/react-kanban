import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {quantiles,summarizeDelivery} from './summarize-beat-delivery.mjs';

export function deadlineSummary(records) {
  const batches=records.filter(r=>r.stage==='WORKER_BATCH');
  const delta=(a,b)=>quantiles(batches.flatMap(r=>Number.isFinite(r[a])&&Number.isFinite(r[b])?[r[a]-r[b]]:[]));
  return {batches:batches.length,workletPostedToWorkerReceiptMs:delta('workerReceivedAt','featurePostedAt'),
    workerReceiptToInferenceMs:delta('inferenceStartedAt','workerReceivedAt'),inferenceMs:delta('inferenceEndedAt','inferenceStartedAt'),
    inferenceOver50ms:batches.filter(r=>r.inferenceEndedAt-r.inferenceStartedAt>50).length,
    observedQueueMaximum:batches.length?Math.max(...batches.map(r=>r.queueDepth||0)):null,
    queueScope:'JS queue depth excludes waiting before worker receipt, including main-thread forwarding and worker inbox. It is not a complete backlog measurement.'};
}

export function accountIds(records,ids) {
  const stages=['EVENT_DETECTED','EVENT_SENT','EVENT_RECEIVED','EVENT_SCHEDULED','EVENT_ACCEPTED','EVENT_COMMITTED','EVENT_RENDERED'];
  const entries=ids.map(id=>{const rows=records.filter(r=>r.id===id);
    return {id,stages:Object.fromEntries(stages.map(s=>[s,rows.some(r=>r.stage===s)])),
      drops:rows.filter(r=>r.stage==='EVENT_DROPPED').map(r=>({component:r.component,reason:r.reason})),
      firstAnimationDelayMs:(()=>{const r=rows.filter(r=>r.component==='beat-renderer'&&r.stage==='EVENT_RENDERED'
        &&r.targetClock==='epoch-ms').sort((a,b)=>a.at-b.at)[0];return r?r.at-r.targetTime:null;})()};});
  return {count:ids.length,stages:Object.fromEntries(stages.map(s=>[s,entries.filter(e=>e.stages[s]).length])),
    firstAnimationDelayMs:quantiles(entries.map(e=>e.firstAnimationDelayMs)),entries};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const root='scratch/matched-track-quality-gap';
 const read=async p=>JSON.parse(await readFile(root+'/'+p,'utf8'));
 const offline=await read('offline-events.json'),runs=[];
 for(const name of ['live-L0-bounded','live-L1-bounded','live-L0-clean','live-L1-clean']){
  const raw=await read(name+'/foreground-latency-live-a.json');
  const records=[...raw.offscreen.telemetry.records,...raw.backgroundTelemetry.records,...raw.trace.telemetry.records];
  const idsByType={};
  for(const type of ['kick','snare','hat','bass'])idsByType[type]=[...new Set(records.filter(r=>r.source==='onset'&&r.type===type
    &&r.component==='media-bridge'&&r.stage==='EVENT_RECEIVED'&&r.targetPlaybackTime>=20&&r.targetPlaybackTime<50).map(r=>r.id))];
  runs.push({name,deliveredPassage:Object.fromEntries(Object.entries(idsByType).map(([type,ids])=>[type,accountIds(records,ids)])),
    delivery:summarizeDelivery(raw),deadline:deadlineSummary(records),
    scope:'Published playback targets select [20,50); mapped targets are not independent acoustic references. Bounded diagnostics have separate PCM-aligned prediction accounting.'});
 }
 const h0=[];
 for(const envelope of ['short','original']){
  const raw=await read('h0-observed/product-h0-'+envelope+'.json'),records=raw.completeTelemetry.records;
  const events=offline.tracks.H0.filter(e=>e.time>=20&&e.time<50),chosen=new Map();
  for(const event of events){const accepted=records.filter(r=>r.eventId===event.id&&r.stage==='EVENT_ACCEPTED').sort((a,b)=>b.at-a.at)[0];
    chosen.set(event.id,accepted?.id);}
  const frames=raw.frameSamples,seen=new Set(frames.flatMap(f=>f.visibleTraceIds));
  const byType={};
  for(const type of ['kick','snare','hat']){const selected=events.filter(e=>e.instrument===type),ids=selected.map(e=>chosen.get(e.id)).filter(Boolean);
    byType[type]={predicted:selected.length,...accountIds(records,ids),
      viewportOpacityObserved:ids.filter(id=>seen.has(id)).length};}
  const hats=events.filter(e=>e.instrument==='hat').sort((a,b)=>a.time-b.time),rapid=[];
  for(const spacing of [20,30,50,80,125,200]){
    const pairs=hats.slice(1).flatMap((b,i)=>Math.abs((b.time-hats[i].time)*1000-spacing)<=5+1e-7?[[hats[i],b]]:[]);
    const observed=pairs.filter(pair=>pair.every(e=>seen.has(chosen.get(e.id))));
    rapid.push({nominalSpacingMs:spacing,pairs:pairs.length,bothViewportOpacityObserved:observed.length,
      bothCommitted:pairs.filter(pair=>pair.every(e=>records.some(r=>r.id===chosen.get(e.id)&&r.stage==='EVENT_COMMITTED'))).length,
      bothAnimationCallback:pairs.filter(pair=>pair.every(e=>records.some(r=>r.id===chosen.get(e.id)&&r.stage==='EVENT_RENDERED'))).length,
      perceptualSeparation:'UNVERIFIED',scope:pairs.length?'Natural saved CNN proposals, not verified acoustic attacks. +/-5ms bin.':'No matching pair in this exact passage; actual-controller visibility unavailable.'});
  }
  h0.push({envelope,byType,rapid,frameSamples:frames.length,externalTransportStagesApplicable:false,
    scope:'Actual product H0 route. Old seek-reset generations are not losses of the later accepted trace. Viewport/opacity is a DOM proxy, not physical visibility or perceptual separation.'});
 }
 const result={runs,h0,physicalSynchronization:'UNVERIFIED',officialSongMetricsAllowed:false};
 await writeFile(root+'/event-accounting.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({runs:runs.map(r=>({name:r.name,passage:Object.fromEntries(Object.entries(r.deliveredPassage).map(([k,v])=>[k,{count:v.count,stages:v.stages}])),deadline:r.deadline})),
  h0:h0.map(r=>({envelope:r.envelope,types:Object.fromEntries(Object.entries(r.byType).map(([k,v])=>[k,{predicted:v.predicted,stages:v.stages,observed:v.viewportOpacityObserved}])),rapid:r.rapid}))}));
}
