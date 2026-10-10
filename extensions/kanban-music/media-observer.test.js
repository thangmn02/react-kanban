import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readMedia, controlMedia } from './media.js';

let nativePlay;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  nativePlay = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.stubGlobal('navigator', { mediaSession: { metadata: { title: 'Detached track', artist: 'Artist' } } });
  await import('./media-observer.js');
});
afterEach(() => {
  globalThis.__kanbanMusicClock?.dispose();
  delete globalThis.__kanbanMusicClock;
  globalThis.__kanbanMusicMedia?.dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const ready = (media, src = 'blob:detached-track') => {
  for (const [key, value] of Object.entries({ currentSrc: src, readyState: 4, currentTime: 12,
    playbackRate: 1, paused: false, seeking: false, ended: false, muted: false, volume: 1 })) {
    Object.defineProperty(media, key, { configurable: true, writable: true, value });
  }
  return media;
};

it('exposes only a connected content-addressed first-party test player as a development URL candidate', () => {
  const src = `https://private-test.example/kora-lead-test/${'a'.repeat(64)}.wav`;
  const media = ready(new Audio(), src);
  document.body.append(media);
  expect(readMedia()[0].assetUrl).toBe(src);
  media.remove();
  expect(readMedia()[0].assetUrl).toBeUndefined();
});

it('identifies the playing Spotify asset instead of the page being browsed', () => {
  ready(new Audio());
  document.body.innerHTML = '<a data-testid="nowplaying-track-link" href="https://open.spotify.com/track/0123456789012345678901">Playing</a>';
  expect(readMedia()[0].assetUrl).toBe('https://open.spotify.com/track/0123456789012345678901');
  document.body.replaceChildren();
  expect(readMedia()[0].assetUrl).toBeUndefined();
});

it('identifies the canonical YouTube player without assigning its asset to retained previews or advertisements', () => {
  vi.stubGlobal('location', { hostname: 'www.youtube.com', href: 'https://www.youtube.com/watch?v=abcdefghijk' });
  document.body.innerHTML = '<div id="movie_player"><video></video></div><video id="preview"></video>';
  const main = ready(document.querySelector('#movie_player video'), 'blob:main');
  ready(document.querySelector('#preview'), 'blob:preview');
  ready(new Audio(), 'blob:detached');
  const sessions = readMedia();
  expect(sessions.find(s => s.src === main.currentSrc).assetUrl).toBe(location.href);
  expect(sessions.filter(s => s.src !== main.currentSrc).every(s => s.assetUrl === undefined)).toBe(true);
  document.querySelector('#movie_player').classList.add('ad-showing');
  expect(readMedia().every(s => s.assetUrl === undefined)).toBe(true);
});

it('discovers new Audio() outside the DOM with metadata and controls that same object', async () => {
  const media = ready(new Audio());
  expect(media).toBeInstanceOf(HTMLAudioElement);
  expect(document.querySelectorAll('audio,video')).toHaveLength(0);
  const session = readMedia()[0];
  expect(session).toMatchObject({ title: 'Detached track', playing: true, currentTime: 12, observed: true });
  const pause = vi.spyOn(media, 'pause').mockImplementation(() => { media.paused = true; });
  await controlMedia(session.index, session.src, 'media.pause');
  expect(pause).toHaveBeenCalledOnce();
  await controlMedia(session.index, session.src, 'media.play');
  expect(nativePlay).toHaveBeenCalledOnce();
  media.currentSrc = 'blob:next-track';
  await expect(controlMedia(session.index, session.src, 'media.play')).rejects.toThrow('Track changed');
});

it('observes detached createElement players when play is called, preserving the native promise', async () => {
  const media = ready(document.createElement('audio'));
  const promise = Promise.resolve();
  nativePlay.mockReturnValueOnce(promise);
  expect(media.play()).toBe(promise);
  expect(readMedia()).toEqual([expect.objectContaining({ playing: true, observed: true })]);
});

it('keeps indices stable across DOM changes and repeated installation without wrapping twice', async () => {
  const detached = ready(new Audio());
  const dom = ready(document.createElement('video'), 'blob:video');
  document.body.append(dom);
  const ids = readMedia().map((session) => session.index);
  document.body.prepend(detached);
  expect(readMedia().map((session) => session.index)).toEqual(ids);
  const wrappedPlay = HTMLMediaElement.prototype.play;
  vi.resetModules();
  await import('./media-observer.js');
  expect(HTMLMediaElement.prototype.play).toBe(wrappedPlay);
  expect(readMedia()).toHaveLength(2);
  detached.ended = true;
  expect(readMedia()).toEqual([expect.objectContaining({ src: 'blob:video' })]);
});

it('relays a detached player clock, pause/resume and seek through the isolated watcher', async () => {
  const media = ready(new Audio());
  const session = readMedia()[0];
  let receive;
  const send = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('chrome', { runtime: { id: 'companion', sendMessage: send,
    onMessage: { addListener: (fn) => { receive = fn; }, removeListener: vi.fn() } } });
  await import('./clock.js');
  const reply = vi.fn();
  const command = (message) => receive({ target: 'beat-clock', ...message }, { id: 'companion' }, reply);
  command({ kind: 'watch', observed: true, index: session.index, src: session.src, token: 'selected' });
  expect(reply).toHaveBeenLastCalledWith({ ok: true });
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ valid: true, clock: expect.objectContaining({ playing: true, currentTime: 12 }) }));
  media.paused = true;
  media.dispatchEvent(new Event('pause'));
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ clock: expect.objectContaining({ playing: false, paused: true }) }));
  media.paused = false;
  media.seeking = true;
  media.currentTime += .05;
  media.dispatchEvent(new Event('seeking'));
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ clock: expect.objectContaining({ generation: 1, seeking: true, playing: false }) }));
  media.seeking = false;
  media.currentTime = 45;
  media.dispatchEvent(new Event('seeked'));
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ clock: expect.objectContaining({ playing: true, currentTime: 45 }) }));
  media.dispatchEvent(new Event('waiting'));
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ clock: expect.objectContaining({ buffering: true, playing: false, paused: false }) }));
  media.dispatchEvent(new Event('playing'));
  await vi.advanceTimersByTimeAsync(5000);
  command({ kind: 'lease', token: 'selected' });
  await vi.advanceTimersByTimeAsync(2000);
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ valid: true }));
  media.currentSrc = 'blob:changed';
  await vi.advanceTimersByTimeAsync(100);
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ valid: false }));
  expect(vi.getTimerCount()).toBe(0);
});

it('expires abandoned observation and ignores malformed/wrong-token samples', async () => {
  const media = ready(new Audio());
  const session = readMedia()[0];
  let receive;
  const send = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('chrome', { runtime: { id: 'companion', sendMessage: send,
    onMessage: { addListener: (fn) => { receive = fn; }, removeListener: vi.fn() } } });
  await import('./clock.js');
  receive({ target: 'beat-clock', kind: 'watch', observed: true, index: session.index, src: session.src, token: 'one' }, { id: 'companion' }, vi.fn());
  send.mockClear();
  for (const detail of ['invalid', JSON.stringify({ token: 'other', valid: true }), 'x'.repeat(5000)]) {
    document.dispatchEvent(new CustomEvent('kanban-music-media-clock', { detail }));
  }
  expect(send).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(7100);
  expect(vi.getTimerCount()).toBe(0);
  send.mockClear();
  media.dispatchEvent(new Event('playing'));
  expect(send).not.toHaveBeenCalled();
});
