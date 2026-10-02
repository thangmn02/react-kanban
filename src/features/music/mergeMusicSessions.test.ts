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
