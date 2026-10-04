import { expect, it } from 'vitest';
import { TempoTracker } from './tempo-tracker.js';

it('locks to regular 120 BPM accents and emits eighth-note drum rows', () => {
  const tracker = new TempoTracker();
  const ticks = [];
  for (let frame = 0; frame < 660; frame++) {
    const result = tracker.analyze(frame % 30 === 0 ? 3 : 0, frame * 1000 / 60);
    if (result.tick) ticks.push(result.tick);
  }
  expect(tracker.locked).toBe(true);
  expect(tracker.bpm).toBeGreaterThan(114);
  expect(tracker.bpm).toBeLessThan(126);
  expect(tracker.confidence).toBeGreaterThan(0.42);
  expect(ticks.some((tick) => tick.step === 0 && tick.bands.includes('kick') && tick.bands.includes('hat'))).toBe(true);
  expect(ticks.some((tick) => tick.step === 2 && tick.bands.includes('clap'))).toBe(true);
  expect(ticks.some((tick) => tick.step % 2 === 1 && tick.bands.length === 1 && tick.bands[0] === 'hat')).toBe(true);
});

it('does not invent a tempo from a flat signal and unlocks after four low-confidence seconds', () => {
  const tracker = new TempoTracker();
  for (let frame = 0; frame < 420; frame++) tracker.analyze(frame % 30 === 0 ? 3 : 0, frame * 1000 / 60);
  expect(tracker.locked).toBe(true);
  for (let frame = 420; frame < 1200; frame++) tracker.analyze(0, frame * 1000 / 60);
  expect(tracker.locked).toBe(false);
  expect(tracker.bpm).toBeNull();
  expect(tracker.confidence).toBe(0);
  expect(tracker.analyze(0, 20000).tick).toBeUndefined();
});

it('releases an incompatible tempo before locking to the new pulse', () => {
  const tracker = new TempoTracker();
  for (let frame = 0; frame < 660; frame++) tracker.analyze(frame % 30 === 0 ? 3 : 0, frame * 1000 / 60);
  expect(tracker.locked).toBe(true);
  let released = false;
  for (let frame = 660; frame < 2100; frame++) {
    const result = tracker.analyze((frame - 660) % 24 === 0 ? 3 : 0, frame * 1000 / 60);
    if (!result.locked) released = true;
    if (result.locked && result.bpm > 140) expect(released).toBe(true);
  }
  expect(released).toBe(true);
  expect(tracker.locked).toBe(true);
  expect(tracker.bpm).toBeCloseTo(150, 0);
});

it('leaves free-tempo accents calm instead of melodyesizing a beat grid', () => {
  const tracker = new TempoTracker();
  // Deliberately wandering gaps: no stable 60–180 BPM pulse to lock onto.
  const gaps = [19, 48, 31, 62, 24, 39, 73, 27, 55, 34, 67, 22, 43, 78];
  let next = gaps[0];
  let gapIndex = 1;
  let lockedFrames = 0;
  for (let frame = 0; frame < 1800; frame++) {
    if (frame === next) { next += gaps[gapIndex++ % gaps.length]; }
    const result = tracker.analyze(frame === next - gaps[(gapIndex - 1) % gaps.length] ? 3 : 0, frame * 1000 / 60);
    if (result.locked) lockedFrames++;
    expect(result.tick).toBeUndefined();
  }
  expect(lockedFrames).toBe(0);
  expect(tracker.bpm).toBeNull();
});
