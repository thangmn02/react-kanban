import { afterEach, expect, it, vi } from 'vitest';
import { createWidgetBridge } from './widget-bridge.js';

afterEach(() => vi.useRealTimers());
function fixture(options = {}) {
  vi.useFakeTimers();
  const sockets = [];
  class Socket {
    readyState = 1;
    send = vi.fn();
    close = vi.fn(() => { this.readyState = 3; this.onclose?.(); });
    constructor(url) { this.url = url; sockets.push(this); }
  }
  const handle = vi.fn().mockResolvedValue({ ok: true, sessions: [] });
  const disconnected = vi.fn();
  const bridge = createWidgetBridge({ Socket, handle, disconnected, ...options });
  bridge.connect();
  const socket = sockets[0];
  const nonce = 'abcdefghijklmnopabcdefghijklmnop1234';
  const receive = (data) => socket.onmessage({ data: JSON.stringify(data) });
  return { bridge, socket, sockets, nonce, receive, handle, disconnected };
}
it('connects only to the fixed IPv4 loopback endpoint and completes the nonce handshake', async () => {
  const f = fixture();
  expect(f.socket.url).toBe('ws://127.0.0.1:47635/kora-music');
  expect(f.bridge.connected).toBe(false);
  await f.receive({ type: 'hello', protocol: 'kora-widget-v1', nonce: f.nonce });
  expect(f.bridge.connected).toBe(true);
  expect(JSON.parse(f.socket.send.mock.calls[0][0])).toEqual({ type: 'hello', protocol: 'kora-widget-v1', nonce: f.nonce });
  f.bridge.close();
});
it('accepts only bounded music requests from this connection, never arbitrary commands', async () => {
  const f = fixture();
  await f.receive({ type: 'hello', protocol: 'kora-widget-v1', nonce: f.nonce });
  const request = { type: 'request', nonce: f.nonce, requestId: 'one', action: 'sessions.get' };
  await f.receive({ ...request, nonce: 'wrong' });
  await f.receive({ ...request, action: 'system.audio' });
  await f.receive({ ...request, action: 'media.play', sessionId: 'x'.repeat(251) });
  expect(f.handle).not.toHaveBeenCalled();
  await f.receive(request);
  expect(f.handle).toHaveBeenCalledWith(request, { native: f.nonce });
  expect(JSON.parse(f.socket.send.mock.calls.at(-1)[0])).toMatchObject({ type: 'response', requestId: 'one', ok: true, nonce: f.nonce });
  const setup = { ...request, action: 'instrument.setup', sessionId: 'song' };
  await f.receive({ ...setup, nonce: 'wrong' });
  await f.receive({ ...setup, sessionId: undefined });
  expect(f.handle).toHaveBeenCalledTimes(1);
  await f.receive(setup);
  expect(f.handle).toHaveBeenCalledTimes(1);
  f.bridge.close();
});
it('forwards fresh beat events only to their owning native connection', async () => {
  const f = fixture();
  await f.receive({ type: 'hello', protocol: 'kora-widget-v1', nonce: f.nonce });
  expect(f.bridge.beat('wrong-owner', { kind: 'onset' })).toBe(false);
  expect(f.bridge.beat(f.nonce, { kind: 'onset', bands: ['kick'], sessionId: 'song', subscriptionId: 'sub', captureId: 'capture', sequence: 1 })).toBe(true);
  expect(JSON.parse(f.socket.send.mock.calls.at(-1)[0])).toMatchObject({ type: 'beat', bands: ['kick'], emittedAt: Date.now(), nonce: f.nonce });
  f.bridge.close();
});
it('keeps the service worker awake and reconnects after widget restart without an app tab', async () => {
  const f = fixture();
  await f.receive({ type: 'hello', protocol: 'kora-widget-v1', nonce: f.nonce });
  await vi.advanceTimersByTimeAsync(20000);
  expect(JSON.parse(f.socket.send.mock.calls.at(-1)[0]).type).toBe('keepalive');
  f.socket.close();
  expect(f.disconnected).toHaveBeenCalledWith(f.nonce);
  expect(f.bridge.connected).toBe(false);
  await vi.advanceTimersByTimeAsync(3000);
  expect(f.sockets).toHaveLength(2);
  f.bridge.close();
});
it('acknowledges a verified update before reloading once and rejects stale or malformed requests', async () => {
  const reload = vi.fn(); const update = vi.fn().mockResolvedValue({ ok: true, version: '0.3.23' });
  const f = fixture({ api: { runtime: { reload } }, update });
  await f.receive({ type: 'hello', protocol: 'kora-widget-v1', nonce: f.nonce });
  const request = { type: 'request', nonce: f.nonce, requestId: 'update', action: 'companion.reload', expectedVersion: '0.3.23' };
  await f.receive({ ...request, nonce: 'old' });
  await f.receive({ ...request, expectedVersion: undefined });
  expect(update).not.toHaveBeenCalled();
  await f.receive(request); await f.receive(request);
  expect(f.handle).not.toHaveBeenCalled(); expect(reload).not.toHaveBeenCalled();
  expect(JSON.parse(f.socket.send.mock.calls.at(-1)[0])).toMatchObject({ type: 'response', requestId: 'update', ok: true, version: '0.3.23' });
  await vi.advanceTimersByTimeAsync(100); expect(reload).toHaveBeenCalledOnce();
  f.bridge.close();
});
it('does not reload after file rejection, a late reply or explicit bridge shutdown', async () => {
  const reload = vi.fn(); const update = vi.fn().mockResolvedValue({ ok: false, error: 'update-version-mismatch' });
  const f = fixture({ api: { runtime: { reload } }, update });
  await f.receive({ type: 'hello', protocol: 'kora-widget-v1', nonce: f.nonce });
  const request = { type: 'request', nonce: f.nonce, requestId: 'update', action: 'companion.reload', expectedVersion: '0.3.23' };
  await f.receive(request); await vi.advanceTimersByTimeAsync(100); expect(reload).not.toHaveBeenCalled();
  let finish; update.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const waiting = f.receive(request); f.socket.close(); finish({ ok: true, version: '0.3.23' }); await waiting;
  await vi.advanceTimersByTimeAsync(100); expect(reload).not.toHaveBeenCalled();
  f.bridge.close();
  const g = fixture({ api: { runtime: { reload } }, update: async () => ({ ok: true, version: '0.3.23' }) });
  await g.receive({ type: 'hello', protocol: 'kora-widget-v1', nonce: g.nonce });
  await g.receive({ ...request, nonce: g.nonce }); g.bridge.close();
  await vi.advanceTimersByTimeAsync(100); expect(reload).not.toHaveBeenCalled();
});
