import { describe, it, expect } from 'vitest';
import { EarlyPercussionClassifier } from './early-percussion-classifier.js';

describe('private early percussion decisions', () => {
  it('preserves the predicted onset and closes an isolated group at score p+3', () => {
    const classifier = new EarlyPercussionClassifier(undefined, { diagnostics: true });
    const events = [];
    for (let i = 0; i < 40; i++) {
      const result = classifier.push([i === 20 ? 1 : 0, 0, 0, 0, 0], i / 100);
      for (const event of result.events) events.push({ event, decision: i });
    }
    expect(events).toHaveLength(1);
    expect(events[0].event.audioTime).toBe(.2);
    expect(events[0].decision).toBe(23);
  });

  it('does not release a pending group on malformed input or carry it across a gap', () => {
    const classifier = new EarlyPercussionClassifier();
    for (let i = 0; i <= 22; i++) classifier.push([i === 20 ? 1 : 0, 0, 0, 0, 0], i / 100);
    expect(classifier.push([NaN, 0, 0, 0, 0], .23).events).toEqual([]);
    expect(classifier.push([0, 0, 0, 0, 0], 2).events).toEqual([]);
    expect(classifier.pending.every(group => group === null)).toBe(true);
  });
});
