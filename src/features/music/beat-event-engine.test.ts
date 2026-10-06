import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createBeatEventEngine, type BeatEventOptions } from './beat-event-engine';
import { InvalidEventTrack, type EventTrackClient } from './event-track-client';
import type { BeatEvent } from './mediaBridge';
import { beatTelemetry } from '../../../extensions/kanban-music/beat-telemetry.js';
import type { TrackManifest, TrackChunk } from './event-track';
const asset = { provider: 'youtube' as const, id: 'abcdefghijk' };
const manifest: TrackManifest = { version: 1, asset, revision: 'r', analysisVersion: 'reference-v1', duration: 7200, chunkSeconds: 30, melodyPolicy: 'dominant-monophonic' };
const options: BeatEventOptions = { asset, capabilities: { tier: 'tab-capture', captureClock: 'output-clock-capable' } };
const clock = (position = 10) => ({ playing: true, paused: false, currentTime: position, sampledAt: Date.now(), playbackRate: 1 });
const chunk = (index: number, time = index * 30 + .25): TrackChunk => ({ version: 1, revision: 'r', index, events: [{ id: `n-${index}`, time, row: 'kick', confidence: .9 }] });
let stop: (() => void) | undefined;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10000); beatTelemetry.enable(); });
afterEach(() => { stop?.(); stop = undefined; beatTelemetry.enable(false); beatTelemetry.clear(); vi.useRealTimers(); });
const semantic = (events: BeatEvent[]) => events.filter(e => e.kind === 'onset' || e.kind === 'melody.state');
const setup = (client: EventTrackClient, config = options) => {
  const events: BeatEvent[] = [], recover = vi.fn();
  const engine = createBeatEventEngine(config, event => events.push(event), recover, () => client); stop = engine.stop;
  engine.accept({ kind: 'clock', clock: clock() });
  return { events, engine, recover };
};
it('keeps local onsets alive while asynchronous analysis is pending and never fabricates semantic fallback rows', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(undefined), chunk: vi.fn(), requestAnalysis: vi.fn().mockResolvedValue('pending') };
  const { events, engine } = setup(client);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'local' });
  engine.accept({ kind: 'onset', captureId: 'local', sequence: 1, bands: ['kick'], targetPlaybackTime: 10.25, playbackClock: clock() });
  await vi.advanceTimersByTimeAsync(250);
  expect(semantic(events)).toHaveLength(1); expect(client.requestAnalysis).toHaveBeenCalledOnce();
  engine.accept({ kind: 'sync.state', mode: 'clock', reason: 'capture-permission' });
  await vi.advanceTimersByTimeAsync(300);
  expect(engine.stats().path).toBe('degraded');
  expect(semantic(events)).toHaveLength(1);
  expect(events.some(e => e.kind === 'tempo.tick' && e.eventSource === 'degraded')).toBe(true);
});
it('replaces queued local events with cache authority and suppresses double flashes at handoff', async () => {
  let resolveChunk!: (value: TrackChunk) => void;
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn((_: TrackManifest, index: number) => index === 0
    ? new Promise<TrackChunk>(resolve => { resolveChunk = resolve; }) : Promise.resolve(chunk(index))), requestAnalysis: vi.fn() };
  const { engine, events } = setup(client);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'local' });
  engine.accept({ kind: 'onset', captureId: 'local', sequence: 1, bands: ['kick'], targetPlaybackTime: 10.5, playbackClock: clock() });
  await vi.advanceTimersByTimeAsync(0); resolveChunk(chunk(0, 10.5)); await vi.advanceTimersByTimeAsync(500);
  expect(semantic(events)).toHaveLength(1); expect(semantic(events)[0].eventSource).toBe('cache');
  expect(beatTelemetry.snapshot().counts.EVENT_REPLACED).toBeGreaterThan(0);
  engine.accept({ kind: 'onset', captureId: 'local', sequence: 2, bands: ['kick'], targetPlaybackTime: 10.5, playbackClock: clock() });
  await vi.advanceTimersByTimeAsync(50); expect(semantic(events)).toHaveLength(1);
});
it('does not reflash already delivered local events when a cache hit arrives just afterward', async () => {
  let resolveChunk!: (value: TrackChunk) => void;
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn((_: TrackManifest, index: number) => index === 0
    ? new Promise<TrackChunk>(resolve => { resolveChunk = resolve; }) : Promise.resolve(chunk(index))), requestAnalysis: vi.fn() };
  const { engine, events } = setup(client);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'local' });
  engine.accept({ kind: 'onset', captureId: 'local', sequence: 1, bands: ['kick'], targetPlaybackTime: 10.25, playbackClock: clock() });
  await vi.advanceTimersByTimeAsync(250); resolveChunk(chunk(0, 10.25)); await vi.advanceTimersByTimeAsync(20);
  expect(semantic(events)).toHaveLength(1);
});
it('bounds chunk memory across long media and cancels old requests and targets on small seeks', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn(async (_: TrackManifest, index: number) => chunk(index)), requestAnalysis: vi.fn() };
  const { engine, events } = setup(client);
  for (let index = 1; index < 120; index++) {
    engine.accept({ kind: 'clock', clock: { ...clock(index * 30), generation: index } });
    await vi.advanceTimersByTimeAsync(300);
    expect(engine.stats().chunks).toBeLessThanOrEqual(3); expect(engine.stats().requests).toBeLessThanOrEqual(2);
    expect(engine.stats().pending).toBeLessThanOrEqual(2048);
  }
  expect(semantic(events).length).toBeGreaterThan(100);
  const old = semantic(events).length;
  engine.accept({ kind: 'clock', clock: { ...clock(3570.05), generation: 200, paused: true, playing: false } });
  await vi.advanceTimersByTimeAsync(1000); expect(semantic(events)).toHaveLength(old);
  engine.stop(); expect(vi.getTimerCount()).toBe(0);
});
it('recovers a cache miss without freezing during server failure or stale clocks', async () => {
  const client = { manifest: vi.fn().mockRejectedValue(new Error('offline')), chunk: vi.fn(), requestAnalysis: vi.fn() };
  const { engine, events, recover } = setup(client);
  await vi.advanceTimersByTimeAsync(2000);
  expect(events.some(e => e.kind === 'tempo.tick')).toBe(true);
  await vi.advanceTimersByTimeAsync(2000); expect(recover).toHaveBeenCalled();
  engine.accept({ kind: 'clock', clock: clock(14) }); await vi.advanceTimersByTimeAsync(100);
  expect(engine.stats().path).toBe('degraded');
  expect(beatTelemetry.snapshot().counts.CACHE_MISS).toBeGreaterThan(0);
});

