import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useMusicBeatSync } from './useMusicBeatSync';
import type { PlaybackAudioSegment } from './playback-audio-segment';
import type { MusicClock } from './mediaBridge';

const input = vi.hoisted(() => ({ receive: undefined as undefined | ((owner: string, samples: Float32Array, clock: MusicClock) => void),
  demand: true, segments: [] as PlaybackAudioSegment[], send: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./mediaBridge', () => ({ sendBeatRequest: input.send, subscribeBeatEvents: () => () => {} }));
vi.mock('../native/runtime', () => ({ isNativeWidget: () => true }));
vi.mock('../native/nativeMusic', () => ({ subscribeNativeAudio: (receive: typeof input.receive) => {
  input.receive = receive; return () => { input.receive = undefined; };
} }));
vi.mock('./beat-event-engine', () => ({ createBeatEventEngine: (options: { demand: boolean }) => {
  input.demand = options.demand;
  return { setDemand: (value: boolean) => { input.demand = value; }, needsCapturedAudio: () => input.demand,
    captureSegment: (segment: PlaybackAudioSegment) => { input.segments.push(segment); }, accept: () => {}, stop: () => {} };
} }));
afterEach(() => { cleanup(); vi.useRealTimers(); input.segments = []; input.send.mockClear(); });

it('discards hidden native PCM and previous context without restarting the audible subscription', () => {
  vi.useFakeTimers(); vi.setSystemTime(100000);
  const options = { capturedInput: true, capabilities: { tier: 'native-monitor' as const, captureClock: 'estimated' as const } };
  const update = () => {};
  const { rerender, unmount } = renderHook(({ demand }) => useMusicBeatSync('song', update, options, demand),
    { initialProps: { demand: true } });
  const owner = input.receive;
  const packet = (second: number, level: number) => {
    vi.setSystemTime(100000 + second * 1000);
    act(() => input.receive?.('song', new Float32Array(88200).fill(level),
      { currentTime: second, sampledAt: Date.now(), playbackRate: 1, playing: true, paused: false }));
  };
  for (let second = 1; second <= 30; second++) packet(second, .1);
  expect(input.segments).toHaveLength(1);
  rerender({ demand: false });
  for (let second = 31; second <= 60; second++) packet(second, .9);
  expect(input.segments).toHaveLength(1);
  rerender({ demand: true });
  expect(input.receive).toBe(owner);
  for (let second = 61; second <= 90; second++) packet(second, .2);
  expect(input.segments).toHaveLength(2);
  const resumed = input.segments[1];
  expect(resumed.inputStart).toBe(60);
  const view = new DataView(resumed.audio.buffer);
  let minimum = Infinity, maximum = -Infinity;
  for (let offset = 44; offset < resumed.audio.length; offset += 2) {
    const sample = view.getInt16(offset, true); minimum = Math.min(minimum, sample); maximum = Math.max(maximum, sample);
  }
  expect([minimum, maximum]).toEqual([Math.round(.2 * 32767), Math.round(.2 * 32767)]);
  expect(input.send.mock.calls.filter(([kind]) => kind === 'dock.beat.sync.stop')).toHaveLength(0);
  unmount();
  expect(input.receive).toBeUndefined();
});
