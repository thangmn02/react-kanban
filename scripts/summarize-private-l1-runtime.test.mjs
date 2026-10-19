import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeBrowserResources} from './summarize-private-l1-runtime.mjs';

test('browser CPU uses observed deltas and working sets retain missing measurements',()=>{
  const samples=[{at:1000,processes:[{pid:1,cpuSeconds:30,residentBytes:100}]},
    {at:2000,processes:[{pid:1,cpuSeconds:30.4,residentBytes:120},{pid:2,cpuSeconds:5,residentBytes:null}]},
    {at:3000,processes:[{pid:1,cpuSeconds:30.8,residentBytes:130},{pid:2,cpuSeconds:5.2,residentBytes:50}]}];
  const result=summarizeBrowserResources(samples);
  assert(Math.abs(result.cpuSecondsLowerBound-1)<1e-8);
  assert(Math.abs(result.averageLogicalCoreEquivalentLowerBound-.5)<1e-8);
  assert.equal(result.incompleteMemorySamples,1);
  assert.equal(result.sampledWorkingSetSumBytes.n,2);
  assert.equal(result.sampledWorkingSetSumBytes.worst,180);
});

test('empty samples do not claim zero CPU and a reset counter is excluded',()=>{
  assert.equal(summarizeBrowserResources([]).cpuSecondsLowerBound,null);
  const result=summarizeBrowserResources([{at:0,processes:[{pid:1,cpuSeconds:9,residentBytes:1}]},
    {at:1000,processes:[{pid:1,cpuSeconds:1,residentBytes:1}]}]);
  assert.equal(result.counterResets,1);assert.equal(result.cpuSecondsLowerBound,0);
});
