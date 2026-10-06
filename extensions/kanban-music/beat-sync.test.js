import { afterEach, expect, it, vi } from 'vitest';
import { createBeatSync } from './beat-sync.js';
afterEach(() => vi.restoreAllMocks());
it('does not expire a capture while its initial stream setup is still pending', async () => {
  const f = fixture(); let finish;
  f.api.runtime.sendMessage.mockImplementation((message) => message.kind === 'start'
    ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve({ ok: false }));
  await f.sync.start(f.session, f.owner, 'subscription');
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  await f.sync.start(f.session, f.owner, 'subscription');
  expect(f.api.runtime.sendMessage.mock.calls.some(([message]) => message.kind === 'lease' || message.kind === 'stop')).toBe(false);
  finish({ ok: true });
  await vi.waitFor(() => expect(f.sync.status(f.session).reason).toBe('starting'));
  expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledOnce();
  await f.sync.stop();
});
it('reacquires an expired capture under the same live clock owner', async () => {
  const f = fixture();
  await f.sync.start(f.session, f.owner, 'subscription');
  await vi.waitFor(() => expect(f.sync.status(f.session).mode).toBe('capture'));
  const old = f.sync.status(f.session).captureId, token = f.token();
  const closes = f.api.offscreen.closeDocument.mock.calls.length;
  f.sync.offscreen({ kind: 'stopped', captureId: old, reason: 'expired' }, { url: f.api.runtime.getURL('offscreen.html') });
  await vi.waitFor(() => expect(f.sync.status(f.session).mode).toBe('capture'));
  expect(f.sync.status(f.session).captureId).not.toBe(old);
  expect(f.token()).toBe(token);
  expect(f.api.offscreen.closeDocument).toHaveBeenCalledTimes(closes);
  expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledTimes(2);
  await f.sync.stop();
});
it('renews a quiet pending stream before its first audible frame and immediately recovers a rejected lease', async () => {
  const f = fixture(); f.api.runtime.sendMessage.mockResolvedValue({ ok: true });
  await f.sync.start(f.session, f.owner, 'subscription');
  await vi.waitFor(() => expect(f.api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'start' })));
  await f.sync.start(f.session, f.owner, 'subscription');
  const lease = f.api.runtime.sendMessage.mock.calls.find(([m]) => m.kind === 'lease')[0];
  expect(lease.captureId).toBeTruthy();
  f.api.runtime.sendMessage.mockImplementation(async (m) => ({ ok: m.kind !== 'lease' }));
  await f.sync.start(f.session, f.owner, 'subscription');
  await vi.waitFor(() => expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledTimes(2));
  expect(f.sync.status(f.session).mode).toBe('clock');
  await f.sync.stop();
});

