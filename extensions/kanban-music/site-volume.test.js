import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { controlMedia, readMedia } from './media.js';

const at = async (url, html) => {
  vi.stubGlobal('location', new URL(url)); document.body.innerHTML = html;
  const media = document.querySelector('video,audio') || document.body.appendChild(document.createElement('audio'));
  Object.defineProperties(media, { currentSrc: { value: 'blob:song' }, readyState: { value: 4 }, duration: { value: 120 }, seekable: { value: { length: 1, start: () => 0, end: () => 120 } } });
  globalThis.__kanbanMusicMedia?.dispose(); vi.resetModules();
  await import('./media-observer.js');
  const read = () => readMedia().find(item => item.src === 'blob:song');
  return { media, read, set: value => controlMedia(read().index, 'blob:song', 'media.volume', value) };
};
beforeEach(() => { document.body.replaceChildren(); });
afterEach(() => { globalThis.__kanbanMusicMedia?.dispose(); vi.unstubAllGlobals(); });

it('YouTube: shows and sets the player level, and muting keeps it', async () => {
  const page = await at('https://www.youtube.com/watch?v=aqz-KE-bpKQ', '<div id="movie_player"><video></video></div>');
  let level = 80, muted = false;
  Object.assign(document.querySelector('#movie_player'), { getVolume: () => level, setVolume: value => { level = value; }, mute: () => { muted = true; }, unMute: () => { muted = false; } });
  page.media.volume = .5; // loudness normalisation on the element is not the slider
  expect(page.read().volume).toBe(.8);
  await page.set(.35); expect(level).toBe(35); expect(page.read().volume).toBe(.35);
  await page.set(0); expect(muted).toBe(true); expect(level).toBe(35);
  await page.set(.35); expect(muted).toBe(false);
});
it('YouTube Music: follows the slider, not the curved element volume', async () => {
  const page = await at('https://music.youtube.com/watch?v=x', '<ytmusic-player><video></video></ytmusic-player><ytmusic-player-bar><div id="volume-slider"></div></ytmusic-player-bar>');
  const slider = document.querySelector('#volume-slider'); slider.value = 50;
  slider.addEventListener('change', () => { page.media.volume = slider.value === 50 ? .2 : .4; });
  page.media.volume = .2;
  expect(page.read().volume).toBe(.5);
  await page.set(.7); expect(slider.value).toBe(70); expect(page.media.volume).toBe(.4); expect(page.read().volume).toBe(.7);
  await page.set(0); expect(slider.value).toBe(0); expect(page.media.muted).toBe(true);
  await page.set(.7); expect(page.media.muted).toBe(false);
});
it('SoundCloud: drives the slider by its own pointer handling and corrects for its offset', async () => {
  const page = await at('https://soundcloud.com/a/b', '<audio></audio><div class="volume"><div class="volume__sliderWrapper" aria-valuenow="1"><div class="volume__sliderBackground"></div></div></div>');
  const slider = document.querySelector('.volume__sliderWrapper');
  document.querySelector('.volume__sliderBackground').getBoundingClientRect = () => ({ left: 0, width: 4, height: 120, bottom: 120 });
  document.addEventListener('mousemove', event => slider.setAttribute('aria-valuenow', String(Math.min(1, Math.max(0, +((120 - event.clientY) / 120 + .03).toFixed(2))))), { once: false });
  await page.set(.5); expect(page.read().volume).toBeCloseTo(.5, 2);
  await page.set(.25); expect(page.read().volume).toBeCloseTo(.25, 2);
});
it('other sites and missing sliders use the element', async () => {
  const page = await at('https://www.deezer.com/track/1', '<audio></audio>');
  await page.set(.4); expect(page.media.volume).toBe(.4); expect(page.read().volume).toBe(.4);
  const plain = await at('https://www.youtube.com/watch?v=aqz-KE-bpKQ', '<video></video>');
  await plain.set(.3); expect(plain.media.volume).toBe(.3);
});
