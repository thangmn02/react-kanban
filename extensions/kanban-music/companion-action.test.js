import { expect, it, vi } from 'vitest';
import { createCompanionAction, isMusicTab } from './companion-action.js';

function fixture(initial = {}, tabs = []) {
  const stored = { ...initial };
  const api = {
    storage: { local: { get: vi.fn(async () => ({ ...stored })) }, session: { get: vi.fn(async () => ({ ...stored })), set: vi.fn(async value => Object.assign(stored, value)) } },
    tabs: { query: vi.fn().mockResolvedValue(tabs), update: vi.fn(async id => ({ id, windowId: 4 })), create: vi.fn().mockResolvedValue({ id: 30 }) },
    windows: { update: vi.fn().mockResolvedValue({}) },
    runtime: { openOptionsPage: vi.fn().mockResolvedValue() },
  };
  const beats = { invoke: vi.fn() };
  return { api, beats, stored, action: createCompanionAction(api, beats) };
}
const music = { id: 12, url: 'https://www.youtube.com/watch?v=song' };
it('allows an explicit toolbar invocation only on the scoped first-party test origin', async () => {
  const asset = { provider: 'kora-development', id: 'a'.repeat(64) };
  const f = fixture({ leadAudioTestScope: { asset, sourceUrl: `https://private-test.example/kora-lead-test/${asset.id}.wav`, expiresAt: Date.now() + 60000 } });
  await f.action.invoke({ id: 15, url: 'https://private-test.example/index.html' });
  expect(f.beats.invoke).toHaveBeenCalledWith(15);
  await f.action.invoke({ id: 16, url: 'https://another.example/index.html' });
  expect(f.beats.invoke).toHaveBeenCalledTimes(1);
  expect(f.api.runtime.openOptionsPage).toHaveBeenCalledOnce();
});
it('accepts supported music tabs but rejects lookalike domains and arbitrary URLs', () => {
  expect(isMusicTab(music)).toBe(true);
  expect(isMusicTab({ ...music, url: 'https://m.soundcloud.com/track' })).toBe(true);
  expect(isMusicTab({ ...music, url: 'https://open.spotify.com/track/one' })).toBe(true);
  expect(isMusicTab({ ...music, url: 'https://youtube.com.evil.test/' })).toBe(false);
  expect(isMusicTab({ ...music, url: 'http://localhost:9999/' })).toBe(false);
  expect(isMusicTab({ ...music, id: undefined })).toBe(false);
});
it('invokes before the app is open, remembers the music tab, and opens Kanban once', async () => {
  const f = fixture();
  const first = f.action.invoke(music);
  const second = f.action.invoke(music);
  expect(f.beats.invoke).toHaveBeenCalledWith(12);
  await Promise.all([first, second]);
  expect(f.stored.preferredMusicTab).toBe(12);
  expect(f.api.tabs.create).toHaveBeenCalledExactlyOnceWith({ url: 'https://kanthangboard.netlify.app' });
});
it('reuses and focuses the remembered app tab without duplicates or navigation', async () => {
  const tabs = [{ id: 24, url: 'http://localhost:5173/today' }, { id: 25, url: 'https://kanthangboard.netlify.app/home' }];
  const f = fixture({}, tabs);
  await f.action.rememberApp({ url: tabs[0].url, tab: { id: 24 } });
  await f.action.invoke(music);
  expect(f.api.tabs.update).toHaveBeenCalledExactlyOnceWith(24, { active: true });
  expect(f.api.windows.update).toHaveBeenCalledWith(4, { focused: true });
  expect(f.api.tabs.create).not.toHaveBeenCalled();
});
it('remembers only allowlisted app origins and never opens a stored untrusted URL', async () => {
  const f = fixture({ lastApp: { origin: 'https://evil.test', tabId: 24 } }, [{ id: 24, url: 'https://evil.test/' }]);
  await f.action.rememberApp({ url: 'https://evil.test', tab: { id: 24 } });
  expect(f.api.storage.session.set).not.toHaveBeenCalled();
  await f.action.invoke(music);
  expect(f.api.tabs.create).toHaveBeenCalledWith({ url: 'https://kanthangboard.netlify.app' });
});
it('opens the last trusted local app when closed and survives service worker recreation', async () => {
  const f = fixture({ lastApp: { origin: 'http://localhost:5174', tabId: 24 } });
  await createCompanionAction(f.api, f.beats).invoke(music);
  expect(f.api.tabs.create).toHaveBeenCalledWith({ url: 'http://localhost:5174' });
});
it('prefers the clicked music tab, opens a selected music tab, and does not claim capture is live', async () => {
  const f = fixture({ preferredMusicTab: 12 });
  expect(await f.action.prefer([{ tabId: 13 }, { tabId: 12 }])).toEqual([{ tabId: 12 }, { tabId: 13 }]);
  await f.action.openMusic({ tabId: 12 });
  expect(f.api.tabs.update).toHaveBeenCalledWith(12, { active: true });
  expect(f.beats.invoke).not.toHaveBeenCalled();
  await f.action.invoke({ id: 10, url: 'https://other.example' });
  expect(f.api.runtime.openOptionsPage).toHaveBeenCalledOnce();
  expect(f.api.tabs.create).not.toHaveBeenCalled();
});
it('publishes a fresh selection token for each explicit click, not a persistent permission flag', async () => {
  const f = fixture();
  await f.action.invoke(music);
  const first = f.stored.musicSelectionToken;
  expect(await f.action.prefer([{ tabId: 13 }, { tabId: 12 }])).toEqual([{ tabId: 12, selectionToken: first }, { tabId: 13 }]);
  await f.action.invoke(music);
  expect(f.stored.musicSelectionToken).not.toBe(first);
});
