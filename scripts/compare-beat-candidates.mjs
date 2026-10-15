import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {PercussionClassifier} from '../extensions/kanban-music/percussion-classifier.js';
import {temporalMatch} from './score-percussion-annotations.mjs';
const root=process.cwd(),folder=resolve(root,'scratch/browser-first-corpus');
const manifestBytes=await readFile(resolve(folder,'manifest.json')),manifest=JSON.parse(manifestBytes);
const runs=[];
for(const candidate of ['baseline','onset-guided']) {
  const run=JSON.parse(await readFile(resolve(root,`scratch/beat-runtime-proof/synthetic-${candidate}.json`)));
  const fixtures=[];
  for(const fixture of manifest.fixtures) {
    const bytes=await readFile(resolve(folder,fixture.id+'.f32'));
    if(createHash('sha256').update(bytes).digest('hex')!==fixture.pcmSha256)throw Error('Frozen PCM changed');
    const result=run.results.find(result=>result.input===`/pcm/${fixture.id}.f32`);
    if(!result||result.eventsTruncated||result.activationsTruncated)throw Error('Incomplete run');
    const rows={};
    for(const row of ['kick','snare','hat']) {
      const band=row==='snare'?'clap':row,reference=fixture.events.filter(event=>event.row===row).map(event=>event.time);
      const predicted=result.events.filter(event=>event.band===band&&event.excerptTime>=0&&event.excerptTime<fixture.duration).map(event=>event.excerptTime);
      rows[row]={reference:reference.length,predicted:predicted.length,...temporalMatch(reference,predicted),
        falseEventsPerAbsentMinute:reference.length?null:predicted.length/fixture.duration*60};
    }
    const replay={};
    for(const onsetGuided of [false,true]) {
      const classifier=new PercussionClassifier(undefined,{onsetGuided}),events=[];
      for(const frame of result.activations)events.push(...classifier.push(frame.scores,frame.audioTime).events);
      replay[onsetGuided?'B':'A']=events.map(({band,audioTime})=>({band,time:audioTime-result.audioOrigin}));
    }
    fixtures.push({id:fixture.id,split:fixture.split,referenceStatus:fixture.referenceStatus,rows,
      latency:result.latency,visibleFlash:result.visibleFlash,inference:result.stages.inference,maxQueue:result.maxQueue,
      identicalActivationReplay:{A:replay.A.length,B:replay.B.length,identical:JSON.stringify(replay.A)===JSON.stringify(replay.B)}});
  }
  runs.push({candidate,fixtures});
}
const report={scope:'synthetic-controlled-only',naturalAccuracyQualified:false,
  manifestSha256:createHash('sha256').update(manifestBytes).digest('hex'),matchingToleranceMs:50,
  decision:'NO-GO: no verified natural reference, noncausal model, synthetic false positives and misses remain',runs};
const naturalBytes=await readFile(resolve(root,'scratch/whiplash-benchmark/candidate-a-aligned-runtime.json'));
const natural=JSON.parse(naturalBytes);
report.natural={referenceStatus:'provisional-human-reference',officialMetricsCalculated:false,
  activationsSha256:createHash('sha256').update(naturalBytes).digest('hex'),
  fixtures:natural.results.map(result=>{
    if(!result.activations?.length||result.activationsTruncated)throw Error('Incomplete natural activations');
    const replay=onsetGuided=>{
      const classifier=new PercussionClassifier(undefined,{onsetGuided}),events=[];
      for(const frame of result.activations)events.push(...classifier.push(frame.scores,frame.audioTime).events);
      return events.map(({band,audioTime})=>({band,time:audioTime-result.audioOrigin})).filter(event=>event.time>=0&&event.time<result.inputDuration);
    };
    const A=replay(false),B=replay(true),key=event=>`${event.band}:${event.time}`;
    const a=new Set(A.map(key)),b=new Set(B.map(key));
    return {input:result.input,A:A.length,B:B.length,added:B.filter(event=>!a.has(key(event))),removed:A.filter(event=>!b.has(key(event))),
      baselineModelReceipt:result.latency,baselineVisible:result.visibleFlash};
  })};
await writeFile(resolve(folder,'comparison.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(runs.map(run=>({candidate:run.candidate,fixtures:run.fixtures.map(f=>({id:f.id,rows:Object.fromEntries(Object.entries(f.rows).map(([row,r])=>[row,{tp:r.tp,fp:r.fp,fn:r.fn}])),sameReplay:f.identicalActivationReplay.identical}))}))));
console.log(JSON.stringify(report.natural.fixtures.map(({input,A,B,added,removed})=>({input,A,B,added:added.length,removed:removed.length}))));
