import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scoreAnnotations } from './score-percussion-annotations.mjs';

const prediction = {
  input: 'excerpt', duration: 10,
  sourceSha256:'a'.repeat(64),pcmSha256:'b'.repeat(64),
  events: [{ type: 'kick', time: 1 }, { type: 'hat', time: 2 }],
};
const verifiedReference = () => ({input:'excerpt',start:0,end:10,origin:'human',
  purpose:'audible-onset-reference',referenceStatus:'verified-ground-truth',verified:true,
  sourceSha256:prediction.sourceSha256,pcmSha256:prediction.pcmSha256,
  verification:{coverage:'complete-all-rows',independentOfPredictions:true,
    onsetUncertaintyMs:10,reviewer:'Independent reviewer',method:'Sample-level waveform and listening review'},
  rows:{kick:[1.02],snare:[],hat:[]}});

describe('independent percussion reference scoring', () => {
  it('does not treat old wrong-flash markers as complete onset references', () => {
    const markers = [{ input: 'excerpt', start: 0, end: 10, origin: 'human', verified: true,
      rows: { kick: [1], snare: [], hat: [2] } }];
    assert.equal(scoreAnnotations(markers, [prediction])[0].status, 'not-complete-onset-reference');
  });

  it('scores only a verified complete audible-onset reference', () => {
    const reference = [verifiedReference()];
    const result = scoreAnnotations(reference, [prediction])[0];
    assert.equal(result.status, 'human-verified');
    assert.equal(result.rows.kick.tp, 1);
    assert.equal(result.rows.hat.fp, 1);
    assert.equal(result.rows.hat.falseEventsPerAbsentMinute, 6);
  });

  it('refuses provisional references even when another field claims verification',()=>{
    const a={...verifiedReference(),referenceStatus:'provisional-human-reference'};
    const result=scoreAnnotations([a],[prediction])[0];
    assert.equal(result.status,'provisional-human-reference');
    assert.equal(result.scoringEligible,false);
    assert.equal(result.rows,undefined);
  });

  it('does not promote a legacy completeness checkbox to separate verification',()=>{
    const a=verifiedReference();delete a.referenceStatus;
    assert.equal(scoreAnnotations([a],[prediction])[0].status,'awaiting-separate-verification');
  });

  it('requires timing, coverage and independence evidence for official evaluation',()=>{
    for(const change of [{onsetUncertaintyMs:null},{onsetUncertaintyMs:51},
      {independentOfPredictions:false},{coverage:'partial'},{reviewer:''}]) {
      const a=verifiedReference();Object.assign(a.verification,change);
      assert.equal(scoreAnnotations([a],[prediction])[0].status,'incomplete-verification-evidence');
    }
    const a=verifiedReference();a.ambiguousIntervals=[{start:1,end:2}];
    assert.equal(scoreAnnotations([a],[prediction])[0].status,'incomplete-verification-evidence');
  });

  it('rejects mismatched recordings and duplicate official reference notes',()=>{
    assert.throws(()=>scoreAnnotations([verifiedReference()],[{...prediction,pcmSha256:'c'.repeat(64)}]),/identities/);
    const a=verifiedReference();a.rows.kick=[1.02,1.02];
    assert.throws(()=>scoreAnnotations([a],[prediction]),/unique/);
  });
});
