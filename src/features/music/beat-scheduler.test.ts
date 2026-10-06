import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createBeatScheduler } from './beat-scheduler';
import type { BeatEvent, MusicClock } from './mediaBridge';
import { beatTelemetry } from '../../../extensions/kanban-music/beat-telemetry.js';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10000); beatTelemetry.enable(); });
afterEach(() => { beatTelemetry.enable(false); beatTelemetry.clear(); vi.useRealTimers(); });
const clock = (currentTime = 10): MusicClock => ({ playing: true, paused: false, currentTime, playbackRate: 1, sampledAt: Date.now() });
const event = (target: number, sequence = 1): BeatEvent => ({ kind: 'onset', captureId: 'capture', sequence, bands: ['kick'],
  targetPlaybackTime: target, playbackClock: clock(), telemetry: beatTelemetry.events('onset', ['kick'])!
    .map((trace) => ({ ...trace, targetTime: target * 1000, targetPlaybackTime: target })) });

it('releases from the playback clock rather than arrival and preserves queued targets', async () => {
  const deliver = vi.fn(), scheduler = createBeatScheduler(deliver, vi.fn());
  scheduler.clock(clock());
  scheduler.enqueue(event(10.5, 1)); scheduler.enqueue(event(10.75, 2));
  await vi.advanceTimersByTimeAsync(499); expect(deliver).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(deliver.mock.calls[0][0].sequence).toBe(1);
  await vi.advanceTimersByTimeAsync(250); expect(deliver.mock.calls[1][0].sequence).toBe(2);
  expect(beatTelemetry.snapshot().counts.EVENT_SCHEDULED).toBe(2);
  scheduler.reset(); expect(vi.getTimerCount()).toBe(0);
});

it('absorbs a processing delay before the target without shifting the target', async () => {
  const deliver = vi.fn(), scheduler = createBeatScheduler(deliver, vi.fn());
  const early = event(11); scheduler.clock(clock());
  await vi.advanceTimersByTimeAsync(650); scheduler.enqueue(early);
  await vi.advanceTimersByTimeAsync(349); expect(deliver).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(deliver).toHaveBeenCalledOnce();
  scheduler.reset();
});

it('observes small lateness but drops an expired backlog and requests recovery', async () => {
  const deliver = vi.fn(), recover = vi.fn(), scheduler = createBeatScheduler(deliver, recover);
  scheduler.clock(clock()); scheduler.enqueue(event(9.9));
  await vi.advanceTimersByTimeAsync(0); expect(deliver).toHaveBeenCalledOnce();
  scheduler.enqueue(event(9, 2)); scheduler.enqueue(event(9.1, 3));
  await vi.advanceTimersByTimeAsync(1);
  expect(deliver).toHaveBeenCalledOnce(); expect(recover).toHaveBeenCalledOnce();
  const log = beatTelemetry.snapshot();
  expect(log.counts.EVENT_LATE).toBe(3);
  expect(log.records.filter((r) => r.stage === 'EVENT_DROPPED').every((r) => r.reason === 'schedule-late')).toBe(true);
  scheduler.reset();
});

it.each([30, 2])('cancels queued work on seek to %s and rejects pre-seek anchors', async (seek) => {
  const deliver = vi.fn(), scheduler = createBeatScheduler(deliver, vi.fn());
  scheduler.clock(clock()); const old = event(11); scheduler.enqueue(old);
  await vi.advanceTimersByTimeAsync(100); expect(scheduler.clock(clock(seek))).toBe(true);
  scheduler.enqueue(old);
  await vi.advanceTimersByTimeAsync(2000); expect(deliver).not.toHaveBeenCalled();
  expect(beatTelemetry.snapshot().records.some((r) => r.reason === 'schedule-reset')).toBe(true);
  scheduler.reset();
});

