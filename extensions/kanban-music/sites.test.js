// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { isMusicUrl, mediaSites, musicHosts } from './sites.js';

it('keeps registration, host permissions and discovery on the same explicit host list', () => {
  const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'));
  const script = manifest.content_scripts.find((entry) => entry.js.includes('clock.js'));
  expect(script.matches).toEqual(mediaSites);
  expect(manifest.content_scripts.find((entry) => entry.js.includes('media-observer.js'))).toMatchObject({ matches: mediaSites, world: 'MAIN', run_at: 'document_start' });
  expect(manifest.host_permissions).toEqual(['https://kanthangboard.netlify.app/*', 'https://koraspace.online/*', ...mediaSites]);
  expect(JSON.stringify(manifest)).not.toContain('<all_urls>');
  expect(mediaSites.every((pattern) => !pattern.includes('://*'))).toBe(true);
  expect(musicHosts).toEqual(expect.arrayContaining(['youtube.com', 'music.youtube.com', 'soundcloud.com', 'open.spotify.com', 'music.apple.com', 'deezer.com', 'tidal.com', 'listen.tidal.com']));
});

it.each(musicHosts)('allows generic detection on %s but not lookalikes', (host) => {
  expect(isMusicUrl(`https://${host}/track`)).toBe(true);
  expect(isMusicUrl(`https://${host}.evil.test/track`)).toBe(false);
  expect(isMusicUrl(`http://${host}/track`)).toBe(false);
});
