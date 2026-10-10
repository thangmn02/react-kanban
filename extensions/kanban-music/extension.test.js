import { afterEach, expect, it, vi } from 'vitest';
import { allowedRequest } from './protocol.js';
import { controlMedia, readMedia } from './media.js';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('controls actual seek and volume, and rejects unavailable targets and non-finite inputs', async () => {
  const audio = document.createElement('audio');
  Object.defineProperties(audio, { currentSrc: { value: 'blob:track' }, readyState: { value: 4 }, duration: { value: 120 },
    seekable: { value: { length: 1, start: () => 10, end: () => 120 } } });
  document.body.append(audio);
  expect(readMedia()[0]).toMatchObject({ duration: 120, volume: 1, canSeek: true, canPrevious: false, canNext: false });
  await controlMedia(0, 'blob:track', 'media.seek', 60); expect(audio.currentTime).toBe(60);
  await controlMedia(0, 'blob:track', 'media.volume', 0); expect(audio.volume).toBe(0); expect(audio.muted).toBe(true);
  await controlMedia(0, 'blob:track', 'media.volume', .4); expect(audio.volume).toBe(.4); expect(audio.muted).toBe(false);
  await expect(controlMedia(0, 'blob:track', 'media.seek', 5)).rejects.toThrow('Position unavailable');
  await expect(controlMedia(0, 'blob:track', 'media.volume', NaN)).rejects.toThrow('Invalid volume');
  await expect(controlMedia(0, 'blob:track', 'media.volume', 2)).rejects.toThrow('Invalid volume');
  await expect(controlMedia(0, 'blob:track', 'media.next')).rejects.toThrow('navigation unavailable');
  await expect(controlMedia(0, 'changed', 'media.seek', 60)).rejects.toThrow('Track changed');
});

it('uses enabled player navigation buttons and never pretends a missing button succeeded', async () => {
  const audio = document.createElement('audio'); Object.defineProperty(audio, 'currentSrc', { value: 'blob:song' });
  const next = document.createElement('button'); next.className = 'ytp-next-button';
  vi.spyOn(next, 'getClientRects').mockReturnValue([{}]); const click = vi.fn(); next.addEventListener('click', click);
  document.body.append(audio, next);
  await controlMedia(0, 'blob:song', 'media.next'); expect(click).toHaveBeenCalledOnce();
  next.disabled = true; await expect(controlMedia(0, 'blob:song', 'media.next')).rejects.toThrow('navigation unavailable');
});

it('validates numeric playback commands at the trusted-origin boundary', () => {
  const sender = { url: 'http://localhost:5173/' }, message = { protocol: 'kanban-music-v1', sessionId: 'song' };
  expect(allowedRequest({ ...message, action: 'media.seek', value: 120 }, sender)).toBe(true);
  expect(allowedRequest({ ...message, action: 'media.volume', value: .4 }, sender)).toBe(true);
  for (const value of [undefined, '1', NaN, Infinity, -1]) expect(allowedRequest({ ...message, action: 'media.volume', value }, sender)).toBe(false);
  expect(allowedRequest({ ...message, action: 'media.seek', value: 864001 }, sender)).toBe(false);
});
it('allows only exact app origins and known commands', () => {
  const message = { protocol: 'kanban-music-v1', action: 'sessions.get' };
  expect(allowedRequest(message, { url: 'https://kanthangboard.netlify.app/home' })).toBe(true);
  expect(allowedRequest(message, { url: 'https://koraspace.online/home' })).toBe(true);
  expect(allowedRequest(message, { url: 'https://koraspace.online.evil.com/home' })).toBe(false);
  expect(allowedRequest(message, { url: 'https://evil.netlify.app/' })).toBe(false);
  expect(allowedRequest(message, { url: 'https://kanthangboard.netlify.app.evil.com/' })).toBe(false);
  expect(allowedRequest(message, { url: 'http://localhost:9999/' })).toBe(false);
  expect(allowedRequest({ ...message, action: 'execute' }, { url: 'http://localhost:5173/' })).toBe(false);
  expect(allowedRequest({ ...message, action: 'media.focus', sessionId: 'song' }, { url: 'http://localhost:5173/' })).toBe(true);
  expect(allowedRequest({ ...message, action: 'media.focus', sessionId: 'song' }, { url: 'https://evil.example/' })).toBe(false);
  expect(allowedRequest({ ...message, action: 'instrument.setup', sessionId: 'song' }, { url: 'http://localhost:5173/' })).toBe(false);
  expect(allowedRequest({ ...message, action: 'instrument.setup' }, { url: 'http://localhost:5173/' })).toBe(false);
  expect(allowedRequest({ ...message, action: 'instrument.setup', sessionId: 'song' }, { url: 'https://evil.example/' })).toBe(false);
});

