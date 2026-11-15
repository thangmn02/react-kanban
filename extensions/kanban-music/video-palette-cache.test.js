import { expect, it } from 'vitest';
import { createVideoPaletteCache, VIDEO_PALETTE_KEY } from './video-palette-cache.js';

const storage = (initial = {}) => { let data = initial; return { get: async () => data, set: async value => { data = { ...data, ...value }; }, read: () => data }; };
const bins = Array.from({ length: 36 }, (_, index) => index === 3 ? 2 : 0);
const video = id => ({ provider: 'youtube', id });

it('keeps a finished palette per video and survives a restart, so a seen video is not sampled again', async () => {
  const store = storage(), cache = createVideoPaletteCache(store);
  await cache.load();
  expect(cache.has(video('a'))).toBe(false);
  expect(cache.set(video('a'), { bins, pixels: 512, done: true })).toBe(true);
  expect(cache.get(video('a'))).toEqual({ bins, pixels: 512 });
  await Promise.resolve(); await Promise.resolve();
  const again = createVideoPaletteCache(storage(store.read()));
  await again.load();
  expect(again.has(video('a'))).toBe(true);
  expect(Object.keys(store.read()[VIDEO_PALETTE_KEY])).toEqual(['youtube:a']);
});

it('drops the least recently used video past the limit and ignores damaged entries', async () => {
  const cache = createVideoPaletteCache(storage({ [VIDEO_PALETTE_KEY]: { 'youtube:bad': { bins: [1] } } }), { limit: 2 });
  await cache.load();
  expect(cache.has(video('bad'))).toBe(false);
  cache.set(video('a'), { bins, pixels: 256 }); cache.set(video('b'), { bins, pixels: 256 });
  cache.touch(video('a'));
  cache.set(video('c'), { bins, pixels: 256 });
  expect([cache.has(video('a')), cache.has(video('b')), cache.has(video('c'))]).toEqual([true, false, true]);
  expect(cache.set(undefined, { bins, pixels: 256 })).toBe(false);
  expect(cache.set(video('d'), { bins: [1], pixels: 256 })).toBe(false);
});
