import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let receive;
let send;
let video;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  send = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('chrome', { runtime: { id: 'companion', sendMessage: send,
    onMessage: { addListener: (listener) => { receive = listener; }, removeListener: vi.fn() } } });
  video = document.createElement('video');
  for (const [key, value] of Object.entries({ currentSrc: 'https://media.example/track', currentTime: 12,
    playbackRate: 1, paused: false, seeking: false, readyState: 4, ended: false, muted: false, volume: 1 })) {
    Object.defineProperty(video, key, { configurable: true, writable: true, value });
  }
  document.body.append(video);
  await import('./clock.js');
});
afterEach(() => {
  globalThis.__kanbanMusicClock?.dispose();
  delete globalThis.__kanbanMusicClock;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const command = (message) => {
  const reply = vi.fn();
  receive({ target: 'beat-clock', ...message }, { id: 'companion' }, reply);
  return reply;
};

it('reports the actual media clock, pauses immediately, and follows seeks', () => {
  command({ kind: 'watch', index: 0, token: 'one' });
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ clock: expect.objectContaining({ currentTime: 12, playing: true }) }));
  video.paused = true;
  video.dispatchEvent(new Event('pause'));
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ clock: expect.objectContaining({ paused: true, playing: false }) }));
  video.currentTime = 99;
  video.dispatchEvent(new Event('seeked'));
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ clock: expect.objectContaining({ currentTime: 99 }) }));
});

it('stops after media removal and expires an unrenewed clock lease', async () => {
  command({ kind: 'watch', index: 0, token: 'one' });
  video.remove();
  await vi.advanceTimersByTimeAsync(100);
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ valid: false }));
  expect(vi.getTimerCount()).toBe(0);
  document.body.append(video);
  command({ kind: 'watch', index: 0, token: 'two' });
  expect(command({ kind: 'lease', token: 'wrong' })).toHaveBeenCalledWith({ ok: false });
  await vi.advanceTimersByTimeAsync(6100);
  expect(vi.getTimerCount()).toBe(0);
});

it('does not let a failed old report stop a newer watcher', async () => {
  let reject;
  send.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  command({ kind: 'watch', index: 0, token: 'old' });
  command({ kind: 'watch', index: 0, token: 'new' });
  reject(new Error('Disconnected'));
  await vi.advanceTimersByTimeAsync(100);
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ token: 'new' }));
  expect(command({ kind: 'lease', token: 'new' })).toHaveBeenCalledWith({ ok: true });
});