it('detects every ready audio/video element generically and reads Media Session metadata for protected playback too', async () => {
  vi.stubGlobal('navigator', { mediaSession: { metadata: { title: 'Actual song', artist: 'Actual artist' } } });
  const audio = document.createElement('audio');
  const video = document.createElement('video');
  Object.defineProperties(audio, { currentSrc: { value: 'blob:protected-song' }, readyState: { value: 4 }, paused: { value: false }, mediaKeys: { value: {} } });
  Object.defineProperties(video, { currentSrc: { value: 'https://example.com/video' }, readyState: { value: 4 }, paused: { value: true } });
  document.body.append(audio, video, document.createElement('audio'));
  const pause = vi.spyOn(audio, 'pause').mockImplementation(() => {});
  const play = vi.spyOn(audio, 'play').mockResolvedValue();
  expect(readMedia()).toEqual([
    expect.objectContaining({ index: 0, title: 'Actual song', artist: 'Actual artist', playing: true, protectedMedia: true }),
    expect.objectContaining({ index: 1, title: 'Actual song', paused: true, protectedMedia: false }),
  ]);
  await controlMedia(0, 'blob:protected-song', 'media.pause');
  await controlMedia(0, 'blob:protected-song', 'media.play');
  expect(pause).toHaveBeenCalledOnce();
  expect(play).toHaveBeenCalledOnce();
});

it('supports media backed by srcObject and refuses controls after its stream is replaced', async () => {
  const media = document.createElement('audio');
  Object.defineProperties(media, { srcObject: { value: { id: 'stream-one' }, writable: true }, readyState: { value: 4 }, paused: { value: false } });
  document.body.append(media);
  const pause = vi.spyOn(media, 'pause').mockImplementation(() => {});
  expect(readMedia()[0]).toMatchObject({ src: 'stream:stream-one', playing: true });
  await controlMedia(0, 'stream:stream-one', 'media.pause');
  expect(pause).toHaveBeenCalledOnce();
  media.srcObject = { id: 'stream-two' };
  await expect(controlMedia(0, 'stream:stream-one', 'media.play')).rejects.toThrow('Track changed');
});
it('reads metadata and controls the real media element, rejecting a changed source', async () => {
  const media = document.createElement('audio');
  Object.defineProperties(media, { currentSrc: { value: 'https://example.com/track.mp3' }, readyState: { value: 4 }, paused: { value: false } });
  document.body.appendChild(media);
  const pause = vi.spyOn(media, 'pause').mockImplementation(() => {});
  const play = vi.spyOn(media, 'play').mockResolvedValue();
  expect(readMedia()).toEqual([expect.objectContaining({ index: 0, paused: false, src: 'https://example.com/track.mp3' })]);
  await controlMedia(0, media.currentSrc, 'media.pause');
  await controlMedia(0, media.currentSrc, 'media.play');
  expect(pause).toHaveBeenCalledOnce(); expect(play).toHaveBeenCalledOnce();
  await expect(controlMedia(0, 'https://changed.example/track', 'media.play')).rejects.toThrow('Track changed');
});
