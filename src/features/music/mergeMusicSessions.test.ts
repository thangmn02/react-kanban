import { expect, it } from 'vitest';
import { mergeMusicSessions } from './mergeMusicSessions';

it('keeps the newest playback observation without retaining vanished sessions or old metadata', () => {
  const session = { id: 'one', title: 'Old title', artist: '', source: 'youtube.com', paused: true,
    playing: false, currentTime: 80, playbackRate: 1, sampledAt: 200 };
  const discovery = { ...session, title: 'New title', paused: false, playing: true, currentTime: 79, sampledAt: 100 };
  expect(mergeMusicSessions([session], [discovery])).toEqual([{ ...session, title: 'New title' }]);
  expect(mergeMusicSessions([session], [{ ...discovery, sampledAt: 300 }])).toEqual([{ ...discovery, sampledAt: 300 }]);
  expect(mergeMusicSessions([session], [])).toEqual([]);
});

it('does not carry a previous song clock into a new asset on the same player', () => {
  const old = { id: 'one', title: 'Old', artist: '', source: 'open.spotify.com', paused: false,
    playing: true, currentTime: 360, sampledAt: 200, asset: { provider: 'spotify' as const, id: '0123456789012345678901' } };
  const next = { ...old, title: 'New', asset: { ...old.asset, id: '1123456789012345678901' }, currentTime: 17, duration: 165, sampledAt: 100 };
  expect(mergeMusicSessions([old], [next])).toEqual([next]);
});

it('retains the complete newest playback lifecycle over stale discovery', () => {
  const latest = { id: 'one', title: 'Song', artist: '', source: 'youtube.com', paused: false,
    playing: false, currentTime: 17, sampledAt: 200, muted: true, buffering: true, seeking: true, generation: 2 };
  const stale = { ...latest, sampledAt: 100, muted: false, buffering: false, seeking: false, generation: 1 };
  expect(mergeMusicSessions([latest], [stale])[0]).toMatchObject(latest);
});