function fixture() {
  const api = {
    runtime: { getURL: (path) => `chrome-extension://companion/${path}`, getContexts: vi.fn().mockResolvedValue([]), sendMessage: vi.fn().mockResolvedValue({ ok: true }) },
    tabs: { sendMessage: vi.fn().mockResolvedValue({ ok: true }) },
    offscreen: { createDocument: vi.fn().mockResolvedValue(), closeDocument: vi.fn().mockResolvedValue() },
    tabCapture: { getMediaStreamId: vi.fn().mockResolvedValue('stream') },
    scripting: { executeScript: vi.fn().mockResolvedValue([]) },
  };
  const session = { id: 'song', tabId: 12, documentId: 'music-doc', index: 0, playing: true, paused: false, currentTime: 10, playbackRate: 1, sampledAt: Date.now() };
  const owner = { tabId: 24, documentId: 'app-doc' };
  const sync = createBeatSync(api);
  api.runtime.sendMessage.mockImplementation(async (message) => {
    if (message.kind === 'start') queueMicrotask(() => sync.offscreen({ kind: 'audible', captureId: message.captureId }, { url: api.runtime.getURL('offscreen.html') }));
    return { ok: true };
  });
  const token = () => api.tabs.sendMessage.mock.calls.find(([, message]) => message.kind === 'watch')[1].token;
  return { api, session, owner, sync, token };
}
it('automatically asks Chrome for capture and creates a USER_MEDIA offscreen document', async () => {
  const f = fixture();
  await f.sync.start(f.session, f.owner, 'subscription');
  await vi.waitFor(() => expect(f.api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'start', streamId: 'stream' })));
  expect(f.api.offscreen.createDocument).toHaveBeenCalledWith(expect.objectContaining({ reasons: ['USER_MEDIA'] }));
  expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledWith({ targetTabId: 12 });
  f.sync.clock({ kind: 'clock', token: f.token(), valid: true, clock: { ...f.session, paused: true, playing: false } }, { tab: { id: 12 }, documentId: 'music-doc' });
  expect(f.api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'stop' }));
  await f.sync.stop();
});
it('keeps clocks and controls for native process capture without invoking tabCapture after resume or restart', async () => {
  const f = fixture();
  const owner = { native: 'widget', nativeAudio: true };
  await f.sync.start(f.session, owner, 'subscription');
  expect(f.api.tabCapture.getMediaStreamId).not.toHaveBeenCalled();
  expect(f.api.offscreen.createDocument).not.toHaveBeenCalled();
  expect(f.sync.status(f.session)).toEqual({mode:'clock',reason:'native-audio'});
  f.sync.clock({token:f.token(),valid:true,clock:{...f.session,playing:false,paused:true}}, {tab:{id:12},documentId:'music-doc'});
  f.sync.clock({token:f.token(),valid:true,clock:{...f.session,playing:true,paused:false}}, {tab:{id:12},documentId:'music-doc'});
  await f.sync.start(f.session, owner, 'subscription');
  f.sync.invoke(12);
  expect(f.api.tabCapture.getMediaStreamId).not.toHaveBeenCalled();
  await f.sync.stop();
  await f.sync.start({...f.session,id:'new-tab',tabId:14,documentId:'new-doc'}, owner, 'new-subscription');
  expect(f.api.tabCapture.getMediaStreamId).not.toHaveBeenCalled();
  await f.sync.stop();
});

it('discards delayed capture on a seek or playback-rate change and reacquires a fresh stream', async () => {
  const f = fixture();
  await f.sync.start(f.session, f.owner, 'subscription');
  await vi.waitFor(() => expect(f.sync.status(f.session).mode).toBe('capture'));
  const first = f.api.runtime.sendMessage.mock.calls.find(([message]) => message.kind === 'start')[0].captureId;
  f.sync.clock({ token: f.token(), valid: true, clock: { ...f.session, currentTime: 45, sampledAt: f.session.sampledAt + 100 } },
    { tab: { id: 12 }, documentId: 'music-doc' });
  expect(f.api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'stop', captureId: first }));
  await vi.waitFor(() => expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(f.sync.status(f.session).mode).toBe('capture'));
  f.sync.clock({ token: f.token(), valid: true, clock: { ...f.session, currentTime: 45.1, sampledAt: f.session.sampledAt + 200, playbackRate: 1.5 } },
    { tab: { id: 12 }, documentId: 'music-doc' });
  await vi.waitFor(() => expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledTimes(3));
  await f.sync.stop();
});
it('silently keeps clock mode on capture failure and ignores clocks from other documents', async () => {
  const f = fixture();
  f.api.tabCapture.getMediaStreamId.mockRejectedValue(new Error('Denied'));
  await f.sync.start(f.session, f.owner, 'subscription');
  f.sync.invoke(12);
  await vi.waitFor(() => expect(f.api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'stop' })));
  expect(f.api.tabs.sendMessage).not.toHaveBeenCalledWith(24, expect.objectContaining({ kind: 'sync.state', mode: 'capture' }), expect.anything());
  expect(f.api.tabs.sendMessage).toHaveBeenCalledWith(24, expect.objectContaining({ kind: 'sync.state', mode: 'clock', reason: 'capture-permission' }), expect.anything());
  const before = f.api.tabs.sendMessage.mock.calls.length;
  f.sync.clock({ token: f.token(), valid: true, clock: f.session }, { tab: { id: 12 }, documentId: 'wrong-doc' });
  expect(f.api.tabs.sendMessage.mock.calls).toHaveLength(before);
  await f.sync.stop();
});

it.each([
  ['Extension has not been invoked for the current page.', 'capture-permission'],
  ['Cannot capture a tab with an active stream.', 'capture-request'],
  ['The tab is already being captured.', 'capture-busy'],
  ['Unexpected capture request failure', 'capture-request'],
])('reports %s honestly instead of calling every request failure a permission denial', async (message, reason) => {
  const f = fixture();
  f.api.tabCapture.getMediaStreamId.mockRejectedValue(new Error(message));
  await f.sync.start(f.session, f.owner, 'subscription');
  await vi.waitFor(() => expect(f.api.tabs.sendMessage).toHaveBeenCalledWith(24,
    expect.objectContaining({ kind: 'sync.state', mode: 'clock', reason }), expect.anything()));
  await f.sync.stop();
});

