import { beforeEach, expect, it, vi } from 'vitest';
import { requestNativeMusic } from './nativeMusic';
import { invoke } from '@tauri-apps/api/core';

const feed = vi.hoisted(() => ({ activate: vi.fn(), stop: vi.fn(), companion: vi.fn(), ended: vi.fn() }));
vi.mock('./nativeAudio', () => ({ createNativeAudioFeed: () => feed }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue({ ok: true }) }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(invoke).mockResolvedValue({ ok: true }); });

it('requests clock-only Companion transport and activates native PCM across platforms and browsers', async () => {
  for (const sessionId of ['chrome:youtube', 'chrome:spotify', 'brave:spotify', 'edge:youtube']) {
    await requestNativeMusic('dock.beat.sync.start', sessionId, sessionId);
    expect(invoke).toHaveBeenLastCalledWith('native_music_request', expect.objectContaining({ sessionId, nativeAudio: true }));
    expect(feed.activate).toHaveBeenLastCalledWith(sessionId, sessionId);
  }
});
it('cannot activate a late start after a newer source takes ownership or stop cancels it', async () => {
  let complete!: (value: Record<string, unknown>) => void;
  vi.mocked(invoke).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const old = requestNativeMusic('dock.beat.sync.start', 'youtube', 'old');
  await vi.waitFor(() => expect(complete).toBeTypeOf('function'));
  await requestNativeMusic('dock.beat.sync.start', 'spotify', 'new');
  complete({ ok: true }); await old;
  expect(feed.activate.mock.calls).toEqual([['spotify', 'new']]);
  vi.mocked(invoke).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const stopped = requestNativeMusic('dock.beat.sync.start', 'youtube', 'cancelled');
  await Promise.resolve();
  await requestNativeMusic('dock.beat.sync.stop', 'youtube', 'cancelled');
  complete({ ok: true }); await stopped;
  expect(feed.activate.mock.calls).toEqual([['spotify', 'new']]);
});
