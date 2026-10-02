import { afterEach, expect, it, vi } from 'vitest';
import { createBeatSync } from './beat-sync.js';
afterEach(() => vi.restoreAllMocks());

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

it('publishes capture only after confirmation, and tags each real onset with its capture and sequence', async () => {
  const f = fixture();
  let confirm;
  f.api.runtime.sendMessage.mockImplementation(async (message) => message.kind === 'start'
    ? new Promise((resolve) => { confirm = resolve; }) : { ok: true });
  await f.sync.start(f.session, f.owner, 'subscription');
  await vi.waitFor(() => expect(confirm).toBeTypeOf('function'));
  expect(f.api.tabs.sendMessage).not.toHaveBeenCalledWith(24, expect.objectContaining({ mode: 'capture' }), expect.anything());
  confirm({ ok: true });
  await vi.waitFor(() => expect(f.api.tabs.sendMessage).toHaveBeenCalledWith(24, expect.objectContaining({ mode: 'capture' }), expect.anything()));
  const captureId = f.api.runtime.sendMessage.mock.calls.find(([message]) => message.kind === 'start')[0].captureId;
  const sender = { url: f.api.runtime.getURL('offscreen.html') };
  f.sync.offscreen({ kind: 'onset', captureId, bands: ['kick', 'kick', 'hat'] }, sender);
  expect(f.api.tabs.sendMessage).toHaveBeenLastCalledWith(24, expect.objectContaining({ kind: 'onset', captureId, sequence: 1, bands: ['kick', 'hat'] }), expect.anything());
  f.sync.offscreen({ kind: 'onset', captureId, bands: ['snare'] }, sender);
  expect(f.api.tabs.sendMessage).toHaveBeenLastCalledWith(24, expect.objectContaining({ kind: 'onset', sequence: 2, bands: ['snare'] }), expect.anything());
  await f.sync.stop();
});
