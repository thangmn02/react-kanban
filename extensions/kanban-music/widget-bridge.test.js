import { afterEach, expect, it, vi } from 'vitest';
import { createWidgetBridge } from './widget-bridge.js';

afterEach(() => vi.useRealTimers());
function fixture() {
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
  const bridge = createWidgetBridge({ Socket, handle, disconnected });
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
