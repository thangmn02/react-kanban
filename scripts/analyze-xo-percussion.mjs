// Evidence ledger. Natural predictions and provisional cues are never scored.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {PercussionClassifier} from '../extensions/kanban-music/percussion-classifier.js';
const folder=resolve('scratch/xo-percussion-recovery');
const read=async file=>JSON.parse(await readFile(resolve(folder,file),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const count=values=>values.reduce((result,value)=>{result[value]=(result[value]||0)+1;return result;},{});
const median=values=>values.toSorted((a,b)=>a-b)[Math.floor(values.length/2)];
const comparison=await read('comparison.json'),manifestBytes=await readFile(resolve(folder,'manifest.json'));
const manifest=JSON.parse(manifestBytes);
assert.equal(digest(manifestBytes),comparison.manifestSha256,'Manifest differs from frozen A/B comparison');
const report={sourceSha256:manifest.sourceSha256,manifestSha256:comparison.manifestSha256,
  naturalAccuracyGate:'BLOCKED',officialNaturalMetricsCalculated:false,physicalVerified:false,
  adoption:'NO-GO: controlled Snare-only false Hats increase',runtime:comparison.runtime,
  fixtures:comparison.fixtures.map(f=>({id:f.id,referenceStatus:f.referenceStatus,A:f.A.rows,B:f.B.rows,
    controlledA:f.A.controlled,controlledB:f.B.controlled,added:f.added.length,removed:f.removed.length})),actual:[]};
for(const file of ['actual-msedge-xo.json','actual-msedge-hat-only-snare-only.json']){
  const raw=await read(file);
  assert.deepEqual(raw.errors,[],`${file} contains failed runs`);
  const required=file==='actual-msedge-xo.json'?['A/xo','B/xo']:['A/hat-only','A/snare-only','B/hat-only','B/snare-only'];
  assert.deepEqual(raw.results.map(r=>r.variant+'/'+r.input).sort(),required.sort(),`${file} has incomplete or duplicate run coverage`);
  for(const run of raw.results){
    assert(run.finishedAt,`${run.variant}/${run.input} is incomplete`);
    assert.equal(run.classifier,run.variant==='B'?'local-prominence':'onset-guided');
    assert.equal(run.finalMode.detectorVersion,'xo-'+run.variant);
    assert.equal(run.finalMode.bufferMs,500);assert.equal(run.finalMode.allowTypedPreview,true);
    const groups=new Map();for(const entry of run.records){if(!entry.id)continue;
      if(!groups.has(entry.id))groups.set(entry.id,[]);groups.get(entry.id).push(entry);}
    const offsets=run.predictions.flatMap(p=>{
      const target=groups.get(p.traceId)?.find(r=>Number.isFinite(r.targetPlaybackTime));
      return target?[target.targetPlaybackTime-p.audioTime]:[];
    });
    assert(offsets.length&&offsets.every(Number.isFinite),'No finite trace-linked audio-to-song anchors');
    assert(Math.max(...offsets)-Math.min(...offsets)<=.05,'Audio-to-song clock mapping spread exceeds 50 ms');
    const audioToSongOffset=median(offsets),ledger=[];
    for(const prediction of run.predictions){
      const records=groups.get(prediction.traceId)||[],target=records.find(r=>Number.isFinite(r.targetPlaybackTime));
      const songTime=target?.targetPlaybackTime??prediction.audioTime+audioToSongOffset;
      if(songTime<run.analysisStart||songTime>=run.analysisEnd)continue;
      const visible=run.flashes.find(f=>f.id===prediction.traceId);
      ledger.push({...prediction,songTime,songTimeEstimated:!target,records,
        sent:records.some(r=>r.stage==='EVENT_SENT'&&r.component==='capture-engine'),
        received:records.some(r=>r.stage==='EVENT_RECEIVED'),scheduled:records.some(r=>r.stage==='EVENT_SCHEDULED'),
        accepted:records.some(r=>r.stage==='EVENT_ACCEPTED'),rendered:records.some(r=>r.stage==='EVENT_RENDERED'),
        drops:records.filter(r=>r.stage==='EVENT_DROPPED').map(r=>({reason:r.reason,component:r.component})),
        visible:visible||null,visibleOffsetMs:visible?visible.at-(records.findLast(r=>['EVENT_ACCEPTED','EVENT_COMMITTED','EVENT_RENDERED'].includes(r.stage)&&r.targetClock==='epoch-ms')?.targetTime??NaN):null});
    }
    const paired={};for(const variant of ['A','B']){
      const classifier=new PercussionClassifier(undefined,{onsetGuided:true,localProminence:variant==='B'}),events=[];
      for(const frame of run.frames)events.push(...classifier.push(frame.scores,frame.audioTime).events);
      paired[variant]=events.filter(e=>e.audioTime+audioToSongOffset>=run.analysisStart&&e.audioTime+audioToSongOffset<run.analysisEnd);
    }
    assert.deepEqual(paired.A.filter(e=>e.band==='kick'),paired.B.filter(e=>e.band==='kick'),'Paired live activation replay changed Kick');
    const pairedReplay=Object.fromEntries(Object.entries(paired).map(([v,events])=>[v,count(events.map(e=>e.band))]));
    const stageCounts=Object.fromEntries(['kick','clap','hat'].map(band=>{
      const rows=ledger.filter(e=>e.band===band);
      return [band,{classifier:rows.length,...Object.fromEntries(['sent','received','scheduled','accepted','rendered','visible'].map(stage=>[stage,rows.filter(e=>!!e[stage]).length])),
        drops:count(rows.flatMap(e=>e.drops.map(d=>d.component+':'+d.reason)))}];
    }));
    const visiblePassage=run.flashes.filter(f=>{
      const time=groups.get(f.id)?.find(r=>Number.isFinite(r.targetPlaybackTime))?.targetPlaybackTime;
      return time>=run.analysisStart&&time<run.analysisEnd;
    });
    const visibility=run.hatVisibilitySamples||[],brightRuns=[];
    let current;for(const sample of visibility.filter(s=>s.songTime>=run.analysisStart&&s.songTime<run.analysisEnd)){
      if(sample.opacity>=.5){if(!current){current={start:sample.songTime,end:sample.songTime,startAt:sample.at,endAt:sample.at,ids:new Set()};brightRuns.push(current);}
        current.end=sample.songTime;current.endAt=sample.at;for(const id of sample.ids)current.ids.add(id);
      }else current=undefined;
    }
    const item={variant:run.variant,input:run.input,browser:run.browser,referenceStatus:run.referenceStatus,sourceFileSha256:run.sourceFileSha256,
      classifier:run.classifier,detectorVersion:run.finalMode.detectorVersion,bufferMs:run.finalMode.bufferMs,
      analysisStart:run.analysisStart,analysisEnd:run.analysisEnd,stageCounts,visiblePassageCounts:count(visiblePassage.map(f=>f.row)),
      pairedReplay,audioToSongOffset,offsetRange:[Math.min(...offsets),Math.max(...offsets)],
      visibleOffsetsMs:ledger.filter(e=>e.visible).map(e=>e.visibleOffsetMs),
      brightRuns:brightRuns.map(r=>({...r,ids:[...r.ids],durationMs:r.endAt-r.startAt})),cpu:run.cpu,
      processingLatency:run.finalMode.measuredP95Ms,processingLatencyP99:run.finalMode.measuredP99Ms,
      artifact:file,artifactSha256:digest(await readFile(resolve(folder,file))),ledger};
    report.actual.push(item);
    console.log(JSON.stringify({variant:item.variant,input:item.input,stages:stageCounts,visible:item.visiblePassageCounts,pairedReplay,
      continuousHatRunsWithMultipleEvents:item.brightRuns.filter(r=>r.ids.length>1).map(r=>({start:r.start,end:r.end,events:r.ids.length}))}));
  }
}
const natural=await read('baseline-offline/trap.json');
report.xoPeakDecisions={};
for(const variant of ['A','B']){
  const replay=await read('candidate-replay/trap-'+variant+'.json');
  report.xoPeakDecisions[variant]=Object.fromEntries([0,1,3,4].map(c=>[c,count(replay.decisions.filter(d=>d.classIndex===c&&d.audioTime>=1&&d.audioTime<13).map(d=>d.action))]));
}
const references=JSON.parse(await readFile(resolve('scratch/whiplash-provisional-investigation/provisional-references.json'),'utf8')).find(r=>r.input==='trap');
report.provisionalSnareReview=references.rows.snare.map(cue=>{
  const frames=natural.activations.filter(f=>Math.abs(f.audioTime-1-cue)<=.15),decisions=natural.decisions.filter(d=>d.classIndex===1&&Math.abs(d.audioTime-1-cue)<=.15);
  return {cueSourceTime:45+cue,reviewInterval:[45+cue-.15,45+cue+.15],referenceStatus:'provisional-human-reference',
    uncertainty:'Timestamp and instrument identity unverified; 150 ms is a search window, not measured uncertainty.',
    maxSnareActivation:Math.max(...frames.map(f=>f.scores[1])),maxSnareNovelty:Math.max(...decisions.map(d=>d.novelty)),
    emittedSnareTimes:natural.events.filter(e=>e.band==='clap'&&Math.abs(e.audioTime-1-cue)<=.15).map(e=>44+e.audioTime)};
});
const prior=JSON.parse(await readFile(resolve('scratch/whiplash-pipeline-proof/result.json'),'utf8')).results.find(r=>r.input==='trap');
report.legacyPair=prior.events.filter(e=>e.band==='hat'&&e.excerptTime>=9.87&&e.excerptTime<=9.90).map(e=>({
  excerptTime:e.excerptTime,scores:e.scores,novelty:e.value,confidence:e.confidence,firstDrop:e.firstDrop,stages:e.stages,
  interpretation:'Two different learned Hat/Cymbal subtype proposals; independent acoustic identity unresolved. Existing debounce retained.'}));
await writeFile(resolve(folder,'evidence-ledger.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({provisionalSnareReview:report.provisionalSnareReview,xoPeakDecisions:report.xoPeakDecisions,legacyPair:report.legacyPair.map(e=>({time:e.excerptTime,scores:e.scores,novelty:e.novelty,drop:e.firstDrop}))}));
