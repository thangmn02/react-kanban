import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BeatEvent } from './mediaBridge';
import { useMusicBeatSync } from './useMusicBeatSync';

const bridge = vi.hoisted(() => ({ receive: undefined as undefined | ((event: BeatEvent) => void), send: vi.fn() }));
vi.mock('./mediaBridge', () => ({
  sendBeatRequest: bridge.send,
  subscribeBeatEvents: (_id: string, _subscription: string, receive: (event: BeatEvent) => void) => {
    bridge.receive = receive;
    return () => { bridge.receive = undefined; };
  },
}));
beforeEach(() => { vi.useFakeTimers(); bridge.send.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });
const emit = (event: BeatEvent) => act(() => { bridge.receive?.(event); });

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
