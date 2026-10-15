import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {PercussionClassifier} from '../extensions/kanban-music/percussion-classifier.js';
import {temporalMatch} from './score-percussion-annotations.mjs';

const folder=resolve('scratch/xo-percussion-recovery'),manifestBytes=await readFile(resolve(folder,'manifest.json'));
const manifest=JSON.parse(manifestBytes),fixtures=[];
await mkdir(resolve(folder,'candidate-replay'),{recursive:true});
const key=event=>`${event.band}:${event.audioTime.toFixed(9)}`;
for(const fixture of manifest.fixtures){
  const bytes=await readFile(resolve(folder,'baseline-offline',fixture.id+'.json')),raw=JSON.parse(bytes);
  assert.equal(raw.pcmSha256,fixture.pcmSha256);assert.equal(raw.modelSha256,manifest.modelSha256);
  const variants={};
  for(const variant of ['A','B']){
    const classifier=new PercussionClassifier(undefined,{onsetGuided:true,localProminence:variant==='B',diagnostics:true});
    const events=[],decisions=[];
    for(const frame of raw.activations){const result=classifier.push(frame.scores,frame.audioTime);events.push(...result.events);decisions.push(...(result.decisions||[]));}
    if(variant==='A')assert.deepEqual(events.map(key),raw.events.map(key),'Instrumentation changed baseline events');
    const start=fixture.analysisStart||0,end=fixture.analysisEnd||fixture.duration;
    const selected=events.filter(e=>e.audioTime>=start&&e.audioTime<end);
    const rows=Object.fromEntries(['kick','snare','hat'].map(row=>[row,selected.filter(e=>e.band===(row==='snare'?'clap':row)).length]));
    const controlled=fixture.kind==='controlled-acoustic'?(fixture.segments||[{start:0,end:fixture.duration,matchingToleranceMs:10}]).map(segment=>({
      ...segment,rows:Object.fromEntries(['kick','snare','hat'].map(row=>[row,temporalMatch((fixture.events||[]).filter(e=>e.row===row&&e.time>=segment.start&&e.time<segment.end).map(e=>e.time),
        events.filter(e=>e.band===(row==='snare'?'clap':row)&&e.audioTime>=segment.start&&e.audioTime<segment.end).map(e=>e.audioTime),segment.matchingToleranceMs/1000)]))})):null;
    const highButRejected=Object.fromEntries([1,3,4].map(c=>[c,decisions.filter(d=>d.classIndex===c&&d.action==='below-threshold'&&d.activation>=d.threshold).length]));
    variants[variant]={events:selected,rows,controlled,highButRejected};
    await writeFile(resolve(folder,'candidate-replay',fixture.id+'-'+variant+'.json'),JSON.stringify({variant,events,decisions,pcmSha256:fixture.pcmSha256}));
  }
  assert.deepEqual(variants.A.events.filter(e=>e.band==='kick').map(key),variants.B.events.filter(e=>e.band==='kick').map(key),'Kick changed');
  const a=new Set(variants.A.events.map(key)),b=new Set(variants.B.events.map(key));
  fixtures.push({id:fixture.id,referenceStatus:fixture.referenceStatus,scoringEligible:fixture.kind==='controlled-acoustic',
    originalActivationSha256:createHash('sha256').update(bytes).digest('hex'),
    A:variants.A,B:variants.B,added:variants.B.events.filter(e=>!a.has(key(e))),removed:variants.A.events.filter(e=>!b.has(key(e)))});
  console.log(JSON.stringify({id:fixture.id,A:variants.A.rows,B:variants.B.rows,added:fixtures.at(-1).added.length,removed:fixtures.at(-1).removed.length}));
}
const runtime={};
const frames=JSON.parse(await readFile(resolve(folder,'baseline-offline/trap.json'),'utf8')).activations;
for(const [variant,localProminence] of [['A',false],['B',true]]){
  const elapsed=[];
  for(let repeat=0;repeat<40;repeat++){
    const classifier=new PercussionClassifier(undefined,{onsetGuided:true,localProminence});
    const start=performance.now();for(const frame of frames)classifier.push(frame.scores,frame.audioTime);
    if(repeat>=10)elapsed.push(performance.now()-start);
  }
  elapsed.sort((a,b)=>a-b);runtime[variant]={replays:elapsed.length,frames:frames.length,medianMs:elapsed[Math.floor(elapsed.length/2)],p95Ms:elapsed[Math.ceil(elapsed.length*.95)-1]};
}
const result={baselineRevision:'d5b28b1',manifestSha256:createHash('sha256').update(manifestBytes).digest('hex'),
  correction:'Only Snare/Hat three-frame local-valley prominence, alongside existing novelty; numeric thresholds unchanged',
  officialNaturalMetricsCalculated:false,naturalAccuracyGate:'BLOCKED',fixtures,runtime};
await writeFile(resolve(folder,'comparison.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({runtime}));
