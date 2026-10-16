import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const folder=resolve('scratch/hat-playback-discrepancy'),old=resolve('scratch/xo-percussion-recovery');
const manifest=JSON.parse(await readFile(resolve(old,'manifest.json'),'utf8'));
const classifiers={},result={detectorChanged:false,officialNaturalMetricsCalculated:false,results:[]};
for(const variant of ['A','R']){
 const base=resolve(folder,'candidate-'+variant,'extension');
 const config=await import(pathToFileURL(resolve(base,'beat-candidate.js')).href);
 assert.equal(config.privatePercussionClassifier,'onset-guided');assert.equal(config.candidateDetector.version,'hat-'+variant);
 const modelHash=createHash('sha256').update(await readFile(resolve(base,'generated/percussion/percussion.onnx'))).digest('hex');
 assert.equal(modelHash,manifest.modelSha256);
 classifiers[variant]=(await import(pathToFileURL(resolve(base,'percussion-classifier.js')).href)).PercussionClassifier;
}
for(const fixture of manifest.fixtures){
 const raw=JSON.parse(await readFile(resolve(old,'baseline-offline',fixture.id+'.json'),'utf8')),events={};
 for(const variant of ['A','R']){
  const classifier=new classifiers[variant](undefined,{onsetGuided:true}),all=[];
  for(const f of raw.activations)all.push(...classifier.push(f.scores,f.audioTime).events);
  events[variant]=all;
  // The preserved trace predates classIndex instrumentation. Compare every
  // detector value/timestamp while A/R equality below also includes metadata.
  assert.deepEqual(all.map(({classIndex,...e})=>e),raw.events.map(({decisionAudioTime,classIndex,...e})=>e));
 }
 assert.deepEqual(events.A,events.R);
 const selected=events.A.filter(e=>e.audioTime>=(fixture.analysisStart||0)&&e.audioTime<(fixture.analysisEnd||fixture.duration));
 result.results.push({id:fixture.id,referenceStatus:fixture.referenceStatus,exactAllEventEquality:true,
  rows:Object.fromEntries(['kick','clap','hat'].map(b=>[b,selected.filter(e=>e.band===b).length]))});
}
await writeFile(resolve(folder,'regression-results.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({fixtures:result.results.length,exactEquality:true,detectorChanged:false}));
