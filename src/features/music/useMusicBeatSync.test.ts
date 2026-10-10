import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BeatEvent } from './mediaBridge';
import { useMusicBeatSync } from './useMusicBeatSync';
import { beatTelemetry } from '../../../extensions/kanban-music/beat-telemetry.js';

const bridge = vi.hoisted(() => ({ receive: undefined as undefined | ((event: BeatEvent) => void), send: vi.fn() }));
vi.mock('./mediaBridge', () => ({
  sendBeatRequest: bridge.send,
  subscribeBeatEvents: (_id: string, _subscription: string, receive: (event: BeatEvent) => void) => {
    bridge.receive = receive;
    return () => { bridge.receive = undefined; };
  },
}));
beforeEach(() => { vi.useFakeTimers(); bridge.send.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); beatTelemetry.enable(false); beatTelemetry.clear(); vi.useRealTimers(); vi.clearAllMocks(); vi.restoreAllMocks(); });
const emit = (event: BeatEvent) => act(() => { bridge.receive?.(event); });
it('keeps one audible subscription and its counters when analysis demand changes', async () => {
  const onClock = vi.fn();
  const options = { capabilities: { tier: 'tab-capture' as const, captureClock: 'output-clock-capable' as const } };
  const { result, rerender, unmount } = renderHook(({ demand }) => useMusicBeatSync('song', onClock, options, demand),
    { initialProps: { demand: true } });
  await act(async () => {});
  const subscription = bridge.receive;
  emit({ kind: 'clock', clock: { currentTime: 10, sampledAt: Date.now(), playbackRate: 1, playing: true, paused: false } });
  emit({ kind: 'sync.state', mode: 'capture', captureId: 'capture' });
  emit({ kind: 'onset', captureId: 'capture', sequence: 1, bands: ['kick'] });
  await act(async () => { await vi.advanceTimersByTimeAsync(40); });
  expect(result.current.onsets.kick).toBe(1);
  const owner = result.current.captureId;
  rerender({ demand: false });
  rerender({ demand: true });
  expect(bridge.receive).toBe(subscription);
  expect(result.current.captureId).toBe(owner);
  expect(result.current.onsets.kick).toBe(1);
  expect(bridge.send.mock.calls.filter(([kind]) => kind === 'dock.beat.sync.start')).toHaveLength(1);
  expect(bridge.send.mock.calls.filter(([kind]) => kind === 'dock.beat.sync.stop')).toHaveLength(0);
  unmount();
  expect(bridge.send.mock.calls.filter(([kind]) => kind === 'dock.beat.sync.stop')).toHaveLength(1);
});
it('preserves validated Lead cache readiness when a paused capture lease expires', async () => {
  const asset = { provider: 'youtube' as const, id: 'abcdefghijk' };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => Response.json(String(input).includes('chunk=')
    ? { version: 1, revision: 'r', index: 0, events: [] }
    : { version: 1, revision: 'r', asset, analysisVersion: 'server-lead-pulse-range-v1', duration: 30, chunkSeconds: 30, melodyPolicy: 'dominant-monophonic' }));
  const onClock = vi.fn();
  const options = { asset, duration: 30, demand: true, capabilities: { tier: 'clock-only' as const, captureClock: 'unavailable' as const } };
  const { result, rerender } = renderHook(({ source }) => useMusicBeatSync(source, onClock, options), { initialProps: { source: 'song' } });
  emit({ kind: 'clock', clock: { currentTime: 1, sampledAt: Date.now(), playbackRate: 1, playing: true, paused: false } });
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(result.current.leadAvailability).toBe('empty');
  emit({ kind: 'clock', clock: { currentTime: 1.1, sampledAt: Date.now(), playbackRate: 1, playing: false, paused: true } });
  await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
  expect(result.current).toMatchObject({ leadAvailability: 'empty', mode: 'clock', onsets: {} });
  rerender({ source: 'other-song' });
  await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
  expect(result.current.leadAvailability).toBeUndefined();
});
it('delivers dense real hats and kick attacks without a second detector refractory', () => {
  const onClock = vi.fn();
  const { result } = renderHook(() => useMusicBeatSync('song', onClock));
  emit({ kind: 'sync.state', mode: 'capture', captureId: 'capture' });
  for (let sequence = 1; sequence <= 20; sequence++) {
    act(() => { vi.advanceTimersByTime(50); });
    emit({ kind: 'onset', captureId: 'capture', sequence, bands: ['hat', 'kick'] });
  }
  expect(result.current.onsets).toEqual({ hat: 20, kick: 20 });
});
it('preserves distinct cache attacks when a faster playback rate compresses their delivery times', async () => {
  const onClock = vi.fn();
  const { result } = renderHook(() => useMusicBeatSync('song', onClock));
  emit({ kind: 'sync.state', mode: 'capture', captureId: 'capture', eventPath: 'cache' });
  const clock = { currentTime: 10, sampledAt: Date.now(), playbackRate: 4, playing: true, paused: false };
  for (let sequence = 1; sequence <= 10; sequence++) {
    emit({ kind: 'onset', captureId: 'capture', eventSource: 'cache', sequence, bands: ['hat'],
      targetPlaybackTime: 10 + sequence * .05, playbackClock: clock });
  }
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  expect(result.current.onsets.hat).toBe(10);
});
it('preserves distinct timestamped drum attacks delivered together after model look-ahead without changing Bass debounce', async () => {
  beatTelemetry.enable();
  const onClock = vi.fn();
  const { result } = renderHook(() => useMusicBeatSync('song', onClock));
  emit({ kind: 'sync.state', mode: 'capture', captureId: 'capture', eventPath: 'local' });
  const clock = { currentTime: 10, sampledAt: Date.now(), playbackRate: 1, playing: true, paused: false };
  for (let sequence = 1; sequence <= 2; sequence++) emit({ kind: 'onset', captureId: 'capture', eventSource: 'local', sequence,
    bands: ['clap', 'hat', 'bass'], targetPlaybackTime: 9.75 + sequence * .05, playbackClock: clock,
    telemetry: beatTelemetry.events('onset', ['clap', 'hat', 'bass']) });
  await act(async () => { await vi.advanceTimersByTimeAsync(15); });
  expect(result.current.onsets).toEqual({ clap: 2, hat: 2, bass: 1 });
  expect(beatTelemetry.snapshot().records.filter(r => r.stage === 'EVENT_DROPPED' && r.reason === 'debounce')
    .map(r => r.type)).toEqual(['bass']);
});
it('cancels scheduled flashes on capture expiry and selected-source replacement', async () => {
  const onClock = vi.fn();
  const { result, rerender } = renderHook(({ source }) => useMusicBeatSync(source, onClock), { initialProps: { source: 'song' } });
  const clock = () => ({ currentTime: 10, sampledAt: Date.now(), playbackRate: 1, playing: true, paused: false });
  const note = (captureId: string): BeatEvent => ({ kind: 'onset', captureId, sequence: 1, bands: ['kick'],
    targetPlaybackTime: 10.5, playbackClock: clock() });
  emit({ kind: 'sync.state', mode: 'capture', captureId: 'old' }); emit(note('old'));
  emit({ kind: 'sync.state', mode: 'clock', reason: 'expired' });
  emit({ kind: 'sync.state', mode: 'capture', captureId: 'new' }); emit(note('new'));
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(result.current.onsets).toEqual({ kick: 1 });
  emit({ kind: 'onset', captureId: 'new', sequence: 2, bands: ['hat'], targetPlaybackTime: 11, playbackClock: clock() });
  rerender({ source: 'other-song' });
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(result.current.onsets).toEqual({});
  emit({ kind: 'sync.state', mode: 'capture', captureId: 'other' }); emit(note('other'));
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(result.current.onsets).toEqual({ kick: 1 });
});
it('uses tempo only as structural timing and renews on explicit delivery recovery', async () => {
  const onClock = vi.fn();
  const { result } = renderHook(() => useMusicBeatSync('song', onClock));
  await act(async () => {});
  emit({ kind: 'sync.state', mode: 'capture', captureId: 'capture' });
  emit({ kind: 'tempo.state', captureId: 'capture', tempo: { locked: true, bpm: 120, confidence: .8 } });
  emit({ kind: 'tempo.tick', captureId: 'capture', tick: { step: 2, phase: 0, beatPosition: 1, subdivision: 2 } });
  expect(result.current.tickCount).toBe(1);
  expect(result.current.onsets).toEqual({});
  const requests = bridge.send.mock.calls.length;
  emit({ kind: 'sync.recover' });
  expect(bridge.send).toHaveBeenCalledTimes(requests + 1);
  emit({ kind: 'onset', captureId: 'capture', sequence: 1, bands: ['hat'] });
  expect(result.current.onsets).toEqual({ hat: 1 });
});
it('reports per-row debounce, duplicate sequence and stale owner without changing counters', () => {
  beatTelemetry.enable();
  const onClock = vi.fn();
  const { result } = renderHook(() => useMusicBeatSync('song', onClock));
  emit({ kind: 'sync.state', mode: 'capture', captureId: 'capture' });
  const traces = () => beatTelemetry.events('onset', ['kick'], { captureId: 'capture' });
  emit({ kind: 'onset', captureId: 'capture', sequence: 1, bands: ['kick'], telemetry: traces() });
  const accepted = result.current.telemetry?.['onset:kick'].id;
  emit({ kind: 'onset', captureId: 'capture', sequence: 2, bands: ['kick'], telemetry: traces() });
  emit({ kind: 'onset', captureId: 'capture', sequence: 2, bands: ['kick'], telemetry: traces() });
  emit({ kind: 'onset', captureId: 'old', sequence: 3, bands: ['kick'], telemetry: traces() });
  expect(result.current.onsets).toEqual({ kick: 1 });
  expect(result.current.telemetry?.['onset:kick'].id).toBe(accepted);
  expect(beatTelemetry.snapshot().records.filter((r) => r.stage === 'EVENT_DROPPED').map((r) => r.reason)).toEqual(['debounce', 'sequence', 'owner']);
});

