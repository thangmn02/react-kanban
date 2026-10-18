import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeDelivery,quantiles,assessCaptureContinuity} from './summarize-beat-delivery.mjs';

test('EOF alone cannot hide a mid-session preview revocation or failed worker',()=>{
  const health={context:'running',bufferMs:0,dropReason:'none',workerFailures:0};
  const samples=[{at:500,health,playback:{paused:false,ended:false}}, {at:2000,playback:{ended:true}}];
  const end={startedAt:0,eofAt:2000};
  assert.equal(assessCaptureContinuity(samples,[],end).status,'PASS');
  assert.equal(assessCaptureContinuity(samples,[{stage:'PREVIEW_REVOKED',previewReason:'not-playing',at:1000}],end).status,'FAIL');
  assert.equal(assessCaptureContinuity(samples,[{stage:'EVENT_DROPPED',reason:'worker-backlog',at:1000}],end).status,'FAIL');
  assert.equal(assessCaptureContinuity(samples,[{stage:'CAPTURE_STOP',reason:'track-changed',at:2000}],end).status,'PASS');
  assert.equal(assessCaptureContinuity(samples,[],{startedAt:0}).status,'PARTIAL');
});

test('joins software stages by identity and separates future Bass scheduling from drum lateness',()=>{
  const row=(id,type,component,stage,at,extra={})=>({id,type,source:'onset',component,stage,at,...extra});
  const trace={telemetry:{records:[
    row('bass-1','bass','beat-scheduler','EVENT_SCHEDULED',100),
    row('bass-1','bass','beat-controller','EVENT_ACCEPTED',150),
    row('bass-1','bass','beat-renderer','EVENT_COMMITTED',155,{targetTime:150,targetClock:'epoch-ms'}),
    row('snare-1','snare','beat-renderer','EVENT_COMMITTED',320,{targetTime:100,targetClock:'epoch-ms'}),
  ]}};
  const result=summarizeDelivery({trace});
  assert.equal(result.stageMs.schedulerToController.median,50);
  assert.equal(result.byType.bass.commitDelayMs.median,5);
  assert.equal(result.byType.snare.commitDelayMs.median,220);
  assert.equal(result.byType.hat.animationDelayMs,null);
});

test('missing timing stages remain unavailable, and detector audio/wall delays stay separate',()=>{
  const result=summarizeDelivery({offscreen:{telemetry:{records:[{stage:'DETECTOR_TIMING',audioTime:1,
    peakFeatureAvailableAudioTime:1.043,modelInputAudioTime:1.12,modelInputAvailableAudioTime:1.143,
    inferenceStartedAt:100,inferenceEndedAt:120,decisionAudioTime:1.05,decisionAt:170,receivedAt:171}]}}});
  assert.equal(result.detectorMs.inference.median,20);
  assert.equal(result.detectorMs.peakFinalizationWall.median,50);
  assert(Math.abs(result.detectorMs.modelFutureAndBatch.median-120)<1e-8);
  assert.equal(result.detectorMs.workerQueue,null);
  assert.equal(quantiles([NaN,Infinity]),null);
});
