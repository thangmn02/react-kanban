import { afterEach, expect, it, vi } from 'vitest';
import { getMusicInstallUrl, isMusicSession, sendMusicRequest, sendMusicDiagnostics, subscribeBeatEvents } from './mediaBridge';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllEnvs(); });
const session = { id: '1', title: 'Song', artist: 'Artist', source: 'youtube.com', paused: true };
function reply(request: Record<string, unknown>, data: object, origin = window.location.origin, source: Window | null = window) {
  window.dispatchEvent(new MessageEvent('message', { source, origin, data: {
    channel: 'kanban-music-v1', direction: 'extension-to-app', requestId: request.requestId, ...data,
  } }));
}
it('rejects malformed metadata before rendering it', () => {
  expect(isMusicSession({ ...session, title: '<script>text</script>' })).toBe(true);
  expect(isMusicSession({ id: '1', title: {}, paused: false })).toBe(false);
  expect(isMusicSession({ ...session, title: 'x'.repeat(1001) })).toBe(false);
  expect(isMusicSession({ ...session, currentTime: NaN })).toBe(false);
  expect(isMusicSession({ ...session, syncState: { mode: 'clock', reason: 'drm-protected' } })).toBe(true);
  expect(isMusicSession({ ...session, syncState: { mode: 'pretend' } })).toBe(false);
  expect(isMusicSession({ ...session, syncState: { mode: 'capture', captureId: 'x'.repeat(101) } })).toBe(false);
});

it('keeps every reported session available to the picker, including more than 30', async () => {
  const sessions = Array.from({ length: 35 }, (_, index) => ({ ...session, id: String(index), syncState: { mode: 'clock' as const, reason: 'not-selected' } }));
  vi.spyOn(window, 'postMessage').mockImplementation((message) => reply(message, { ok: true, sessions }));
  await expect(sendMusicRequest('sessions.get')).resolves.toEqual(sessions);
});

it('correlates diagnostic requests and rejects malformed reports', async () => {
  const tabs = [{ host: 'soundcloud.com', audible: true, status: 'inspected' }];
  const post = vi.spyOn(window, 'postMessage').mockImplementation(message => reply(message, { ok: true, tabs }));
  await expect(sendMusicDiagnostics()).resolves.toEqual(tabs);
  expect(post).toHaveBeenCalledWith(expect.objectContaining({ action: 'diagnostics.get' }), window.location.origin);
  post.mockImplementation(message => reply(message, { ok: true, tabs: {} }));
  await expect(sendMusicDiagnostics()).rejects.toMatchObject({ code: 'invalid-response' });
});

