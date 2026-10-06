import { expect, it, vi, afterEach } from 'vitest';
import { outputTiming, audibleClock, playbackTiming, playbackPosition, parsePlaybackClock, parsePlaybackTiming } from './beat-timing.js';
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const clock = { currentTime: 12, playbackRate: 2, playing: true, paused: false, sampledAt: 10000 };
it('normalizes an audio output deadline into real song seconds without arrival-time substitution', () => {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const context = { currentTime: 2, baseLatency: .01, outputLatency: .02 };
  const output = outputTiming(context, 2.5, true);
  expect(output.targetOutputTime).toBe(10500);
  expect(playbackTiming(clock, output).targetPlaybackTime).toBe(13);
  expect(playbackTiming(clock, output, 1).targetPlaybackTime).toBe(11);
});
it('uses output-clock capability when present and preserves legacy sampled-clock fallback', () => {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const context = { currentTime: 2, baseLatency: .01, outputLatency: .02,
    getOutputTimestamp: () => ({ contextTime: 1.9, performanceTime: performance.now() }) };
  // Fake performance clock begins at zero, so zero timestamps are unsupported.
  expect(outputTiming(context, 2.5)).toEqual({ targetOutputTime: 10500 });
  vi.spyOn(performance, 'now').mockReturnValue(50);
  context.getOutputTimestamp = () => ({ contextTime: 1.9, performanceTime: 25 });
  expect(outputTiming(context, 2.5).targetOutputTime).toBeCloseTo(10545);
  context.getOutputTimestamp = () => { throw new Error('Unavailable output clock'); };
  expect(outputTiming(context, 2.5)).toEqual({ targetOutputTime: 10500 });
  expect(outputTiming(context, NaN)).toBeUndefined();
  expect(audibleClock({ ...clock, generation: 2, buffering: true }, 1)).toMatchObject({ generation: 2, buffering: true, currentTime: 10 });
});
it('rejects malformed rates/lifecycle flags and never advances buffered media', () => {
  expect(parsePlaybackClock({ ...clock, playbackRate: 0 })).toBeUndefined();
  expect(parsePlaybackClock({ ...clock, generation: -1 })).toBeUndefined();
  expect(parsePlaybackTiming({ targetPlaybackTime: 13, playbackClock: { ...clock, buffering: 'yes' } })).toBeUndefined();
  expect(playbackPosition({ ...clock, buffering: true }, 11000)).toBe(12);
  expect(playbackPosition(clock, 11000)).toBe(14);
});
