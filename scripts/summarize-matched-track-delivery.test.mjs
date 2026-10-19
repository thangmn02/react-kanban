import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deadlineSummary,accountIds} from './summarize-matched-track-delivery.mjs';
test('zero JS queue cannot conceal pre-receipt age or inference deadline failure',()=>{
 const result=deadlineSummary([{stage:'WORKER_BATCH',featurePostedAt:10,workerReceivedAt:5010,inferenceStartedAt:5010,inferenceEndedAt:5085,queueDepth:0}]);
 assert.equal(result.observedQueueMaximum,0);assert.equal(result.workletPostedToWorkerReceiptMs.worst,5000);
 assert.equal(result.inferenceOver50ms,1);assert.equal(deadlineSummary([]).inferenceMs,null);
});
test('event accounting uses identity and earliest valid epoch animation, preserving missing stages',()=>{
 const records=[{id:'a',stage:'EVENT_ACCEPTED'},
  {id:'a',component:'beat-renderer',stage:'EVENT_RENDERED',at:120,targetTime:100,targetClock:'epoch-ms'},
  {id:'a',component:'beat-renderer',stage:'EVENT_RENDERED',at:300,targetTime:100,targetClock:'epoch-ms'},
  {id:'b',component:'beat-scheduler',stage:'EVENT_DROPPED',reason:'schedule-late'}];
 const result=accountIds(records,['a','b']);assert.equal(result.stages.EVENT_ACCEPTED,1);
 assert.equal(result.entries[0].firstAnimationDelayMs,20);assert.equal(result.entries[1].firstAnimationDelayMs,null);
 assert.equal(result.entries[1].drops[0].reason,'schedule-late');
});
