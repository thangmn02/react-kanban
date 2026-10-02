import { afterEach, expect, it, vi } from 'vitest';
import { getMusicInstallUrl, isMusicSession, sendMusicRequest, subscribeBeatEvents } from './mediaBridge';

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
