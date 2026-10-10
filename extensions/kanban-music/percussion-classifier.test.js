import { expect, it } from 'vitest';
import { PercussionClassifier } from './percussion-classifier.js';
function sequence(attacks, length = 100) {
  const classifier = new PercussionClassifier(), events = [];
  for (let frame = 0; frame < length; frame++) {
    const scores = Array(5).fill(.001);
    for (const [at, instrument] of attacks) if (frame === at) scores[instrument] = .9;
    events.push(...classifier.push(scores, frame / 100).events);
  }
  return events;
}
it('abstains on silence, low scores and sustained activations instead of inventing percussion', () => {
  const classifier = new PercussionClassifier();
  for (let i = 0; i < 1000; i++) expect(classifier.push(Array(5).fill(i < 500 ? 0 : .1), i / 100).events).toEqual([]);
  const sustained = new PercussionClassifier();
  for (let i = 0; i < 50; i++) expect(sustained.push(Array(5).fill(.95), i / 100).events).toEqual([]);
  expect(classifier.frames.length).toBeLessThanOrEqual(16);
});
it('keeps learned classes independent and never maps tom to a semantic row', () => {
  const events = sequence([[20, 0], [20, 1], [20, 2], [20, 3], [20, 4], [50, 1]]);
  expect(events.map(e => [e.audioTime, e.band])).toEqual([[.2, 'kick'], [.2, 'clap'], [.2, 'hat'], [.5, 'clap']]);
  for (const e of events) { expect(e.confidence).toBe(.9); expect(e.classMargin).toBeGreaterThan(0); }
});
it('rejects malformed/non-model evidence and flushes pending attacks on clock discontinuity', () => {
  const classifier = new PercussionClassifier();
  for (const scores of [[.9], [NaN, 0, 0, 0, 0], [2, 0, 0, 0, 0], { kick: .9 }])
    expect(classifier.push(scores, 0)).toEqual({ outcome: 'abstain', events: [] });
  for (let frame = 0; frame <= 20; frame++) classifier.push([frame === 20 ? .9 : 0, 0, 0, 0, 0], frame / 100);
  for (let frame = 0; frame < 20; frame++) expect(classifier.push([0, 0, 0, 0, 0], 10 + frame / 100).events).toEqual([]);
});
