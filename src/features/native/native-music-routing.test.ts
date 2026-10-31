import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { requestNativeMusic,prepareNativeSourceAudioDelay,stopNativeSourceAudioDelay } from './nativeMusic';
import { invoke } from '@tauri-apps/api/core';

const feed = vi.hoisted(() => ({ reserve: vi.fn(() => vi.fn()), activate: vi.fn(), stop: vi.fn(), companion: vi.fn(), ended: vi.fn() }));
vi.mock('./nativeAudio', () => ({ createNativeAudioFeed: () => feed }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: vi.fn().mockResolvedValue({ ok: true }) }));
afterEach(async()=>{vi.stubEnv('VITE_ENABLE_SOURCE_AUDIO_DELAY','true');vi.mocked(invoke).mockResolvedValue({ok:true});await stopNativeSourceAudioDelay('candidate:song');vi.unstubAllEnvs();});
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

it('requires the optional build gate and the selected exact release-candidate peer',async()=>{
  await expect(prepareNativeSourceAudioDelay('candidate:song')).rejects.toThrow('unavailable');
  vi.stubEnv('VITE_ENABLE_SOURCE_AUDIO_DELAY','true');
  for(const peer of [{peerId:'candidate',version:'0.3.28',verified:true},{peerId:'foreign',version:'0.3.29',verified:true},{peerId:'candidate',version:'0.3.29',verified:false}]){
    vi.mocked(invoke).mockResolvedValue({ok:true,companions:[peer]});
    await expect(prepareNativeSourceAudioDelay('candidate:song')).rejects.toThrow('0.3.29');
  }
  vi.mocked(invoke).mockResolvedValue({ok:true,companions:[{peerId:'candidate',version:'0.3.29',verified:true}]});
  await expect(prepareNativeSourceAudioDelay('candidate:song')).resolves.toBeUndefined();
});

it('keeps Windows capture as the default and sends exclusive source capture only after explicit opt-in',async()=>{
  vi.stubEnv('VITE_ENABLE_SOURCE_AUDIO_DELAY','true');
  await requestNativeMusic('dock.beat.sync.start','candidate:song','default-route');
  expect(invoke).toHaveBeenLastCalledWith('native_music_request',expect.objectContaining({nativeAudio:true}));
  expect(vi.mocked(invoke).mock.calls.at(-1)?.[1]).not.toHaveProperty('sourceAudioDelay');
  vi.mocked(invoke).mockResolvedValueOnce({ok:true,companions:[{peerId:'candidate',version:'0.3.29',verified:true}]});await prepareNativeSourceAudioDelay('candidate:song');
  vi.clearAllMocks();
  await requestNativeMusic('dock.beat.sync.start','candidate:song','source-route',undefined,undefined,true);
  expect(feed.stop).toHaveBeenCalledWith('candidate:song','default-route');
  expect(feed.activate).not.toHaveBeenCalled();expect(feed.reserve).not.toHaveBeenCalled();
  expect(invoke).toHaveBeenLastCalledWith('native_music_request',expect.objectContaining({nativeAudio:false,companionCapture:true,sourceAudioDelay:true}));
  await stopNativeSourceAudioDelay('candidate:song');
  await requestNativeMusic('dock.beat.sync.start','candidate:song','restored-default');
  expect(feed.activate).toHaveBeenLastCalledWith('candidate:song','restored-default');
});

