import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { requestNativeMusic } from './nativeMusic';
import { invoke } from '@tauri-apps/api/core';

const feed = vi.hoisted(() => ({ reserve: vi.fn(() => vi.fn()), activate: vi.fn(), stop: vi.fn(), companion: vi.fn(), ended: vi.fn() }));
vi.mock('./nativeAudio', () => ({ createNativeAudioFeed: () => feed }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: vi.fn().mockResolvedValue({ ok: true }) }));
afterEach(()=>vi.unstubAllEnvs());
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
it('stops the previous Windows owner and keeps private Companion capture exclusive across renewals',async()=>{
  await requestNativeMusic('dock.beat.sync.start','windows:song','windows-owner');
  vi.clearAllMocks();vi.stubEnv('VITE_PRIVATE_NATIVE_COMPANION_CAPTURE','true');
  await requestNativeMusic('dock.beat.sync.start','private-peer:song','browser-owner');
  await requestNativeMusic('dock.beat.sync.start','private-peer:song','browser-owner');
  expect(feed.stop).toHaveBeenCalledWith('windows:song','windows-owner');
  expect(feed.activate).not.toHaveBeenCalled();expect(feed.reserve).not.toHaveBeenCalled();
  expect(invoke).toHaveBeenLastCalledWith('native_music_request',expect.objectContaining({nativeAudio:false,companionCapture:true,sessionId:'private-peer:song'}));
  const configuration={enabled:true,captureId:'capture',generation:1,compensationMs:250,intentionalDelay:true,authorizedAudio:true,outputHeard:true,preview:true};
  await requestNativeMusic('beat.experimental.configure','private-peer:song',undefined,undefined,configuration);
  expect(invoke).toHaveBeenLastCalledWith('native_music_request',expect.objectContaining({action:'beat.experimental.configure',configuration,companionCapture:true}));
});