it('cancels pause, capture replacement and recovery work while allowing fresh targets', async () => {
  const deliver = vi.fn(), scheduler = createBeatScheduler(deliver, vi.fn());
  scheduler.clock(clock()); scheduler.enqueue(event(11));
  scheduler.clock({ ...clock(), playing: false, paused: true });
  await vi.advanceTimersByTimeAsync(1000); expect(deliver).not.toHaveBeenCalled();
  scheduler.clock(clock(11)); scheduler.enqueue({ ...event(11.2), playbackClock: clock(11) });
  scheduler.reset('capture-disconnected', true);
  await vi.advanceTimersByTimeAsync(500); expect(deliver).not.toHaveBeenCalled();
  scheduler.enqueue({ ...event(12), playbackClock: clock(11.5) });
  await vi.advanceTimersByTimeAsync(500); expect(deliver).toHaveBeenCalledOnce();
  scheduler.reset();
});

it('prevents a full queue from rejecting fresh work and preserves tempo identity', async () => {
  const deliver = vi.fn(), scheduler = createBeatScheduler(deliver, vi.fn()); scheduler.clock(clock());
  for (let i = 0; i < 2048; i++) scheduler.enqueue(event(12, i + 1));
  const tick: BeatEvent = { kind: 'tempo.tick', captureId: 'capture', targetPlaybackTime: 10.1, playbackClock: clock(),
    tick: { step: 1, phase: 0, beatPosition: .5, subdivision: 2 }, telemetry: beatTelemetry.events('tempo', ['generic']) };
  scheduler.enqueue(tick); await vi.advanceTimersByTimeAsync(100);
  expect(deliver).toHaveBeenCalledWith(expect.objectContaining({ kind: tick.kind, tick: tick.tick, targetPlaybackTime: tick.targetPlaybackTime }));
  expect(beatTelemetry.snapshot().records.some((r) => r.reason === 'queue-full')).toBe(true);
  scheduler.reset();
});

it('expires scheduled work if the playback clock disappears instead of reviving old flashes', async () => {
  const deliver = vi.fn(), recover = vi.fn(), scheduler = createBeatScheduler(deliver, recover);
  scheduler.clock(clock()); scheduler.enqueue(event(14));
  await vi.advanceTimersByTimeAsync(4000); expect(deliver).not.toHaveBeenCalled(); expect(recover).toHaveBeenCalledOnce();
  expect(beatTelemetry.snapshot().records.some((r) => r.reason === 'clock-stale')).toBe(true);
  scheduler.reset();
});

it('reschedules small clock corrections and honors playback rate without changing row payloads', async () => {
  const deliver = vi.fn(), scheduler = createBeatScheduler(deliver, vi.fn());
  scheduler.clock({ ...clock(), playbackRate: 2 });
  scheduler.enqueue({ ...event(11), playbackClock: { ...clock(), playbackRate: 2 } });
  await vi.advanceTimersByTimeAsync(250);
  scheduler.clock({ ...clock(10.6), playbackRate: 2 });
  await vi.advanceTimersByTimeAsync(199); expect(deliver).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(deliver).toHaveBeenCalledOnce();
  expect(deliver.mock.calls[0][0].bands).toEqual(['kick']); scheduler.reset();
});

it('re-arms a queued media timestamp when rate changes and updates diagnostic render deadline', async () => {
  const deliver = vi.fn(), scheduler = createBeatScheduler(deliver, vi.fn());
  scheduler.clock(clock()); scheduler.enqueue(event(11));
  await vi.advanceTimersByTimeAsync(200);
  scheduler.clock({ ...clock(10.2), playbackRate: 2 });
  await vi.advanceTimersByTimeAsync(399); expect(deliver).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(deliver).toHaveBeenCalledOnce();
  expect(deliver.mock.calls[0][0].telemetry[0]).toMatchObject({ targetPlaybackTime: 11, targetTime: 10600 });
  scheduler.reset();
});

