import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inputReleaseFrame,replayRelease,structuralFloor,captureClockAges} from './analyze-percussion-latency-floor.mjs';

test('frozen batch release includes right context and every output phase',()=>{
  const config={rightContext:10,stepFrames:5};
  assert.deepEqual([0,1,2,3,4,5].map(p=>inputReleaseFrame(p,config)),[14,14,14,14,14,19]);
  assert.equal(inputReleaseFrame(0,{rightContext:0,stepFrames:1}),0);
  assert.throws(()=>inputReleaseFrame(-1,config));
});

test('joins raw input age separately from the estimated output addition and epoch target',()=>{
  const records=[{id:'hit',stage:'DETECTOR_TIMING',audioTime:1,modelInputAudioTime:1.12,decisionAudioTime:1.05},
    {id:'hit',component:'capture-engine',stage:'EVENT_QUEUED',audioTime:1.23,targetTime:1.05,at:2000},
    {id:'hit',component:'beat-sync',stage:'EVENT_SENT',targetClock:'epoch-ms',targetTime:1820}];
  const result=captureClockAges({offscreen:{telemetry:{records}}},{rightContext:10,stepFrames:5,fps:100,fftSize:2048,sampleRate:44100});
  assert(Math.abs(result.summary.requiredInputAfterPeakMs.median-193.21995464852608)<1e-8);
  assert(Math.abs(result.summary.inputAgeAtQueueMs.median-230)<1e-8);
  assert(Math.abs(result.summary.estimatedOutputAdditionMs.median-50)<1e-8);
  assert.equal(result.summary.mappedTargetAgeAtQueueMs.median,180);
});

test('a saved score stream without batch phase cannot manufacture an exact input release time',async()=>{
  const config=JSON.parse(await readFile('extensions/kanban-music/generated/percussion/percussion.json','utf8'));
  const frames=Array.from({length:40},(_,i)=>({audioTime:i/100,scores:[i===20?1:0,0,0,0,0]}));
  const [event]=replayRelease(frames,config);
  assert.equal(event.requiredInputAfterPeakMs,null);assert.equal(event.inputFrame,null);
  assert(event.minimumRequiredInputAfterPeakMs<event.maximumRequiredInputAfterPeakMs);
  assert.equal(event.observedAvailableAfterPeakMs,null);
});

test('actual frozen classifier requires five subsequent scores for singleton peaks and can extend groups',async()=>{
  const config=JSON.parse(await readFile('extensions/kanban-music/generated/percussion/percussion.json','utf8'));
  const result=structuralFloor(config);
  assert.equal(result.singletonChecks.length,15);
  for(const check of result.singletonChecks)assert.equal(check.decisionFrame-check.peakFrame,5);
  assert(Math.abs(result.singletonInputAgeMs.median-193.21995464852608)<1e-8);
  assert(Math.abs(result.singletonInputAgeMs.worst-213.21995464852608)<1e-8);
  assert(result.extendedGroupChecks.some(e=>e.finalizationMs>50));
});
