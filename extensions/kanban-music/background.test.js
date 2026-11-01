import { afterEach, expect, it, vi } from 'vitest';
import { mediaSites, musicHosts } from './sites.js';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('scans all supported tabs and reports every session with honest per-session mode and no private media source', async () => {
  const tabs = Array.from({ length: 35 }, (_, index) => ({ id: index + 1, url: `https://${musicHosts[index % musicHosts.length]}/song` }));
  const listener = { addListener: vi.fn() };
  const api = {
    runtime: { id: 'companion', onMessage: listener, getURL: (path) => `chrome-extension://companion/${path}`, openOptionsPage: vi.fn().mockResolvedValue() },
    storage: { session: { set: vi.fn().mockResolvedValue(), get: vi.fn().mockResolvedValue({}) },
      local: { get: vi.fn().mockResolvedValue({}) }, onChanged: { addListener: vi.fn() } },
    tabs: { query: vi.fn().mockResolvedValue(tabs), onRemoved: { addListener: vi.fn() }, onUpdated: { addListener: vi.fn() } },
    action: { onClicked: { addListener: vi.fn() } },
    scripting: { executeScript: vi.fn(async ({ target, files }) => files ? [] : [{ documentId: `doc-${target.tabId}`, result: [{
      index: 0, src: 'blob:private-source', title: `Song ${target.tabId}`, artist: 'Artist', source: new URL(tabs[target.tabId - 1].url).hostname,
      playing: true, paused: false, currentTime: 15, playbackRate: 1, sampledAt: 100,
    }] }]) },
  };
  vi.stubGlobal('chrome', api);
  await import('./background.js');
  expect(api.storage.local.get).toHaveBeenCalledWith('beatTelemetryEnabled');
  expect(globalThis.__koraBeatTelemetry.enabled).toBe(false);
  api.storage.onChanged.addListener.mock.calls[0][0]({ beatTelemetryEnabled: { newValue: true } }, 'local');
  expect(globalThis.__koraBeatTelemetry.enabled).toBe(true);
  api.storage.onChanged.addListener.mock.calls[0][0]({ beatTelemetryEnabled: { newValue: false } }, 'local');
  const result = await new Promise((resolve) => listener.addListener.mock.calls[0][0](
    { protocol: 'kanban-music-v1', action: 'sessions.get' },
    { id: api.runtime.id, url: 'http://localhost:5173/home', tab: { id: 90 }, documentId: 'app-doc' }, resolve,
  ));
  expect(api.tabs.query).toHaveBeenCalledWith({ url: mediaSites });
  expect(api.scripting.executeScript).toHaveBeenCalledTimes(35);
  expect(result.ok).toBe(true);
  expect(result.sessions).toHaveLength(35);
  expect(result.sessions.every(session => session.learnedPercussion === false)).toBe(true);
  expect(result.sessions.every((session) => !('src' in session) && !('tabId' in session) && !('documentId' in session))).toBe(true);
  expect(result.sessions.find((session) => session.source === 'music.apple.com').syncState).toEqual({ mode: 'clock', reason: 'not-selected' });
  expect(result.sessions.find((session) => session.source === 'open.spotify.com').syncState).toEqual({ mode: 'clock', reason: 'not-selected' });
  expect(result.sessions.find((session) => session.source === 'music.youtube.com').syncState).toEqual({ mode: 'clock', reason: 'not-selected' });
  const request = (sender) => new Promise((resolve) => listener.addListener.mock.calls[0][0](
    { protocol: 'kanban-music-v1', action: 'diagnostics.get' }, sender, resolve,
  ));
  expect(await request({ id: api.runtime.id, url: 'http://localhost:5173/home' })).toMatchObject({ ok: true });
  expect(await request({ id: api.runtime.id, url: 'https://evil.example/' })).toEqual({ ok: false, error: 'unavailable' });
  expect(await request({ id: 'other-extension', url: api.runtime.getURL('setup.html') })).toEqual({ ok: false, error: 'unavailable' });
  expect(await request({ id: api.runtime.id, url: api.runtime.getURL('setup.html') })).toMatchObject({ ok: true, tabs: expect.any(Array) });
});

it('installs observation only in a tab that lacks it, then reads that tab once per scan', async () => {
  const tabs = [{ id: 1, url: 'https://www.youtube.com/watch' }, { id: 2, url: 'https://music.youtube.com/' }];
  const listener = { addListener: vi.fn() }, installed = new Set([1]);
  const api = {
    runtime: { id: 'companion', onMessage: listener, getURL: (path) => `chrome-extension://companion/${path}`, openOptionsPage: vi.fn().mockResolvedValue() },
    storage: { session: { set: vi.fn().mockResolvedValue(), get: vi.fn().mockResolvedValue({}) },
      local: { get: vi.fn().mockResolvedValue({}) }, onChanged: { addListener: vi.fn() } },
    tabs: { query: vi.fn().mockResolvedValue(tabs), onRemoved: { addListener: vi.fn() }, onUpdated: { addListener: vi.fn() } },
    action: { onClicked: { addListener: vi.fn() } },
    scripting: { executeScript: vi.fn(async ({ target, files, args }) => {
      if (files) { installed.add(target.tabId); return []; }
      if (args?.[0] === '') return [{ documentId: `doc-${target.tabId}`, result: true }];
      return [{ documentId: `doc-${target.tabId}`, result: args?.[0] === true && !installed.has(target.tabId) ? null : [] }];
    }) },
  };
  vi.stubGlobal('chrome', api);
  await import('./background.js');
  const scan = () => new Promise((resolve) => listener.addListener.mock.calls[0][0]({ protocol: 'kanban-music-v1', action: 'sessions.get' },
    { id: api.runtime.id, url: 'http://localhost:5173/home', tab: { id: 90 }, documentId: 'app-doc' }, resolve));
  await scan();
  const injected = api.scripting.executeScript.mock.calls.filter(([call]) => call.files).map(([call]) => call.target.tabId);
  expect(injected).toEqual([2]);
  expect(api.scripting.executeScript).toHaveBeenCalledTimes(5);
  api.scripting.executeScript.mockClear();
  await scan();
  expect(api.scripting.executeScript).toHaveBeenCalledTimes(2);
});