it('does not capture muted music and stops capture when the tab is muted or closed', async () => {
  const f = fixture();
  f.sync.invoke(12);
  await f.sync.start({ ...f.session, tabMuted: true }, f.owner, 'subscription');
  expect(f.api.tabCapture.getMediaStreamId).not.toHaveBeenCalled();
  f.sync.tabMuted(12, false);
  await vi.waitFor(() => expect(f.api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'start' })));
  f.sync.tabMuted(12, true);
  expect(f.api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'stop' }));
  const before = f.api.offscreen.closeDocument.mock.calls.length;
  f.sync.tabClosed(12);
  await vi.waitFor(() => expect(f.api.offscreen.closeDocument.mock.calls.length).toBeGreaterThan(before));
});
it('switches the captured tab and does not let an old subscription stop the new one', async () => {
  const f = fixture();
  await f.sync.start(f.session, f.owner, 'old');
  f.sync.invoke(12);
  await vi.waitFor(() => expect(f.api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'start' })));
  await f.sync.start({ ...f.session, id: 'other', tabId: 13, documentId: 'other-doc' }, f.owner, 'new');
  expect(f.api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'stop' }));
  const closes = f.api.offscreen.closeDocument.mock.calls.length;
  await f.sync.stop(f.owner, 'old');
  expect(f.api.offscreen.closeDocument).toHaveBeenCalledTimes(closes);
  f.sync.invoke(13);
  await vi.waitFor(() => expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledWith({ targetTabId: 13 }));
  await f.sync.stop();
});

it('ignores a queued tab-close cleanup after another session takes ownership', async () => {
  const f = fixture();
  await f.sync.start(f.session, f.owner, 'old');
  const switching = f.sync.start({ ...f.session, id: 'other', tabId: 13, documentId: 'other-doc' }, f.owner, 'new');
  f.sync.tabClosed(12);
  await switching;
  // Drain the serialized close callback, which belongs only to the old state.
  await f.sync.stop(f.owner, 'old');
  f.sync.invoke(13);
  await vi.waitFor(() => expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledWith({ targetTabId: 13 }));
  await f.sync.stop();
});

it('returns silently to clock mode when an offscreen document disappears', async () => {
  const f = fixture();
  f.sync.invoke(12);
  await f.sync.start(f.session, f.owner, 'subscription');
  await vi.waitFor(() => expect(f.api.tabs.sendMessage).toHaveBeenCalledWith(24,
    expect.objectContaining({ kind: 'sync.state', mode: 'capture' }), expect.anything()));
  f.api.runtime.sendMessage.mockImplementation(async (message) => ({ ok: message.kind !== 'lease' }));
  await f.sync.start(f.session, f.owner, 'subscription');
  expect(f.api.tabs.sendMessage).toHaveBeenLastCalledWith(24,
    expect.objectContaining({ kind: 'sync.state', mode: 'clock' }), expect.anything());
  expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledTimes(1);
  await f.sync.stop();
});

it('retries a denied capture with backoff and recovers after app and worker reloads without an invocation flag', async () => {
  const f = fixture();
  let now = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  f.api.tabCapture.getMediaStreamId.mockRejectedValueOnce(new Error('Permission denied'));
  await f.sync.start(f.session, f.owner, 'one');
  await vi.waitFor(() => expect(f.api.tabs.sendMessage).toHaveBeenCalledWith(24,
    expect.objectContaining({ kind: 'sync.state', reason: 'capture-permission' }), expect.anything()));
  await f.sync.start(f.session, f.owner, 'one');
  expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledTimes(1);
  now += 31000;
  await f.sync.start(f.session, f.owner, 'one');
  await vi.waitFor(() => expect(f.api.tabs.sendMessage).toHaveBeenCalledWith(24,
    expect.objectContaining({ kind: 'sync.state', mode: 'capture' }), expect.anything()));
  expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledTimes(2);
  await f.sync.start(f.session, { ...f.owner, documentId: 'reloaded-app' }, 'two');
  await vi.waitFor(() => expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledTimes(3));
  await f.sync.stop();
  const restarted = createBeatSync(f.api);
  await restarted.start(f.session, f.owner, 'three');
  await vi.waitFor(() => expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledTimes(4));
  await restarted.stop();
});