it('accepts beat events only for the active session, subscription, origin, and supported bands', () => {
  const receive = vi.fn();
  const unsubscribe = subscribeBeatEvents('song', 'subscription', receive);
  const data = { channel: 'kanban-music-v1', direction: 'extension-event', event: 'beat', sessionId: 'song', subscriptionId: 'subscription', kind: 'onset', bands: ['kick'] };
  const emit = (overrides = {}, origin = window.location.origin) => window.dispatchEvent(new MessageEvent('message', { source: window, origin, data: { ...data, ...overrides } }));
  emit({}, 'https://evil.example');
  emit({ sessionId: 'old-song' });
  emit({ subscriptionId: 'old-subscription' });
  emit({ bands: ['execute'] });
  expect(receive).not.toHaveBeenCalled();
  emit();
  expect(receive).toHaveBeenCalledWith({ kind: 'onset', bands: ['kick'] });
  unsubscribe();
  emit();
  expect(receive).toHaveBeenCalledOnce();
});
it('validates tempo lock updates and rejects fabricated grid ticks', () => {
  const receive = vi.fn();
  const unsubscribe = subscribeBeatEvents('song', 'subscription', receive);
  const base = { channel: 'kanban-music-v1', direction: 'extension-event', event: 'beat', sessionId: 'song', subscriptionId: 'subscription', captureId: 'live' };
  const emit = (payload: object) => window.dispatchEvent(new MessageEvent('message', { source: window, origin: window.location.origin, data: { ...base, ...payload } }));
  emit({ kind: 'tempo.state', tempo: { locked: true, bpm: 120, confidence: .8 } });
  emit({ kind: 'tempo.tick', tick: { step: 2, bands: ['kick', 'hat', 'snare'] } });
  expect(receive).toHaveBeenCalledTimes(2);
  emit({ kind: 'tempo.state', tempo: { locked: true, bpm: 200, confidence: .8 } });
  emit({ kind: 'tempo.tick', tick: { step: 8, bands: ['hat'] } });
  emit({ kind: 'tempo.tick', tick: { step: 4, bands: ['unknown'] } });
  expect(receive).toHaveBeenCalledTimes(2);
  unsubscribe();
});
it('discovers the companion without an extension ID and sends a correlated request', async () => {
  const post = vi.spyOn(window, 'postMessage').mockImplementation((message) => reply(message, { ok: true, sessions: [session] }));
  await expect(sendMusicRequest('media.pause', session.id)).resolves.toEqual([session]);
  expect(post).toHaveBeenCalledWith({ channel: 'kanban-music-v1', direction: 'app-to-extension',
    requestId: expect.any(String), action: 'media.pause', sessionId: session.id }, window.location.origin);
});
it('ignores wrong origins, windows, channels, and correlation IDs', async () => {
  vi.spyOn(window, 'postMessage').mockImplementation((message) => {
    reply(message, { ok: true, sessions: [session] }, 'https://evil.example');
    reply(message, { ok: true, sessions: [session] }, window.location.origin, null);
    reply(message, { ok: true, sessions: [session], requestId: 'other-request' });
    reply(message, { ok: true, sessions: [session], channel: 'other-channel' });
    reply(message, { ok: true, sessions: [] });
  });
  await expect(sendMusicRequest('sessions.get')).resolves.toEqual([]);
});
it('sends the allowlisted selected music-tab focus command through the same correlated bridge', async () => {
  const post = vi.spyOn(window, 'postMessage').mockImplementation(message => reply(message, { ok: true, sessions: [session] }));
  await expect(sendMusicRequest('media.focus', session.id)).resolves.toEqual([session]);
  expect(post).toHaveBeenCalledWith(expect.objectContaining({ action: 'media.focus', sessionId: session.id }), window.location.origin);
});
it('reports missing installation after a timeout and cleans up the listener', async () => {
  vi.useFakeTimers();
  vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  const remove = vi.spyOn(window, 'removeEventListener');
  const request = expect(sendMusicRequest('sessions.get')).rejects.toMatchObject({ code: 'not-installed' });
  await vi.advanceTimersByTimeAsync(2500);
  await request;
  expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
});
it('rejects malformed replies and exposes playback failures', async () => {
  const post = vi.spyOn(window, 'postMessage').mockImplementation((message) => reply(message, { ok: true, sessions: [{}] }));
  await expect(sendMusicRequest('sessions.get')).rejects.toMatchObject({ code: 'invalid-response' });
  post.mockImplementation((message) => reply(message, { ok: false, error: 'playback' }));
  await expect(sendMusicRequest('media.play', '1')).rejects.toMatchObject({ code: 'playback' });
});
it('uses the installation guide until a trusted store listing is configured', () => {
  vi.stubEnv('VITE_MUSIC_EXTENSION_STORE_URL', '');
  expect(getMusicInstallUrl('vi')).toBe('/music-companion.html?lang=vi');
  vi.stubEnv('VITE_MUSIC_EXTENSION_STORE_URL', 'https://chromewebstore.google.com/detail/kanban/abc');
  expect(getMusicInstallUrl('en')).toBe('https://chromewebstore.google.com/detail/kanban/abc');
  vi.stubEnv('VITE_MUSIC_EXTENSION_STORE_URL', 'https://evil.example/download');
  expect(getMusicInstallUrl('en')).toBe('/music-companion.html?lang=en');
});
