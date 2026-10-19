import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PercussionClassifier} from '../extensions/kanban-music/percussion-classifier.js';
import {loadVariant,replay,compareRetained} from './replay-early-percussion-decisions.mjs';
const config=JSON.parse(await readFile('extensions/kanban-music/generated/percussion/percussion.json'));
const frames=peaks=>Array.from({length:70},(_,i)=>({audioTime:i/100,scores:[peaks.includes(i)?1:0,0,0,0,0]}));

test('only bounded offline variants load and singleton emission moves without moving onset',async()=>{
  await assert.rejects(()=>loadVariant('threshold-sweep'));
  const stream=frames([20]);
  for(const [name,decision] of [['L0',25],['L1-gap0',23],['L1-immediate',22]]) {
    const result=replay(stream,await loadVariant(name),config);
    assert.equal(result.events.length,1);assert.equal(result.events[0].time,.2);
    assert.equal(result.events[0].decisionFrame,decision);assert.equal(result.duplicateIds,0);
  }
});

test('L0 replay exactly preserves production class, confidence and time',async()=>{
  const stream=frames([20,23,40]),classifier=new PercussionClassifier(config.thresholds,{onsetGuided:true});
  const original=stream.flatMap(f=>classifier.push(f.scores,f.audioTime).events);
  const actual=replay(stream,await loadVariant('L0'),config).events;
  assert.deepEqual(actual.map(e=>[e.classIndex,e.time,e.confidence]),original.map(e=>[e.classIndex,e.audioTime,e.confidence]));
});

test('release savings retain unknown phase, and gaps cannot masquerade as continuous input',async()=>{
  const stream=frames([20]),l0=replay(stream,await loadVariant('L0'),config);
  const l1=replay(stream,await loadVariant('L1-immediate'),config);
  const comparison=compareRetained(l0,l1,config);
  assert(Math.abs(comparison.scoreHorizonSavingsMs.median-30)<1e-8);
  assert.deepEqual(comparison.inputReleaseSavingsByUnknownPhase.map(p=>p.savingsMs.median).sort((a,b)=>a-b),[0,0,50,50,50]);
  assert.throws(()=>replay(stream.filter((_,i)=>i!==30),{Classifier:PercussionClassifier},config));
});
