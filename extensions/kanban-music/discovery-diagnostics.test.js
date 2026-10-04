import { afterEach, expect, it, vi } from 'vitest';
import { diagnoseDiscovery, inspectDiscovery } from './discovery-diagnostics.js';
import { mediaSites } from './sites.js';

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });
it('distinguishes a metadata-only player from no session without returning private fields', () => {
  vi.stubGlobal('navigator', { mediaSession: { metadata: { title: 'Private title', artist: 'Private artist' }, playbackState: 'playing' } });
  expect(inspectDiscovery()).toEqual({ domElements: 0, observedElements: 0, readyElements: 0, playingElements: 0,
    metadataPresent: true, playbackState: 'playing', observerInstalled: false });
  expect(JSON.stringify(inspectDiscovery())).not.toMatch(/Private/);
});
it('reports ready and actually playing media separately, including detached observers', () => {
  const media = document.createElement('audio');
  Object.defineProperties(media, { currentSrc: { value: 'https://secret.test/signed?token=secret' }, readyState: { value: 4 }, paused: { value: true } });
  vi.stubGlobal('__kanbanMusicMedia', { version: 1, entries: () => [{ index: 4, media }] });
  expect(inspectDiscovery()).toMatchObject({ domElements: 0, observedElements: 1, readyElements: 1, playingElements: 0, observerInstalled: true });
  expect(JSON.stringify(inspectDiscovery())).not.toMatch(/secret|token/);
});
it('reports injection failures rather than silently treating a supported tab as empty', async () => {
  const api = { tabs: { query: vi.fn().mockResolvedValue([{ id: 4, url: 'https://soundcloud.com/private-path', audible: true }]) },
    scripting: { executeScript: vi.fn().mockRejectedValue(new TypeError('Cannot access https://secret.test/')) } };
  expect(await diagnoseDiscovery(api, mediaSites)).toEqual([{ host: 'soundcloud.com', audible: true, muted: false, status: 'inspection-failed', errorType: 'TypeError' }]);
  expect(api.tabs.query).toHaveBeenCalledWith({ url: mediaSites });
});
