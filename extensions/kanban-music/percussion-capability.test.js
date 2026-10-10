import { expect, it, vi } from 'vitest';
import { hasLearnedPercussion } from './percussion-capability.js';
const api = { runtime: { getURL: path => `chrome-extension://test/${path}`,
  getManifest: () => ({ content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'" } }) } };
it('advertises only a complete compatible learned model installation', async () => {
  const fetchAsset = vi.fn(async () => ({ ok: true, json: async () => ({ version: 1, bins: 84, sampleRate: 44100 }) }));
  expect(await hasLearnedPercussion(api, fetchAsset)).toBe(true);
  expect(fetchAsset.mock.calls.slice(1).every(([, options]) => options.method === 'HEAD')).toBe(true);
  fetchAsset.mockResolvedValueOnce({ ok: false });
  expect(await hasLearnedPercussion(api, fetchAsset)).toBe(false);
  fetchAsset.mockResolvedValueOnce({ ok: true, json: async () => ({ version: 1, bins: 84, sampleRate: 44100, classifier: 'causal' }) });
  expect(await hasLearnedPercussion(api, fetchAsset)).toBe(false);
});
it('fails closed for missing inference assets or blocked WASM', async () => {
  const fetchAsset = vi.fn(async url => ({ ok: !url.endsWith('.wasm'), json: async () => ({ version: 1, bins: 84, sampleRate: 44100 }) }));
  expect(await hasLearnedPercussion(api, fetchAsset)).toBe(false);
  expect(await hasLearnedPercussion({ runtime: { ...api.runtime, getManifest: () => ({}) } }, fetchAsset)).toBe(false);
  expect(await hasLearnedPercussion(api, async () => { throw Error('Missing'); })).toBe(false);
});