it('publishes capture only after stream confirmation AND audible analysis, and tags each real onset', async () => {
  const f = fixture();
  let confirm;
  f.api.runtime.sendMessage.mockImplementation(async (message) => message.kind === 'start'
    ? new Promise((resolve) => { confirm = resolve; }) : { ok: true });
  await f.sync.start(f.session, f.owner, 'subscription');
  await vi.waitFor(() => expect(confirm).toBeTypeOf('function'));
  expect(f.api.tabs.sendMessage).not.toHaveBeenCalledWith(24, expect.objectContaining({ mode: 'capture' }), expect.anything());
  confirm({ ok: true });
  await vi.waitFor(() => expect(f.sync.status(f.session)).toMatchObject({ mode: 'clock', reason: 'starting' }));
  expect(f.api.tabs.sendMessage).not.toHaveBeenCalledWith(24, expect.objectContaining({ mode: 'capture' }), expect.anything());
  const captureId = f.api.runtime.sendMessage.mock.calls.find(([message]) => message.kind === 'start')[0].captureId;
  const sender = { url: f.api.runtime.getURL('offscreen.html') };
  f.sync.offscreen({ kind: 'audible', captureId }, sender);
  await vi.waitFor(() => expect(f.sync.status(f.session)).toMatchObject({ mode: 'capture', captureId }));
  f.sync.offscreen({ kind: 'onset', captureId, bands: ['kick', 'kick', 'hat'] }, sender);
  expect(f.api.tabs.sendMessage).toHaveBeenLastCalledWith(24, expect.objectContaining({ kind: 'onset', captureId, sequence: 1, bands: ['kick', 'hat'] }), expect.anything());
  f.sync.offscreen({ kind: 'onset', captureId, bands: ['clap'] }, sender);
  expect(f.api.tabs.sendMessage).toHaveBeenLastCalledWith(24, expect.objectContaining({ kind: 'onset', sequence: 2, bands: ['clap'] }), expect.anything());
  await f.sync.stop();
});

it('relays sustained Melody only from the live, playing captured stream', async () => {
  const f = fixture();
  await f.sync.start(f.session, f.owner, 'subscription');
  await vi.waitFor(() => expect(f.sync.status(f.session).mode).toBe('capture'));
  const captureId = f.sync.status(f.session).captureId;
  const sender = { url: f.api.runtime.getURL('offscreen.html') };
  const melody = { active: true, level: .6, note: 1 };
  f.sync.offscreen({ kind: 'melody.state', detector: 'instrument-v1', captureId, melody }, sender);
  expect(f.api.tabs.sendMessage).toHaveBeenLastCalledWith(24,
    expect.objectContaining({ kind: 'melody.state', detector: 'instrument-v1', captureId, melody }), expect.anything());
  const before = f.api.tabs.sendMessage.mock.calls.length;
  f.sync.offscreen({ kind: 'melody.state', captureId, melody }, sender);
  f.sync.offscreen({ kind: 'melody.state', captureId: 'old', melody }, sender);
  f.sync.offscreen({ kind: 'melody.state', captureId, melody }, { ...sender, tab: { id: 12 } });
  f.sync.offscreen({ kind: 'melody.state', captureId, melody: { ...melody, level: 2 } }, sender);
  expect(f.api.tabs.sendMessage).toHaveBeenCalledTimes(before);
  f.sync.clock({ token: f.token(), valid: true, clock: { ...f.session, playing: false, paused: true } },
    { tab: { id: 12 }, documentId: 'music-doc' });
  const paused = f.api.tabs.sendMessage.mock.calls.length;
  f.sync.offscreen({ kind: 'melody.state', captureId, melody }, sender);
  expect(f.api.tabs.sendMessage).toHaveBeenCalledTimes(paused);
  await f.sync.stop();
});