it('flushes cached targets on buffering, pause, seek and interruption, then rebuilds at the new rate', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn(async (_: TrackManifest, index: number) => chunk(index, index * 30 + 10.5)), requestAnalysis: vi.fn() };
  const { engine, events } = setup(client);
  await vi.advanceTimersByTimeAsync(0);
  engine.accept({ kind: 'clock', clock: { ...clock(), buffering: true, playing: false } });
  await vi.advanceTimersByTimeAsync(600); expect(semantic(events)).toHaveLength(0);
  engine.accept({ kind: 'clock', clock: { ...clock(), playbackRate: 2 } });
  await vi.advanceTimersByTimeAsync(250); expect(semantic(events)).toHaveLength(1);
  engine.accept({ kind: 'clock', clock: { ...clock(40), generation: 1, paused: true, playing: false } });
  await vi.advanceTimersByTimeAsync(1000); expect(semantic(events)).toHaveLength(1);
  engine.accept({ kind: 'clock', clock: { ...clock(40), generation: 1 } });
  await vi.advanceTimersByTimeAsync(500); expect(semantic(events)).toHaveLength(2);
  engine.accept({ kind: 'sync.state', mode: 'clock', reason: 'expired' });
  engine.accept({ kind: 'clock', clock: { ...clock(10), generation: 2 } });
  await vi.advanceTimersByTimeAsync(500); expect(semantic(events)).toHaveLength(3);
  expect(engine.stats().path).toBe('cache');
});

it('does not allow seek-aborted fetches or old capture owners to reinsert scheduled work', async () => {
  let finish!: (value: TrackChunk) => void;
  let oldSignal: AbortSignal | undefined;
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn((_m: TrackManifest, index: number, signal?: AbortSignal) => {
    if (index === 0) { oldSignal = signal; return new Promise<TrackChunk>(resolve => { finish = resolve; }); }
    return Promise.resolve(chunk(index));
  }), requestAnalysis: vi.fn() };
  const { engine, events } = setup(client);
  await vi.advanceTimersByTimeAsync(0);
  engine.accept({ kind: 'clock', clock: { ...clock(90), generation: 1 } });
  expect(oldSignal?.aborted).toBe(true); finish(chunk(0, 10.25));
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'old' });
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'fresh' });
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'old' });
  engine.accept({ kind: 'onset', bands: ['hat'], sequence: 1, captureId: 'old', targetPlaybackTime: 90.1, playbackClock: clock(90) });
  await vi.advanceTimersByTimeAsync(300);
  expect(semantic(events)).toHaveLength(1); expect(semantic(events)[0].eventSource).toBe('cache');
  expect(engine.stats().chunks).toBeLessThanOrEqual(2);
});

