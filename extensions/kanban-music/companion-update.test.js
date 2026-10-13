import { expect, it, vi } from 'vitest';
import { companionUpdate, validCompanionUpdate } from './companion-update.js';
const api = { runtime: { getManifest: () => ({ version: '0.3.22' }), getURL: path => `chrome-extension://abcdefghijklmnopabcdefghijklmnop/${path}` } };
const manifest = { manifest_version: 3, name: 'Kora Music Companion', version: '0.3.23' };
it('reports the loaded version rather than claiming files on disk are already active', async () => {
  const fetcher = vi.fn();
  expect(await companionUpdate(api, { action: 'companion.status' }, fetcher)).toEqual({ ok: true, version: '0.3.22' });
  expect(fetcher).not.toHaveBeenCalled();
});
it('allows reload only when its own on-disk package has the requested version and identity', async () => {
  const request = { action: 'companion.reload', expectedVersion: '0.3.23' };
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => manifest });
  expect(await companionUpdate(api, request, fetcher)).toEqual({ ok: true, version: '0.3.23' });
  expect(fetcher).toHaveBeenCalledWith(api.runtime.getURL('manifest.json'), expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }));
  for (const invalid of [{ ...manifest, version: '0.3.16' }, { ...manifest, name: 'Other extension' }, { ...manifest, manifest_version: 2 }]) {
    expect(await companionUpdate(api, request, async () => ({ ok: true, json: async () => invalid }))).toEqual({ ok: false, error: 'update-version-mismatch' });
  }
});
it('rejects malformed versions and missing/unreadable package files', async () => {
  for (const version of [undefined, '', '../manifest.json', '1.2.3.4.5', '65536', '1.x']) {
    expect(validCompanionUpdate({ action: 'companion.reload', expectedVersion: version })).toBe(false);
  }
  expect(validCompanionUpdate({ action: 'system.reload', expectedVersion: '0.3.23' })).toBe(false);
  const request = { action: 'companion.reload', expectedVersion: '0.3.23' };
  expect(await companionUpdate(api, request, async () => ({ ok: false }))).toEqual({ ok: false, error: 'update-files-missing' });
  expect(await companionUpdate(api, request, async () => { throw Error('missing'); })).toEqual({ ok: false, error: 'update-files-missing' });
});