it('observes state coalescing without losing the existing batched onset counts', () => {
  beatTelemetry.enable();
  const onClock = vi.fn();
  const { result } = renderHook(() => useMusicBeatSync('song', onClock));
  emit({ kind: 'sync.state', mode: 'capture', captureId: 'capture' });
  const first = beatTelemetry.events('onset', ['kick'])!;
  const second = beatTelemetry.events('onset', ['kick'])!;
  act(() => {
    bridge.receive?.({ kind: 'onset', captureId: 'capture', sequence: 1, bands: ['kick'], telemetry: first });
    vi.setSystemTime(Date.now() + 150);
    bridge.receive?.({ kind: 'onset', captureId: 'capture', sequence: 2, bands: ['kick'], telemetry: second });
  });
  expect(result.current.onsets.kick).toBe(2);
  expect(beatTelemetry.snapshot().records).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: first[0].id, stage: 'EVENT_DROPPED', reason: 'renderer-coalesced' }),
    expect.objectContaining({ id: second[0].id, stage: 'EVENT_STATE_COMMITTED' }),
  ]));
  emit({ kind: 'sync.state', mode: 'capture', captureId: 'replacement' });
  expect(result.current.telemetry).toBeUndefined();
});

it('leases Melody only from the current live capture and clears stalled notes, pause and capture replacement', async () => {
  const onClock = vi.fn();
  const { result } = renderHook(() => useMusicBeatSync('song', onClock));
  const note = { kind: 'melody.state' as const, captureId: 'capture', melody: { active: true, level: .6, note: 1 } };
  emit(note);
  expect(result.current.melody).toBeUndefined();
  emit({ kind: 'sync.state', mode: 'capture', captureId: 'capture' });
  emit(note);
  expect(result.current.melody?.active).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(600); });
  emit({ ...note, melody: { ...note.melody, level: .8 } });
  await act(async () => { await vi.advanceTimersByTimeAsync(600); });
  expect(result.current.melody?.active).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(101); });
  expect(result.current.melody).toBeUndefined();
  emit(note);
  emit({ kind: 'sync.state', mode: 'capture', captureId: 'replacement' });
  expect(result.current.melody).toBeUndefined();
  emit(note);
  expect(result.current.melody).toBeUndefined();
  emit({ ...note, captureId: 'replacement' });
  emit({ kind: 'clock', clock: { playing: false, paused: true, currentTime: 5, sampledAt: Date.now(), playbackRate: 1 } });
  expect(result.current.melody).toBeUndefined();
});