it('relays tempo lock and eighth-note ticks only from the live captured stream', async () => {
  const f = fixture();
  await f.sync.start(f.session, f.owner, 'subscription');
  await vi.waitFor(() => expect(f.sync.status(f.session).mode).toBe('capture'));
  const captureId = f.sync.status(f.session).captureId;
  const sender = { url: f.api.runtime.getURL('offscreen.html') };
  f.sync.offscreen({ kind: 'tempo.state', captureId, tempo: { locked: true, bpm: 120, confidence: .8 } }, sender);
  expect(f.api.tabs.sendMessage).toHaveBeenLastCalledWith(24,
    expect.objectContaining({ kind: 'tempo.state', tempo: { locked: true, bpm: 120, confidence: .8 } }), expect.anything());
  f.sync.offscreen({ kind: 'tempo.tick', captureId, tick: { step: 2, phase: .1, beatPosition: 1, subdivision: 2 } }, sender);
  expect(f.api.tabs.sendMessage).toHaveBeenLastCalledWith(24,
    expect.objectContaining({ kind: 'tempo.tick', tick: { step: 2, phase: .1, beatPosition: 1, subdivision: 2 } }), expect.anything());
  const before = f.api.tabs.sendMessage.mock.calls.length;
  f.sync.offscreen({ kind: 'tempo.tick', captureId: 'old-capture', tick: { step: 4, bands: ['hat'] } }, sender);
  f.sync.offscreen({ kind: 'tempo.tick', captureId, tick: { step: 8, bands: ['hat'] } }, sender);
  expect(f.api.tabs.sendMessage).toHaveBeenCalledTimes(before);
  await f.sync.stop();
});

const supportedServices = ['www.youtube.com', 'music.youtube.com', 'soundcloud.com', 'open.spotify.com', 'music.apple.com', 'www.deezer.com', 'listen.tidal.com'];

it.each(supportedServices)('tries %s and confirms only an audible stream, even with media keys and source-less clocks', async (source) => {
  const f = fixture();
  f.api.runtime.sendMessage.mockResolvedValue({ ok: true });
  const spotify = { ...f.session, source, protectedMedia: true };
  await f.sync.start(spotify, f.owner, 'spotify-sub');
  await vi.waitFor(() => expect(f.api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'start' })));
  expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledWith({ targetTabId: 12 });
  expect(f.sync.status(spotify)).toMatchObject({ mode: 'clock', reason: 'starting' });
  f.sync.clock({ token: f.token(), valid: true, clock: { ...f.session, protectedMedia: true } }, { tab: { id: 12 }, documentId: 'music-doc' });
  const captureId = f.api.runtime.sendMessage.mock.calls.find(([message]) => message.kind === 'start')[0].captureId;
  const sender = { url: f.api.runtime.getURL('offscreen.html') };
  f.sync.offscreen({ kind: 'audible', captureId }, sender);
  await vi.waitFor(() => expect(f.sync.status(spotify)).toEqual({ mode: 'capture', reason: undefined, captureId }));
  f.sync.offscreen({ kind: 'onset', captureId, bands: ['kick', 'clap'] }, sender);
  expect(f.api.tabs.sendMessage).toHaveBeenLastCalledWith(24, expect.objectContaining({ kind: 'onset', bands: ['kick', 'clap'] }), expect.anything());
  await f.sync.stop();
});

it.each(supportedServices)('recovers interrupted %s capture, ignores old onsets and retries immediately on resume', async (source) => {
  const f = fixture();
  let now = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  f.api.runtime.sendMessage.mockResolvedValue({ ok: true });
  const spotify = { ...f.session, source, protectedMedia: true };
  await f.sync.start(spotify, f.owner, 'spotify-sub');
  await vi.waitFor(() => expect(f.api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'start' })));
  const captureId = f.api.runtime.sendMessage.mock.calls.find(([message]) => message.kind === 'start')[0].captureId;
  const sender = { url: f.api.runtime.getURL('offscreen.html') };
  f.sync.offscreen({ kind: 'stopped', captureId, reason: 'silent' }, sender);
  expect(f.sync.status(spotify)).toEqual({ mode: 'clock', reason: 'starting' });
  const count = f.api.tabs.sendMessage.mock.calls.length;
  f.sync.offscreen({ kind: 'audible', captureId }, sender);
  f.sync.offscreen({ kind: 'onset', captureId, bands: ['kick'] }, sender);
  expect(f.api.tabs.sendMessage).toHaveBeenCalledTimes(count);
  now += 4000;
  await f.sync.start(spotify, f.owner, 'spotify-sub');
  await vi.waitFor(() => expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledTimes(2));
  now += 27000;
  await f.sync.start(spotify, f.owner, 'spotify-sub');
  await vi.waitFor(() => expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledTimes(2));
  f.sync.clock({ token: f.token(), valid: true, clock: { ...spotify, paused: true, playing: false } }, { tab: { id: 12 }, documentId: 'music-doc' });
  await vi.waitFor(() => expect(f.sync.status(spotify).reason).toBe('not-playing'));
  f.sync.clock({ token: f.token(), valid: true, clock: spotify }, { tab: { id: 12 }, documentId: 'music-doc' });
  await vi.waitFor(() => expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledTimes(3));
  await f.sync.stop();
});