it('flushes on buffering, holds the actual position, and rebuilds only from fresh events', async () => {
  const deliver = vi.fn(), scheduler = createBeatScheduler(deliver, vi.fn());
  scheduler.clock(clock()); const old = event(11); scheduler.enqueue(old);
  await vi.advanceTimersByTimeAsync(100);
  scheduler.clock({ ...clock(10.1), playing: false, buffering: true });
  scheduler.enqueue(old);
  await vi.advanceTimersByTimeAsync(2000); expect(deliver).not.toHaveBeenCalled();
  scheduler.clock(clock(10.1));
  scheduler.enqueue({ ...event(10.3), playbackClock: clock(10.1) });
  await vi.advanceTimersByTimeAsync(200); expect(deliver).toHaveBeenCalledOnce();
  expect(beatTelemetry.snapshot().records.some(r => r.reason === 'buffering')).toBe(true);
  scheduler.reset();
});

it('invalidates sub-threshold seeks and equal-time old anchors with explicit media generations', async () => {
  const deliver = vi.fn(), scheduler = createBeatScheduler(deliver, vi.fn());
  scheduler.clock({ ...clock(), generation: 0 });
  const old = { ...event(10.2), playbackClock: { ...clock(), generation: 0 } };
  scheduler.enqueue(old);
  expect(scheduler.clock({ ...clock(10.05), generation: 1 })).toBe(true);
  scheduler.enqueue(old);
  scheduler.enqueue({ ...event(10.15), playbackClock: { ...clock(10.05), generation: 1 } });
  await vi.advanceTimersByTimeAsync(100); expect(deliver).toHaveBeenCalledOnce();
  scheduler.reset();
});

it('bounds stale-clock waiting independently of a distant target', async () => {
  const deliver = vi.fn(), recover = vi.fn(), scheduler = createBeatScheduler(deliver, recover);
  scheduler.clock(clock()); scheduler.enqueue(event(17));
  await vi.advanceTimersByTimeAsync(3501);
  expect(recover).toHaveBeenCalledOnce(); expect(deliver).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('does not flash from malformed timestamps, while legacy arrival events remain supported', () => {
  const deliver = vi.fn(), scheduler = createBeatScheduler(deliver, vi.fn());
  scheduler.clock(clock()); scheduler.enqueue({ ...event(11), targetPlaybackTime: NaN });
  scheduler.enqueue({ kind: 'onset', bands: ['kick'] });
  expect(deliver).toHaveBeenCalledOnce(); scheduler.reset();
});

it('bounds future clock anchors and observes lateness without a producer diagnostic sidecar', async () => {
  const deliver = vi.fn(), recover = vi.fn(), scheduler = createBeatScheduler(deliver, recover);
  scheduler.enqueue({ ...event(10), playbackClock: { ...clock(), sampledAt: Date.now() + 100000 } });
  scheduler.clock(clock()); scheduler.enqueue({ ...event(9), telemetry: undefined });
  await vi.advanceTimersByTimeAsync(0);
  expect(deliver).not.toHaveBeenCalled(); expect(recover).toHaveBeenCalledOnce();
  expect(beatTelemetry.snapshot().records).toEqual(expect.arrayContaining([
    expect.objectContaining({ stage: 'EVENT_LATE', reason: 'schedule-late', offsetMs: 1000 }),
  ]));
  scheduler.reset();
});

it('runs a long media timeline with bounded timers and no accumulated scheduling drift', async () => {
  const deliver = vi.fn(), scheduler = createBeatScheduler(deliver, vi.fn());
  for (let i = 0; i < 1800; i++) {
    scheduler.clock(clock(i));
    scheduler.enqueue({ ...event(i + .25, i + 1), playbackClock: clock(i) });
    await vi.advanceTimersByTimeAsync(250);
    expect(deliver.mock.calls.at(-1)?.[0].targetPlaybackTime).toBe(i + .25);
    await vi.advanceTimersByTimeAsync(750);
    expect(vi.getTimerCount()).toBe(0);
  }
  expect(deliver).toHaveBeenCalledTimes(1800); scheduler.reset();
});