it('does not confirm a failed source-route stop or let queued stale renewals reactivate it',async()=>{
  vi.stubEnv('VITE_ENABLE_SOURCE_AUDIO_DELAY','true');
  vi.mocked(invoke).mockResolvedValueOnce({ok:true,companions:[{peerId:'candidate',version:'0.3.29',verified:true}]});await prepareNativeSourceAudioDelay('candidate:song');
  await requestNativeMusic('dock.beat.sync.start','candidate:song','retiring-route',undefined,undefined,true);
  let finish!:(value:Record<string,unknown>)=>void;
  vi.mocked(invoke).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const stopping=stopNativeSourceAudioDelay('candidate:song');
  const stopFailure=expect(stopping).rejects.toThrow('not acknowledged');
  await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
  const stale=requestNativeMusic('dock.beat.sync.start','candidate:song','retiring-route',undefined,undefined,true);
  const staleFailure=expect(stale).rejects.toThrow('ended');
  finish({ok:false});await stopFailure;await staleFailure;
  vi.mocked(invoke).mockResolvedValue({ok:true});
  await expect(stopNativeSourceAudioDelay('candidate:song')).resolves.toBeUndefined();
  await requestNativeMusic('dock.beat.sync.start','candidate:song','after-confirmed-stop');
  expect(feed.activate).toHaveBeenLastCalledWith('candidate:song','after-confirmed-stop');
});

it('cancels a prepared route before a queued start can claim ownership',async()=>{
  vi.stubEnv('VITE_ENABLE_SOURCE_AUDIO_DELAY','true');
  vi.mocked(invoke).mockResolvedValueOnce({ok:true,companions:[{peerId:'candidate',version:'0.3.29',verified:true}]});await prepareNativeSourceAudioDelay('candidate:song');vi.clearAllMocks();
  const pending=requestNativeMusic('dock.beat.sync.start','candidate:song','cancel-before-start',undefined,undefined,true);
  const failure=expect(pending).rejects.toThrow('ended');
  await stopNativeSourceAudioDelay('candidate:song');await failure;
  expect(vi.mocked(invoke).mock.calls.some(([,args])=>(args as Record<string,unknown>)?.sourceAudioDelay===true&&(args as Record<string,unknown>).action==='dock.beat.sync.start')).toBe(false);
});

it('stops a previous source even after another selection replaces the current event owner',async()=>{
  vi.stubEnv('VITE_ENABLE_SOURCE_AUDIO_DELAY','true');
  vi.mocked(invoke).mockResolvedValueOnce({ok:true,companions:[{peerId:'candidate',version:'0.3.29',verified:true}]});await prepareNativeSourceAudioDelay('candidate:song');
  await requestNativeMusic('dock.beat.sync.start','candidate:song','old-tab-route',undefined,undefined,true);
  await requestNativeMusic('dock.beat.sync.start','another:source','new-windows-owner');vi.clearAllMocks();
  await stopNativeSourceAudioDelay('candidate:song');
  expect(invoke).toHaveBeenCalledWith('native_music_request',expect.objectContaining({action:'dock.beat.sync.stop',sessionId:'candidate:song',subscriptionId:'old-tab-route',sourceAudioDelay:true}));
});
it('confirms OFF when the source Companion has disconnected, but not while it is still connected',async()=>{
  vi.stubEnv('VITE_ENABLE_SOURCE_AUDIO_DELAY','true');
  vi.mocked(invoke).mockResolvedValueOnce({ok:true,companions:[{peerId:'candidate',version:'0.3.29',verified:true}]});await prepareNativeSourceAudioDelay('candidate:song');
  await requestNativeMusic('dock.beat.sync.start','candidate:song','gone-route',undefined,undefined,true);
  vi.mocked(invoke).mockImplementation(async(_command,args)=>(args as Record<string,unknown>).action==='companion.status'
    ?{ok:true,companions:[{peerId:'candidate',version:'0.3.29',verified:true}]}:Promise.reject(Error('peer timeout')));
  await expect(stopNativeSourceAudioDelay('candidate:song')).rejects.toThrow('peer timeout');
  vi.mocked(invoke).mockImplementation(async(_command,args)=>(args as Record<string,unknown>).action==='companion.status'
    ?{ok:true,companions:[{peerId:'another',version:'0.3.25',verified:true}]}:Promise.reject(Error('Unknown Companion')));
  await expect(stopNativeSourceAudioDelay('candidate:song')).resolves.toBeUndefined();
});