it('requests sync automatically, counts each onset once, and rejects old captures', () => {
  const onClock = vi.fn();
  const { result } = renderHook(() => useMusicBeatSync('song', onClock));
  expect(bridge.send).toHaveBeenCalledWith('dock.beat.sync.start', 'song', expect.any(String));
  emit({ kind: 'onset', captureId: 'capture', sequence: 1, bands: ['kick'] });
  expect(result.current.onsets).toEqual({});
  emit({ kind: 'sync.state', mode: 'capture', captureId: 'capture' });
  emit({ kind: 'onset', captureId: 'capture', sequence: 1, bands: ['kick', 'hat'] });
  emit({ kind: 'onset', captureId: 'capture', sequence: 1, bands: ['kick', 'hat'] });
  emit({ kind: 'onset', captureId: 'old-capture', sequence: 2, bands: ['clap'] });
  expect(result.current.onsets).toEqual({ kick: 1, hat: 1 });
  emit({ kind: 'onset', captureId: 'capture', sequence: 2, bands: ['clap'] });
  expect(result.current.onsets).toEqual({ kick: 1, hat: 1, clap: 1 });
  emit({ kind: 'sync.state', mode: 'clock', reason: 'muted' });
  expect(result.current).toMatchObject({ mode: 'clock', reason: 'muted', onsets: {} });
});

it('does not let continuing clock updates keep a dead capture live', async () => {
  const onClock = vi.fn();
  const { result } = renderHook(() => useMusicBeatSync('song', onClock));
  emit({ kind: 'sync.state', mode: 'capture', captureId: 'capture' });
  for (let second = 0; second < 4; second++) {
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    emit({ kind: 'clock', clock: { playing: true, paused: false, currentTime: second, sampledAt: Date.now(), playbackRate: 1 } });
  }
  expect(result.current).toMatchObject({ mode: 'clock', reason: 'sync-stale', onsets: {} });
  emit({ kind: 'onset', captureId: 'capture', sequence: 1, bands: ['kick'] });
  expect(result.current.onsets).toEqual({});
  emit({ kind: 'sync.state', mode: 'capture', captureId: 'new' });
  emit({ kind: 'onset', captureId: 'new', sequence: 1, bands: ['bass'] });
  expect(result.current.onsets).toEqual({ bass: 1 });
});
