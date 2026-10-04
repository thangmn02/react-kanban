import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import code from './relay.js?raw';

function harness(origin = 'https://kanthangboard.netlify.app') {
  let receive;
  const postMessage = vi.fn();
  const sendMessage = vi.fn((_message, callback) => callback({ ok: true, sessions: [] }));
  const page = { postMessage, addEventListener: (_name, callback) => { receive = callback; } };
  runInNewContext(code, { window: page, location: { origin }, chrome: { runtime: { sendMessage, onMessage: { addListener: vi.fn() } } } });
  return { sendMessage, postMessage, page, receive: (data, options = {}) => receive?.({ source: page, origin, data, ...options }) };
}
const request = { channel: 'kanban-music-v1', direction: 'app-to-extension', requestId: 'request-1', action: 'sessions.get' };
it('relays only supported messages through the internal extension connection, with no ID', () => {
  const h = harness();
  h.receive(request);
  expect(h.sendMessage).toHaveBeenCalledWith({ protocol: 'kanban-music-v1', action: 'sessions.get', sessionId: undefined }, expect.any(Function));
  expect(h.postMessage).toHaveBeenCalledWith({ channel: 'kanban-music-v1', direction: 'extension-to-app', requestId: 'request-1', ok: true, sessions: [] }, 'https://kanthangboard.netlify.app');
});
it('does not relay messages from other pages or unknown commands', () => {
  const h = harness();
  h.receive(request, { origin: 'https://evil.example' });
  h.receive(request, { source: {} });
  h.receive({ ...request, direction: 'extension-to-app' });
  h.receive({ ...request, action: 'execute' });
  h.receive({ ...request, action: 'media.pause' });
  expect(h.sendMessage).not.toHaveBeenCalled();
  const other = harness('http://localhost:9999');
  other.receive(request);
  expect(other.sendMessage).not.toHaveBeenCalled();
});
it('relays a music-tab focus request only with a bounded session ID', () => {
  const h = harness();
  h.receive({ ...request, action: 'media.focus', sessionId: 'song' });
  expect(h.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ action: 'media.focus', sessionId: 'song' }), expect.any(Function));
  h.sendMessage.mockClear();
  h.receive({ ...request, action: 'media.focus', sessionId: 'x'.repeat(251) });
  expect(h.sendMessage).not.toHaveBeenCalled();
});
it('bounds concurrent requests and reports an invalidated extension cleanly', () => {
  const h = harness();
  h.sendMessage.mockImplementation(() => {});
  for (let i = 0; i < 8; i++) h.receive({ ...request, requestId: String(i) });
  expect(h.sendMessage).toHaveBeenCalledTimes(4);
  const unavailable = harness();
  unavailable.sendMessage.mockImplementation(() => { throw new Error('Extension invalidated'); });
  unavailable.receive(request);
  expect(unavailable.postMessage).toHaveBeenCalledWith(expect.objectContaining({ ok: false, error: 'unavailable' }), 'https://kanthangboard.netlify.app');
});