it.each(supportedServices)('reports denied %s capture honestly instead of guessing from the platform or media keys', async (source) => {
  const f = fixture();
  f.api.tabCapture.getMediaStreamId.mockRejectedValue(new Error('Permission denied'));
  const spotify = { ...f.session, source, protectedMedia: true };
  await f.sync.start(spotify, f.owner, 'spotify-sub');
  await vi.waitFor(() => expect(f.sync.status(spotify)).toEqual({ mode: 'clock', reason: 'capture-permission' }));
  expect(f.api.tabs.sendMessage).not.toHaveBeenCalledWith(24, expect.objectContaining({ kind: 'sync.state', mode: 'capture' }), expect.anything());
  await f.sync.stop();
});

it('does not cancel browser-approved audible capture just because a media element acquires media keys', async () => {
  const f = fixture();
  await f.sync.start({ ...f.session, source: 'listen.tidal.com' }, f.owner, 'subscription');
  await vi.waitFor(() => expect(f.sync.status(f.session).mode).toBe('capture'));
  f.sync.clock({ token: f.token(), valid: true, clock: { ...f.session, protectedMedia: true } }, { tab: { id: 12 }, documentId: 'music-doc' });
  expect(f.sync.status(f.session)).toMatchObject({ mode: 'capture' });
  expect(f.api.runtime.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'stop' }));
  await f.sync.stop();
});

it('reports modes per session and drops stale onsets when switching from YouTube to paused Apple Music', async () => {
  const f = fixture();
  const youtube = { ...f.session, source: 'www.youtube.com' };
  const apple = { ...f.session, id: 'apple', tabId: 13, source: 'music.apple.com', documentId: 'apple-doc', playing: false, paused: true };
  await f.sync.start(youtube, f.owner, 'youtube-sub');
  await vi.waitFor(() => expect(f.sync.status(youtube).mode).toBe('capture'));
  const captureId = f.sync.status(youtube).captureId;
  expect(f.sync.status(apple)).toEqual({ mode: 'clock', reason: 'not-playing' });
  await f.sync.start(apple, f.owner, 'apple-sub');
  expect(f.sync.status(youtube)).toEqual({ mode: 'clock', reason: 'not-selected' });
  expect(f.sync.status(apple)).toEqual({ mode: 'clock', reason: 'not-playing' });
  const before = f.api.tabs.sendMessage.mock.calls.length;
  f.sync.offscreen({ kind: 'onset', captureId, bands: ['kick'] }, { url: f.api.runtime.getURL('offscreen.html') });
  expect(f.api.tabs.sendMessage.mock.calls).toHaveLength(before);
  expect(f.api.tabCapture.getMediaStreamId).toHaveBeenCalledTimes(1);
  await f.sync.stop();
});

it('returns to clock on silent capture and never publishes capture without audio proof', async () => {
  const f = fixture();
  f.api.runtime.sendMessage.mockResolvedValue({ ok: true });
  await f.sync.start(f.session, f.owner, 'sub');
  await vi.waitFor(() => expect(f.api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'start' })));
  const captureId = f.api.runtime.sendMessage.mock.calls.find(([message]) => message.kind === 'start')[0].captureId;
  f.sync.offscreen({ kind: 'stopped', captureId, reason: 'silent' }, { url: f.api.runtime.getURL('offscreen.html') });
  expect(f.sync.status(f.session)).toEqual({ mode: 'clock', reason: 'starting' });
  expect(f.api.tabs.sendMessage).not.toHaveBeenCalledWith(24, expect.objectContaining({ kind: 'sync.state', mode: 'capture' }), expect.anything());
  await f.sync.stop();
});
