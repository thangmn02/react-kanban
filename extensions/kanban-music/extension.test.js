import { afterEach, expect, it, vi } from 'vitest';
import { allowedRequest } from './protocol.js';
import { controlMedia, readMedia } from './media.js';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
it('allows only exact app origins and known commands', () => {
  const message = { protocol: 'kanban-music-v1', action: 'sessions.get' };
  expect(allowedRequest(message, { url: 'https://kanthangboard.netlify.app/home' })).toBe(true);
  expect(allowedRequest(message, { url: 'https://evil.netlify.app/' })).toBe(false);
  expect(allowedRequest(message, { url: 'https://kanthangboard.netlify.app.evil.com/' })).toBe(false);
  expect(allowedRequest(message, { url: 'http://localhost:9999/' })).toBe(false);
  expect(allowedRequest({ ...message, action: 'execute' }, { url: 'http://localhost:5173/' })).toBe(false);
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
