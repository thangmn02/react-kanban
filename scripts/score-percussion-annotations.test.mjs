import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scoreAnnotations } from './score-percussion-annotations.mjs';

const prediction = {
  input: 'excerpt', duration: 10,
  events: [{ type: 'kick', time: 1 }, { type: 'hat', time: 2 }],
};

describe('independent percussion reference scoring', () => {
  it('does not treat old wrong-flash markers as complete onset references', () => {
    const markers = [{ input: 'excerpt', start: 0, end: 10, origin: 'human', verified: true,
      rows: { kick: [1], snare: [], hat: [2] } }];
    assert.equal(scoreAnnotations(markers, [prediction])[0].status, 'not-complete-onset-reference');
  });

  it('scores only a verified complete audible-onset reference', () => {
    const reference = [{ input: 'excerpt', start: 0, end: 10, origin: 'human',
      purpose: 'audible-onset-reference', verified: true,
      rows: { kick: [1.02], snare: [], hat: [] } }];
    const result = scoreAnnotations(reference, [prediction])[0];
    assert.equal(result.status, 'human-verified');
    assert.equal(result.rows.kick.tp, 1);
    assert.equal(result.rows.hat.fp, 1);
    assert.equal(result.rows.hat.falseEventsPerAbsentMinute, 6);
  });
});
