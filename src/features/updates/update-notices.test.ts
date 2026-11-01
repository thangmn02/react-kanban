import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { checkWebDeploy, dismissNotice, noticeDismissed, olderThan } from './update-notices';

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

it('compares Companion versions numerically and ignores anything malformed', () => {
  expect(olderThan('0.3.34', '0.3.36')).toBe(true);
  expect(olderThan('0.3.9', '0.3.10')).toBe(true);
  expect(olderThan('0.3.36', '0.3.36')).toBe(false);
  expect(olderThan('0.4.0', '0.3.36')).toBe(false);
  expect(olderThan(undefined, '0.3.36')).toBe(false);
  expect(olderThan('0.1.0', '')).toBe(false);
  expect(olderThan('next', '0.3.36')).toBe(false);
});

it('hides only the version that was put off', () => {
  expect(noticeDismissed('app:0.1.44')).toBe(false);
  dismissNotice('app:0.1.44');
  expect(noticeDismissed('app:0.1.44')).toBe(true);
  expect(noticeDismissed('app:0.1.45')).toBe(false);
  for (let index = 0; index < 20; index++) dismissNotice(`companion:0.3.${index}`);
  expect(JSON.parse(localStorage.getItem('kora.updateNotice.dismissed.v1')!)).toHaveLength(10);
});

it('reports a newer web deploy, never the build this tab runs', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'test-build' }) });
  await expect(checkWebDeploy()).resolves.toBeUndefined();
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'newer-build' }) });
  await expect(checkWebDeploy()).resolves.toBe('newer-build');
  fetch.mockResolvedValueOnce({ ok: false });
  await expect(checkWebDeploy()).resolves.toBeUndefined();
  expect(fetch).toHaveBeenCalledWith('/build.json', { cache: 'no-store' });
});
