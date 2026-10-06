import { expect, it } from 'vitest';
import { TempoTracker } from './tempo-tracker.js';

it.each([70, -70])('converges an accepted %s ms phase offset within four kicks without replaying ticks', (offset) => {
  const tracker = new TempoTracker();
  Object.assign(tracker, { locked: true, bpm: 120, anchor: offset });
  const emitted = [];
  for (let now = 0; now <= 2000; now += 10) {
    const result = tracker.analyze(0, now);
    if (now > 0 && now % 500 === 0) tracker.snapToBeat(now);
    if (result.tick) emitted.push(tracker.lastTick);
  }
  expect(Math.abs(tracker.anchor)).toBeLessThan(11);
  expect(emitted.every((tick, index) => index === 0 || tick === emitted[index - 1] + 1)).toBe(true);
});

it('ignores unlocked, invalid and out-of-gate kicks without moving phase', () => {
  const tracker = new TempoTracker();
  tracker.snapToBeat(500);
  expect(tracker.anchor).toBeNull();
  Object.assign(tracker, { locked: true, bpm: 120, anchor: 0 });
  for (const now of [110, NaN, Infinity]) tracker.snapToBeat(now);
  expect(tracker.anchor).toBe(0);
  tracker.snapToBeat(520);
  expect(tracker.anchor).toBeCloseTo(8);
});

it('keeps phase through a short breakdown and gently follows the next four drop kicks', () => {
  const tracker = new TempoTracker();
  Object.assign(tracker, { locked: true, bpm: 120, anchor: 0 });
  for (let now = 0; now < 1500; now += 10) tracker.analyze(0, now);
  expect(tracker.locked).toBe(true);
  expect(tracker.anchor).toBe(0);
  for (const now of [1570, 2070, 2570, 3070]) {
    const previousAnchor = tracker.anchor;
    tracker.analyze(3, now);
    tracker.snapToBeat(now);
    expect(Math.abs(tracker.anchor - previousAnchor)).toBeLessThanOrEqual(28);
  }
  expect(70 - tracker.anchor).toBeLessThan(10);
});

it.each([90, 128, 150])('bounds phase over ten minutes of %s BPM kicks with sample jitter and estimator updates', (bpm) => {
  const tracker = new TempoTracker();
  const beatMs = 60000 / bpm;
  Object.assign(tracker, { locked: true, bpm: bpm * 1.005, anchor: 50 });
  let previousBeat = -1;
  let kicks = 0;
  let worstError = 0;
  const ticks = [];
  for (let now = 0, frame = 0; now < 600000; now += 1000 / 60 + [0, 2, -3, 1][frame++ % 4]) {
    const currentBeat = Math.floor(now / beatMs);
    const kick = currentBeat > previousBeat;
    previousBeat = currentBeat;
    const result = tracker.analyze(kick ? 3 : 0, now);
    if (kick && result.locked) {
      tracker.snapToBeat(now);
      kicks++;
      const eighthMs = 30000 / tracker.bpm;
      const error = Math.abs(now - (tracker.anchor + Math.round((now - tracker.anchor) / eighthMs) * eighthMs));
      if (now > 10000) worstError = Math.max(worstError, error);
    }
    if (result.tick) ticks.push(tracker.lastTick);
  }
  expect(tracker.locked).toBe(true);
  expect(kicks).toBeGreaterThan(bpm * 9);
  expect(worstError).toBeLessThan(40);
  expect(ticks.every((tick, index) => index === 0 || tick > ticks[index - 1])).toBe(true);
});

it('locks to regular 120 BPM accents and emits structural timing without instrument identities', () => {
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
  expect(ticks.some((tick) => tick.step === 2)).toBe(true);
  ticks.forEach((tick) => {
    expect(tick).not.toHaveProperty('bands');
    expect(tick.subdivision).toBe(2);
    expect(tick.phase).toBeGreaterThanOrEqual(0);
    expect(tick.phase).toBeLessThan(1);
    expect(tick.beatPosition).toBeGreaterThanOrEqual(0);
  });
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
