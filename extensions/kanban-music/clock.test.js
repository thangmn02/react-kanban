import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { controlMedia } from './media.js';

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
  if (globalThis.__kanbanMusicMedia?.controlListener) document.removeEventListener('kanban-music-control', globalThis.__kanbanMusicMedia.controlListener);
  delete globalThis.__kanbanMusicMedia;
  globalThis.__kanbanMusicClock?.dispose();
  delete globalThis.__kanbanMusicClock;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('executes content-script commands against the selected real media element and rejects a changed source', async () => {
  globalThis.__kanbanMusicMedia = { entries: () => [{ index: 0, media: video }] };
  await controlMedia(0, '', 'install');
  const sendControl = (action, value, src = video.currentSrc) => new Promise(resolve => {
    receive({ target: 'media-control', index: 0, src, action, value }, { id: 'companion' }, resolve);
  });
  expect(await sendControl('media.volume', .25)).toEqual({ ok: true });
  expect(video.volume).toBe(.25);
  expect(await sendControl('media.volume', .8, 'changed-source')).toEqual({ ok: false });
  expect(video.volume).toBe(.25);
  expect(await sendControl('media.volume', 2)).toEqual({ ok: false });
  Object.defineProperty(video, 'duration', { configurable: true, value: 180 });
  Object.defineProperty(video, 'seekable', { configurable: true, value: { length: 1, start: () => 0, end: () => 180 } });
  expect(await sendControl('media.seek', 50)).toEqual({ ok: true });
  expect(video.currentTime).toBe(50);
  video.play = vi.fn().mockResolvedValue(undefined); video.pause = vi.fn();
  expect(await sendControl('media.play')).toEqual({ ok: true });
  expect(await sendControl('media.pause')).toEqual({ ok: true });
  expect(video.play).toHaveBeenCalledOnce(); expect(video.pause).toHaveBeenCalledOnce();
  const next = document.createElement('button'); next.className = 'ytp-next-button';
  next.getClientRects = () => [{ width: 32, height: 32 }];
  document.body.append(next); const click = vi.fn(); next.addEventListener('click', click);
  expect(await sendControl('media.next')).toEqual({ ok: true });
  expect(click).toHaveBeenCalledOnce();
});
const command = (message) => {
  const reply = vi.fn();
  receive({ target: 'beat-clock', ...message }, { id: 'companion' }, reply);
  return reply;
};

it('marks small seeks explicitly and reports buffering independently of paused state', () => {
  command({ kind: 'watch', index: 0, token: 'one' });
  video.currentTime += .05; video.seeking = true; video.dispatchEvent(new Event('seeking'));
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ clock: expect.objectContaining({ generation: 1, seeking: true, playing: false }) }));
  video.seeking = false; video.dispatchEvent(new Event('seeked'));
  video.dispatchEvent(new Event('waiting'));
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ clock: expect.objectContaining({ buffering: true, paused: false, playing: false }) }));
  video.playbackRate = 2; video.dispatchEvent(new Event('playing'));
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ clock: expect.objectContaining({ buffering: false, playing: true, playbackRate: 2 }) }));
});

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
