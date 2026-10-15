import assert from 'node:assert/strict';
import { test } from 'node:test';
import { provisionalReference } from './inspect-provisional-percussion.mjs';
import { scoreAnnotations } from './score-percussion-annotations.mjs';

const fixture={input:'W1',duration:12,sourceStart:8,sourceEnd:20,
  sourceSha256:'a'.repeat(64),pcmSha256:'b'.repeat(64)};
const annotation={input:'W1',start:0,end:12,sourceStart:8,sourceEnd:20,
  sourceSha256:fixture.sourceSha256,pcmSha256:fixture.pcmSha256,
  verified:true,rows:{kick:null,snare:null,hat:null},
  draft:{kick:'1.234 1.234 12.000',snare:'',hat:'2.345'}};

test('recovers incomplete draft marks with unknown coverage and explicit uncertainty',()=>{
  const a=provisionalReference(annotation,fixture);
  assert.equal(a.referenceStatus,'provisional-human-reference');
  assert.equal(a.verified,false);
  assert.deepEqual(a.rows.kick,[1.234,1.234,12]);
  assert.equal(a.rows.snare,null);
  assert.equal(a.observations[0].onsetUncertaintyMs,null);
  assert.equal(a.ambiguousIntervals[0].end,12);
  assert.equal(scoreAnnotations([a],[])[0].rows,undefined);
});

test('preserves duplicate and boundary observations as review issues without silently correcting them',()=>{
  const a=provisionalReference(annotation,fixture);
  assert.deepEqual(a.observations[1].flags,['repeated-human-mark']);
  assert.deepEqual(a.observations[2].flags,['outside-half-open-excerpt']);
  assert.equal(a.observations[2].time,12);
});

test('does not attach draft notes to a different recording or excerpt',()=>{
  assert.throws(()=>provisionalReference({...annotation,sourceStart:9},fixture),/mismatch/);
  assert.throws(()=>provisionalReference({...annotation,pcmSha256:'c'.repeat(64)},fixture),/mismatch/);
});
