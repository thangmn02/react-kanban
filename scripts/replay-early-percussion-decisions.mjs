// Offline-only, bounded decision experiments. Never imported by the app/extension.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {inputReleaseFrame} from './analyze-percussion-latency-floor.mjs';
import {quantiles} from './summarize-beat-delivery.mjs';

export const variants={L0:2,'L1-gap0':0,'L1-immediate':-1};
const expectedSource='c84142ba2a4c202211a6182d00cc3eadf192ff5ecbf10f5675b0a64c0ac733b0';
const needle='if (group && frame - group.lastFrame > 2)';
const instrument=['kick','snare','tom','hat','cymbal'];
const sha=value=>createHash('sha256').update(value).digest('hex');

export async function loadVariant(name) {
  assert(Object.hasOwn(variants,name),'Only the two approved L1 variants and L0 are allowed');
  const bytes=await readFile('extensions/kanban-music/percussion-classifier.js');
  assert.equal(sha(bytes),expectedSource,'Frozen classifier source changed');
  const source=bytes.toString();
  assert.equal(source.split(needle).length,2,'Expected exactly one final closure condition');
  const patched=name==='L0'?source:source.replace(needle,`if (group && frame - group.lastFrame > ${variants[name]})`);
  const {PercussionClassifier}=await import('data:text/javascript;base64,'+Buffer.from(patched).toString('base64'));
  return {name,Classifier:PercussionClassifier,sourceSha256:expectedSource,variantSourceSha256:sha(patched),closureGap:variants[name]};
}

export function replay(frames,variant,config) {
  const classifier=new variant.Classifier(config.thresholds,{onsetGuided:true}),events=[];
  let previous=null;
  for(const [index,frame] of frames.entries()) {
    assert(Number.isFinite(frame.audioTime)&&Array.isArray(frame.scores)&&frame.scores.length===5
      &&frame.scores.every(n=>Number.isFinite(n)&&n>=0&&n<=1),'Invalid activation frame');
    if(previous!==null)assert(Math.abs(frame.audioTime-previous-.01)<1e-5,'Incomplete or disordered activation stream');
    previous=frame.audioTime;
    for(const event of classifier.push(frame.scores,frame.audioTime).events) {
      events.push({id:`${event.band}:${event.audioTime.toFixed(8)}`,band:event.band,
        instrument:instrument[event.classIndex],displayRow:event.band==='clap'?'snare':event.band,
        classIndex:event.classIndex,time:event.audioTime,confidence:event.confidence,
        decisionFrame:index,decisionTime:frame.audioTime,finalizationMs:(frame.audioTime-event.audioTime)*1000});
    }
  }
  const identities=events.map(e=>e.id);
  return {events,duplicateIds:identities.length-new Set(identities).size,
    finalizationMs:quantiles(events.map(e=>e.finalizationMs))};
}

export function compareRetained(baseline,candidate,config) {
  const key=e=>`${e.classIndex}:${e.time.toFixed(8)}`,before=new Map(baseline.events.map(e=>[key(e),e]));
  const after=new Map(candidate.events.map(e=>[key(e),e]));
  const common=candidate.events.filter(e=>before.has(key(e)));
  return {baseline:baseline.events.length,candidate:candidate.events.length,retained:common.length,
    added:candidate.events.filter(e=>!before.has(key(e))),removed:baseline.events.filter(e=>!after.has(key(e))),
    scoreHorizonSavingsMs:quantiles(common.map(e=>(before.get(key(e)).decisionTime-e.decisionTime)*1000)),
    inputReleaseSavingsByUnknownPhase:Array.from({length:config.stepFrames},(_,phase)=>({phase,
      savingsMs:quantiles(common.map(e=>(inputReleaseFrame(before.get(key(e)).decisionFrame+phase,config)
        -inputReleaseFrame(e.decisionFrame+phase,config))/config.fps*1000))})),
    scope:'Same class and exact predicted time only; unchanged input batch dependency under each possible phase. Not inference execution, end-to-end delivery or physical timing.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const input=JSON.parse(readFileSync(0,'utf8'));
  const config=JSON.parse(await readFile('extensions/kanban-music/generated/percussion/percussion.json','utf8'));
  const selected=await Promise.all(input.variants.map(loadVariant));
  const runs=[];
  for(const item of input.items) {
    const output=Object.fromEntries(selected.map(v=>[v.name,{identity:{...v,Classifier:undefined},...replay(item.frames,v,config)}]));
    assert(output.L0,'L0 is mandatory');
    runs.push({id:item.id,variants:output,comparison:Object.fromEntries(selected.filter(v=>v.name!=='L0')
      .map(v=>[v.name,compareRetained(output.L0,output[v.name],config)]))});
  }
  process.stdout.write(JSON.stringify({runs,neuralInferenceRun:false}));
}
