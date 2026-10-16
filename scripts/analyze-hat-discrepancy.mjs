import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {temporalMatch} from './score-percussion-annotations.mjs';
import {alignHatFeatures} from './hat-feature-alignment.mjs';
const folder=resolve('scratch/hat-playback-discrepancy');
const read=async name=>JSON.parse(await readFile(resolve(folder,name),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const median=a=>a.toSorted((x,y)=>x-y)[Math.floor(a.length/2)];
const stats=a=>{const s=a.filter(Number.isFinite).toSorted((x,y)=>x-y);return {n:s.length,median:s[Math.floor(s.length/2)]??null,p95:s[Math.ceil(s.length*.95)-1]??null,max:s.at(-1)??null};};
const counts=a=>a.reduce((r,k)=>{r[k]=(r[k]||0)+1;return r;},{});
const manifest=await read('manifest.json'),renderer=await read('renderer-results.json');
assert.deepEqual(renderer.errors,[]);
assert.deepEqual(renderer.runs.map(r=>`${r.reducedMotion}/${r.mode}/${r.intervalMs}`).sort(),
 ['no-preference','reduce'].flatMap(m=>['A','R'].flatMap(v=>[20,30,50,80,125,200].map(g=>`${m}/${v}/${g}`))).sort(),'Incomplete or duplicate renderer run matrix');
for(const gap of [50,80])assert.equal(renderer.runs.find(r=>r.mode==='R'&&r.reducedMotion==='no-preference'&&r.intervalMs===gap).visibleAttacks.length,6,'Recovery did not preserve six renderer-only attacks');
for(const run of renderer.runs.filter(r=>r.mode==='R'&&r.reducedMotion==='reduce')){
 assert(Math.abs(Math.max(...run.samples.map(s=>s.overlay))-.35)<1e-6,'Reduced motion activity level changed');
 assert.equal(run.visibleAttacks.length,0,'Reduced motion unexpectedly produced rapid bright flashes');
}
const clean=await read('actual-msedge-xo-hat-only-snare-only.json'),loaded=await read('actual-msedge-xo-load.json');
assert.deepEqual(clean.errors,[]);assert.deepEqual(loaded.errors,[]);
assert.deepEqual(clean.results.map(r=>r.variant+'/'+r.input).sort(),['A/hat-only','A/snare-only','A/xo','R/hat-only','R/snare-only','R/xo']);
assert.deepEqual(loaded.results.map(r=>r.variant+'/'+r.input),['R/xo']);
const report={baselineRevision:manifest.baselineRevision,sourceSha256:manifest.sourceSha256,
 manifestSha256:hash(await readFile(resolve(folder,'manifest.json'))),modelSha256:manifest.modelSha256,
 classifier:'onset-guided',previousBEnabled:false,correction:'Private Hat visualization only: 40 ms transient; suppress underlying Hat decorative fill',
 naturalAccuracyGate:'BLOCKED',physicalTimingGate:'BLOCKED',officialNaturalMetricsCalculated:false,
 T6:{status:'UNAVAILABLE',reason:'No existing time-aligned XO Hat stem. No separation/model download performed.'},
 renderer:renderer.runs.map(r=>({mode:r.mode,intervalMs:r.intervalMs,reducedMotion:r.reducedMotion,events:r.emitted.length,
  visibleIds:r.distinctVisibleIds,visibleRetriggers:r.visibleAttacks.length,frameGap:stats(r.samples.slice(1).map((s,i)=>s.at-r.samples[i].at))})),runs:[],cases:[]};
function flatten(blocks){return blocks.flatMap(b=>b.times.map((time,i)=>({time,data:b.data.slice(i*84,(i+1)*84)})));}
function visibleEnvelope(samples,start,end){
 const selected=samples.filter(s=>s.at>=start&&s.at<=end);assert(selected.length>10,'Missing actual viewport brightness samples');
 const attacks=[],spans=[];let attack=null;
 for(const s of selected){if(s.level<=.3&&attack!==null){spans.push({start:attack,end:s.at,durationMs:s.at-attack});attack=null;}
  if(s.level>=.5&&attack===null){attacks.push(s.at);attack=s.at;}}
 if(attack!==null)spans.push({start:attack,end:null,durationMs:end-attack,rightCensored:true});
 return {start,end,sampleCount:selected.length,visibleIds:[...new Set(selected.flatMap(s=>s.ids))],attacks,spans,
  frameGapMs:stats(selected.slice(1).map((s,i)=>s.at-selected[i].at))};
}
for(const run of clean.results){
 assert(run.finishedAt);assert.equal(run.classifier,'onset-guided');assert.equal(run.finalMode.detectorVersion,'hat-'+run.variant);
 assert.equal(run.finalMode.bufferMs,500);assert.equal(run.finalMode.allowTypedPreview,true);
 assert(run.samples.every(s=>s.visualExperiment===(run.variant==='R'?'hat-transient-40ms':'baseline-150ms')),'Wrong renderer experiment identity');
 assert.equal(run.assetHashes['generated/percussion/percussion.onnx'],manifest.modelSha256);
 for(const file of ['percussion-features.js','percussion-classifier.js'])assert.equal(run.assetHashes[file],clean.results[0].assetHashes[file]);
 assert(run.samples.every(s=>s.bufferMs===500&&s.mode==='experimental-buffered'
  &&(s.generation===undefined||s.generation===0)),'Source generation/output changed');
 assert(run.samples.filter(s=>s.generation===0).length>=10&&run.finalMode.generation===0&&run.clockAtSnapshot.generation===0,'Insufficient explicit generation proof');
 assert.equal(new Set(run.predictions.map(p=>p.captureId)).size,1,'Capture replaced during clean passage');
 assert(run.samples.every(s=>!s.sourceClock.paused&&s.sourceClock.playbackRate===1),'Source stopped/changed rate');
 assert(run.samples.slice(1).every((s,i)=>Math.abs(s.sourceClock.currentTime-run.samples[i].sourceClock.currentTime
  -(s.sourceClock.sampledAt-run.samples[i].sourceClock.sampledAt)/1000)<=.1),'Source clock discontinuity');
 assert(run.samples.length>10&&run.samples.every(s=>s.outputClock?.contextState==='running'
  &&[s.outputClock.timeOrigin,s.outputClock.outputTimestamp?.contextTime,s.outputClock.outputTimestamp?.performanceTime].every(Number.isFinite)
  &&s.outputClock.outputTimestamp.performanceTime>0),'Missing/invalid controlled output-clock provenance');
 const id=run.variant+'-'+run.input+(run.load?'-load':''),fixture=manifest.fixtures.find(f=>f.id===(run.input==='xo'?'trap':run.input));
 assert.equal(run.sourceFileSha256,fixture.sourceSha256);
 const source=await read('source-features/'+fixture.id+'.json'),offline=await read('baseline-offline/'+fixture.id+'.json');
 assert.equal(source.decodedPcmSha256,offline.decodedPcmSha256,'Offline source decoding changed');
 const features=flatten(source.featureBlocks),captured=flatten(run.featureBlocks);
 const offsets=run.samples.map(s=>s.sourceClock.currentTime+(s.outputClock.sampledAt-s.sourceClock.sampledAt)/1000-s.outputClock.currentAudioTime);
 assert(offsets.length>10&&offsets.every(Number.isFinite));
 const alignment=alignHatFeatures(features,captured,median(offsets),run.analysisStart,run.analysisEnd);
 const groups=new Map();for(const record of run.records){if(!record.id)continue;if(!groups.has(record.id))groups.set(record.id,[]);groups.get(record.id).push(record);}
 const outputDeadline=(audioTime,at)=>{
  const sample=run.samples.filter(s=>s.outputClock?.outputTimestamp?.performanceTime>0).toSorted((a,b)=>Math.abs(a.at-at)-Math.abs(b.at-at))[0];
  assert(sample,'No controlled output-clock anchor');const c=sample.outputClock;
  return c.timeOrigin+c.outputTimestamp.performanceTime+(audioTime+.5-c.outputTimestamp.contextTime)*1000;
 };
 const ledger=run.predictions.map(prediction=>{
  const contentSourceTime=prediction.audioTime+alignment.offset,records=groups.get(prediction.traceId)||[];
  const target=records.find(r=>Number.isFinite(r.targetPlaybackTime)),visible=run.flashes.find(f=>f.id===prediction.traceId);
  const audibleProxy=outputDeadline(prediction.audioTime,prediction.receivedAt);
  const known=fixture.events?.filter(e=>e.row===(prediction.band==='clap'?'snare':prediction.band)).toSorted((a,b)=>Math.abs(a.time-contentSourceTime)-Math.abs(b.time-contentSourceTime))[0]||null;
  const knownMatched=known&&Math.abs(known.time-contentSourceTime)<=Math.min(.04,known.intervalMs/4000);
  const knownOutput=knownMatched?outputDeadline(known.time-alignment.offset,prediction.receivedAt):null;
  return {...prediction,contentSourceTime,uiTargetSourceTime:target?.targetPlaybackTime??null,
   knownOnset:known,knownOnsetMatched:!!knownMatched,knownOnsetOutputClock:knownOutput,
   visibleMinusKnownOutputMs:visible&&knownOutput!==null?visible.at-knownOutput:null,
   accepted:records.some(r=>r.stage==='EVENT_ACCEPTED'),received:records.some(r=>r.stage==='EVENT_RECEIVED'),
   sent:records.some(r=>r.stage==='EVENT_SENT'&&r.component==='capture-engine'),scheduled:records.some(r=>r.stage==='EVENT_SCHEDULED'),
   committed:records.some(r=>r.stage==='EVENT_COMMITTED'),animation:records.some(r=>r.stage==='EVENT_RENDERED'),
   visible:visible||null,outputClockDeadline:audibleProxy,visibleMinusOutputMs:visible?visible.at-audibleProxy:null,
   modelEmissionMs:(prediction.receivedAudioTime-prediction.audioTime)*1000,
   transportMs:target?target.at-prediction.receivedAt:null,
   drops:records.filter(r=>r.stage==='EVENT_DROPPED').map(r=>({component:r.component,reason:r.reason})),records};
 }).filter(e=>e.contentSourceTime>=run.analysisStart&&e.contentSourceTime<run.analysisEnd);
 const replay=await read('captured-replay/baseline-offline/'+id+'.json');
 let maximumScoreDifference=0,compared=0;
 const replayFrames=new Map(replay.activations.map(f=>[f.audioTime.toFixed(7),f]));
 const warmup=run.featureBlocks[0].times[0]+1.2;
 for(const f of run.frames){if(f.audioTime<warmup)continue;const match=replayFrames.get(f.audioTime.toFixed(7));if(!match)continue;
  compared++;for(let i=0;i<5;i++)maximumScoreDifference=Math.max(maximumScoreDifference,Math.abs(f.scores[i]-match.scores[i]));}
 assert(compared>1000,'Captured replay lacks enough comparable frames');
 if(!run.load)assert(maximumScoreDifference<1e-6,'Same captured model inputs did not reproduce the real scores');
 const rows=Object.fromEntries(['kick','clap','hat'].map(b=>{const events=ledger.filter(e=>e.band===b);return [b,{classifier:events.length,
  sent:events.filter(e=>e.sent).length,received:events.filter(e=>e.received).length,scheduled:events.filter(e=>e.scheduled).length,
  accepted:events.filter(e=>e.accepted).length,committed:events.filter(e=>e.committed).length,visible:events.filter(e=>e.visible).length,
  drops:counts(events.flatMap(e=>e.drops.map(d=>d.component+':'+d.reason)))}];}));
 const controlled=fixture.kind==='controlled-acoustic'?fixture.segments.map(segment=>({...segment,rows:Object.fromEntries(['kick','snare','hat'].map(row=>{
  const references=fixture.events.filter(e=>e.row===row&&e.time>=segment.start&&e.time<segment.end).map(e=>e.time);
  const events=ledger.filter(e=>e.band===(row==='snare'?'clap':row)&&e.contentSourceTime>=segment.start&&e.contentSourceTime<segment.end);
  const match=temporalMatch(references,events.map(e=>e.contentSourceTime),segment.matchingToleranceMs/1000);
  return [row,{matched:match.tp,unmatchedPredictions:match.fp,unmatchedReferences:match.fn,timingErrorsMs:match.timingErrorsMs}];}))})):null;
 const naturalAgreement=fixture.kind==='natural-music'?Object.fromEntries(['kick','clap','hat'].map(b=>{
  const a=offline.events.filter(e=>e.band===b&&e.audioTime>=45&&e.audioTime<57).map(e=>e.audioTime),c=ledger.filter(e=>e.band===b).map(e=>e.contentSourceTime);
  const m=temporalMatch(a,c,.02);return [b,{matchedPredictions:m.tp,unpairedOffline:m.fn,unpairedCapture:m.fp,toleranceMs:20,accuracyScoring:false}];})):null;
 const sourceToUiOffsets=ledger.filter(e=>e.uiTargetSourceTime!==null).map(e=>(e.uiTargetSourceTime-e.contentSourceTime)*1000);
 const hatVisibility=fixture.kind==='controlled-acoustic'?fixture.segments.map(segment=>{
  const known=fixture.events.filter(e=>e.time>=segment.start&&e.time<segment.end),at=run.samples[0].at;
  const start=outputDeadline(Math.min(...known.map(e=>e.time))-alignment.offset,at)-100;
  const end=outputDeadline(Math.max(...known.map(e=>e.time))-alignment.offset,at)+400;
  return {intervalMs:segment.intervalMs,knownHatOnsets:known.filter(e=>e.row==='hat').length,
   classifierHatEvents:ledger.filter(e=>e.band==='hat'&&e.contentSourceTime>=segment.start&&e.contentSourceTime<segment.end).length,
   ...visibleEnvelope(run.compositeHatSamples,start,end)};
 }):null;
 const outputSamples=run.samples.map(s=>s.outputClock);
 const item={id,variant:run.variant,input:run.input,loaded:!!run.load,load:run.load||null,browser:run.browser,sourceSha256:run.sourceFileSha256,
  packageSha256:run.packageSha256,alignment,
  generationProvenance:{generation:0,missingEarlyMetadataSamples:run.samples.filter(s=>s.generation===undefined).length,stableCaptureId:true,continuousSourceClock:true},
  sourceClockLabelOffsetMs:stats(sourceToUiOffsets),rows,controlled,naturalAgreement,hatVisibility,
  visibilityMethod:'Viewport computed-style RGB plus overlay alpha; attack >=0.5 after decay <=0.3; no physical luminance or human perception claim.',
  capturedFeatureReplay:{comparedFrames:compared,maximumScoreDifference},
  timing:{emissionMs:stats(ledger.map(e=>e.modelEmissionMs)),transportMs:stats(ledger.map(e=>e.transportMs)),
   visibleMinusPredictedOutputMs:stats(ledger.map(e=>e.visibleMinusOutputMs)),
   absoluteVisibleMinusPredictedOutputMs:stats(ledger.map(e=>e.visibleMinusOutputMs===null?NaN:Math.abs(e.visibleMinusOutputMs))),
   visibleMinusKnownOutputMs:stats(ledger.map(e=>e.visibleMinusKnownOutputMs)),
   lagMs:stats(outputSamples.map(c=>c.analysisLagMs)),inferenceMs:stats(outputSamples.map(c=>c.lastInferenceMs)),
   outputClockAdvancedSeconds:outputSamples.at(-1).outputTimestamp.contextTime-outputSamples[0].outputTimestamp.contextTime,
   outputRunning:outputSamples.every(c=>c.contextState==='running'),
   drops:counts(run.records.filter(r=>r.stage==='EVENT_DROPPED').map(r=>r.component+':'+r.reason))},cpu:run.cpu,ledger};
 report.runs.push(item);
 console.log(JSON.stringify({id,alignment:{offset:alignment.offset,nrmse:alignment.normalizedRmse},rows,modelReplay:item.capturedFeatureReplay,timing:item.timing}));
}
const stress=loaded.results[0];assert(stress.finishedAt&&stress.load.completed.restored);
const stressClocks=stress.samples.filter(s=>Number.isFinite(s.outputClock?.currentAudioTime));
report.load={sourceSha256:stress.sourceFileSha256,packageSha256:stress.packageSha256,configuration:stress.load,
 finalMode:stress.finalMode,samples:stress.samples,
 missingOutputClockSamples:stress.samples.length-stressClocks.length,
 lagMs:stats(stressClocks.map(s=>s.outputClock.analysisLagMs)),inferenceMs:stats(stressClocks.map(s=>s.outputClock.lastInferenceMs)),
 contextResets:stressClocks.slice(1).filter((s,i)=>s.outputClock.currentAudioTime<stressClocks[i].outputClock.currentAudioTime).length,
 drops:counts(stress.records.filter(r=>r.stage==='EVENT_DROPPED').map(r=>r.component+':'+r.reason)),
 interpretation:'CPU stress is a robustness failure, not a clean accuracy comparison. Capture replacement/output loss, if observed, is kept explicit; no single audio clock is fit across a reset.',
 records:stress.records};
const xoA=report.runs.find(r=>r.id==='A-xo');
for(const run of report.runs)for(const event of run.ledger.filter(e=>e.accepted&&e.committed&&!e.visible)){
 report.cases.push({source:run.input,run:run.id,sourceTime:event.contentSourceTime,traceId:event.traceId,
  classification:'UNRESOLVED_ACOUSTIC_IDENTITY',observedStage:'VISIBILITY_OBSERVATION_FAILURE',
  firstStage:'DOM committed, but no sampled visible attack',animationObserved:event.animation,
  timingDenominator:{emitted:run.ledger.length,visible:run.ledger.filter(e=>e.visible).length},
  uncertainty:'Accepted model proposal; instrument identity and the renderer visibility mechanism are unresolved. Missing observations are excluded from timing percentiles and counted explicitly here.'});
}
for(const cue of [47.346,53.459]){
 const raw=await read('baseline-offline/trap.json'),frames=raw.activations.filter(f=>Math.abs(f.audioTime-cue)<.15);
 report.cases.push({sourceInterval:[cue-.15,cue+.15],classification:'UNRESOLVED_ACOUSTIC_IDENTITY',firstStage:'acoustic identity/model representation',
  evidence:`Provisional Snare cue; maximum Snare score ${Math.max(...frames.map(f=>f.scores[1])).toFixed(4)} in search interval.`,
  uncertainty:'Human instrument identity and timestamp are unverified; not an official missed attack.'});
}
for(const lost of xoA.ledger.filter(e=>e.drops.length))report.cases.push({sourceTime:lost.contentSourceTime,traceId:lost.traceId,
 classification:'UNRESOLVED_ACOUSTIC_IDENTITY',observedStage:'TRANSPORT_OR_CONTROLLER_LOSS',firstStage:'Hat/Cymbal identity before debounce',
 hypotheses:['SUBTYPE_DUPLICATION'],evidence:lost.drops,uncertainty:'A dropped model proposal is observed; it is not established as a genuine separate Hat.'});
const hatRaw=await read('baseline-offline/hat-only.json');
const suppressed=hatRaw.decisions.find(d=>d.classIndex===3&&d.audioTime>=49&&d.audioTime<=49.3
 &&d.action==='below-threshold'&&d.activation>=d.threshold
 &&hatRaw.activations.filter(f=>Math.abs(f.audioTime-d.audioTime)<.0101).every(f=>f.scores[3]<=d.activation));
assert(suppressed,'Expected controlled suppression case not found');
report.cases.push({source:'Known constructed Hat WAV',sourceTime:suppressed.audioTime,classification:'CLASSIFIER_SUPPRESSION',firstStage:'peak novelty',
 evidence:suppressed,uncertainty:'Constructed acoustic reference; not a natural-music accuracy claim.'});
const overlap=JSON.parse(await readFile(resolve('scratch/xo-percussion-recovery/baseline-offline/simultaneous-kick-snare-hat.json'),'utf8'));
report.cases.push({source:'Preserved simultaneous acoustic K/S/H fixture',sourceTime:7,classification:'MODEL_NONRESPONSE',firstStage:'learned Snare activation',
 maxSnareActivation:Math.max(...overlap.activations.filter(f=>Math.abs(f.audioTime-7)<=.03).map(f=>f.scores[1])),
 uncertainty:'Known constructed Snare; not an isolated XO stem or proof of identity for an ambiguous natural attack.'});
const late=report.runs.filter(r=>r.input==='snare-only').flatMap(r=>r.ledger.map(e=>({...e,run:r.id})))
 .filter(e=>e.band==='clap'&&e.knownOnsetMatched&&e.visibleMinusKnownOutputMs>50).sort((a,b)=>b.visibleMinusKnownOutputMs-a.visibleMinusKnownOutputMs)[0];
assert(late,'Expected controlled timing case not found');
report.cases.push({source:'Known constructed Snare WAV',run:late.run,sourceTime:late.knownOnset.time,traceId:late.traceId,
 classification:'TIMING_FAILURE',firstStage:'software output-to-viewport deadline',errorMs:late.visibleMinusKnownOutputMs,
 uncertainty:'Controlled output-clock proxy; physical speaker/display p95 remains BLOCKED.'});
report.cases.push({source:'T5 six known events at 50 ms',classification:'VISUAL_FUSION',firstStage:'renderer envelope',
 evidence:'A has six constructed events and two computed brightness attacks; R has six of each.',uncertainty:'Software compositor-style measurement; human perception remains pending.'});
await writeFile(resolve(folder,'discrepancy-ledger.json'),JSON.stringify(report,null,2)+'\n');