it('keeps explicit silence dark and resumes local notes without reviving disabled future melody', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(undefined), chunk: vi.fn(), requestAnalysis: vi.fn().mockResolvedValue('unavailable') };
  const { engine, events } = setup(client);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'local' });
  engine.accept({ kind: 'melody.state', captureId: 'local', melody: { active: true, level: .8, note: 1 }, targetPlaybackTime: 10.5, playbackClock: clock() });
  engine.accept({ kind: 'melody.state', captureId: 'local', melody: { active: false, level: 0, note: 0 } });
  engine.accept({ kind: 'sync.state', mode: 'clock', reason: 'silent' });
  const before = events.length;
  await vi.advanceTimersByTimeAsync(1000); expect(events).toHaveLength(before);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'fresh' });
  engine.accept({ kind: 'onset', captureId: 'fresh', sequence: 1, bands: ['kick'], targetPlaybackTime: 11.1, playbackClock: clock(11) });
  await vi.advanceTimersByTimeAsync(100);
  expect(events.filter(e => e.kind === 'melody.state' && e.melody.active)).toHaveLength(0);
  expect(events.filter(e => e.kind === 'onset')).toHaveLength(1);
});

it('observes late semantic targets and recovers to fresh events rather than replaying a backlog', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(undefined), chunk: vi.fn(), requestAnalysis: vi.fn().mockResolvedValue('unavailable') };
  const { engine, events, recover } = setup(client);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'local' });
  const trace = beatTelemetry.events('onset', ['kick']);
  engine.accept({ kind: 'onset', captureId: 'local', sequence: 1, bands: ['kick'], targetPlaybackTime: 9, playbackClock: clock(), telemetry: trace });
  await vi.advanceTimersByTimeAsync(0);
  expect(recover).toHaveBeenCalled(); expect(semantic(events)).toHaveLength(0);
  expect(beatTelemetry.snapshot().counts.EVENT_LATE).toBeGreaterThan(0);
  engine.accept({ kind: 'onset', captureId: 'local', sequence: 2, bands: ['kick'], targetPlaybackTime: 10.1, playbackClock: clock() });
  await vi.advanceTimersByTimeAsync(100); expect(semantic(events)).toHaveLength(1);
});

it('cancels queued cached flashes when muted and rebuilds after unmuting', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn(async (_: TrackManifest, index: number) => chunk(index, index * 30 + 10.5)), requestAnalysis: vi.fn() };
  const { engine, events } = setup(client);
  await vi.advanceTimersByTimeAsync(0);
  engine.accept({ kind: 'sync.state', mode: 'clock', reason: 'muted' });
  await vi.advanceTimersByTimeAsync(500); expect(semantic(events)).toHaveLength(0);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'unmuted' });
  engine.accept({ kind: 'clock', clock: { ...clock(10), generation: 1 } });
  await vi.advanceTimersByTimeAsync(500); expect(semantic(events)).toHaveLength(1);
});

it('refreshes a mismatched cache revision with bounded backoff while local analysis continues', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn().mockRejectedValue(new InvalidEventTrack('replaced revision')), requestAnalysis: vi.fn() };
  const { engine, events } = setup(client);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'local' });
  await vi.advanceTimersByTimeAsync(0);
  engine.accept({ kind: 'onset', captureId: 'local', sequence: 1, bands: ['kick'], targetPlaybackTime: 10.1, playbackClock: clock() });
  await vi.advanceTimersByTimeAsync(100); expect(semantic(events)).toHaveLength(1);
  expect(engine.stats().manifest).toBe(false); expect(client.manifest).toHaveBeenCalledOnce();
  client.chunk.mockImplementation(async (_: TrackManifest, index: number) => chunk(index, index * 30 + 25.25));
  for (let i = 1; i <= 15; i++) {
    engine.accept({ kind: 'clock', clock: clock(10 + i) }); await vi.advanceTimersByTimeAsync(1000);
  }
  expect(client.manifest).toHaveBeenCalledTimes(2); expect(engine.stats().path).toBe('cache');
});

it('keeps cached quiet ranges leased across two hours of continuous playback with bounded chunks', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn(async (_: TrackManifest, index: number) => chunk(index)), requestAnalysis: vi.fn() };
  const { engine, events } = setup(client);
  engine.accept({ kind: 'clock', clock: { ...clock(0), generation: 1 } });
  for (let second = 0; second < 7200; second++) {
    engine.accept({ kind: 'clock', clock: { ...clock(second), generation: 1 } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(engine.stats().chunks).toBeLessThanOrEqual(3);
  }
  expect(semantic(events)).toHaveLength(240);
  expect(events.filter(e => e.kind === 'sync.state' && e.eventPath === 'cache').length).toBeGreaterThan(3000);
  expect(client.chunk).toHaveBeenCalledTimes(240);
  expect(engine.stats().pending).toBe(0);
});
