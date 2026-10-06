import { afterEach, expect, it, vi } from 'vitest';
import { getMusicInstallUrl, isMusicSession, sendMusicRequest, sendMusicDiagnostics, subscribeBeatEvents, openInstrumentNotesSetup } from './mediaBridge';
import { beatTelemetry } from '../../../extensions/kanban-music/beat-telemetry.js';

afterEach(() => { beatTelemetry.enable(false); beatTelemetry.clear(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllEnvs(); });
const session = { id: '1', title: 'Song', artist: 'Artist', source: 'youtube.com', paused: true };
it('preserves queued future targets despite old transport timestamps and rejects malformed anchors', () => {
  vi.useFakeTimers(); beatTelemetry.enable();
  const receive = vi.fn(), stop = subscribeBeatEvents('song', 'subscription', receive);
  const playbackClock = { currentTime: 10, sampledAt: Date.now(), playbackRate: 1, playing: true, paused: false };
  const send = (sequence: number, timing: object) => window.dispatchEvent(new MessageEvent('message', { source: window, origin: location.origin,
    data: { channel: 'kanban-music-v1', direction: 'extension-event', event: 'beat', sessionId: 'song', subscriptionId: 'subscription',
      kind: 'onset', bands: ['kick'], captureId: 'capture', sequence, emittedAt: Date.now() - 3000,
      telemetry: beatTelemetry.events('onset', ['kick']), ...timing } }));
  send(1, { targetPlaybackTime: 11, playbackClock });
  send(2, { targetPlaybackTime: 11.5, playbackClock });
  expect(receive.mock.calls.map(([event]) => event.targetPlaybackTime)).toEqual([11, 11.5]);
  send(3, { targetPlaybackTime: 12, playbackClock: { ...playbackClock, playbackRate: 0 } });
  expect(receive).toHaveBeenCalledTimes(2);
  expect(beatTelemetry.snapshot().counts.EVENT_LATE).toBe(2);
  expect(beatTelemetry.snapshot().records.some(r => r.reason === 'invalid')).toBe(true);
  stop();
});
it('coalesces bounded late bursts, traces rejected work and requests recovery for expired delivery', async () => {
  vi.useFakeTimers(); beatTelemetry.enable();
  const receive = vi.fn(), stop = subscribeBeatEvents('song', 'subscription', receive);
  const send = (sequence: number, age: number) => window.dispatchEvent(new MessageEvent('message', { source: window, origin: location.origin,
    data: { channel: 'kanban-music-v1', direction: 'extension-event', event: 'beat', sessionId: 'song', subscriptionId: 'subscription',
      kind: 'onset', bands: ['kick'], captureId: 'capture', sequence, emittedAt: Date.now() - age, telemetry: beatTelemetry.events('onset', ['kick']) } }));
  for (let sequence = 1; sequence <= 100; sequence++) send(sequence, 700);
  expect(receive).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(0);
  expect(receive).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ kind: 'onset', sequence: 100 }));
  for (let sequence = 101; sequence < 150; sequence++) send(sequence, 3000);
  expect(receive).toHaveBeenLastCalledWith({ kind: 'sync.recover' });
  expect(receive).toHaveBeenCalledTimes(2);
  send(150, 0);
  expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'onset', sequence: 150 }));
  const log = beatTelemetry.snapshot();
  expect(log.counts.EVENT_LATE).toBe(149);
  expect(log.records.some((r) => r.reason === 'delivery-coalesced' && r.stage === 'EVENT_DROPPED')).toBe(true);
  expect(log.records.some((r) => r.reason === 'late' && r.stage === 'EVENT_DROPPED')).toBe(true);
  expect(log.counts.CAPTURE_RECOVERED).toBeGreaterThan(0);
  send(151, 800); stop(); await vi.advanceTimersByTimeAsync(0);
  expect(receive).toHaveBeenCalledTimes(3);
});
it('does not replay a pending late event over a fresher event of the same kind', async () => {
  vi.useFakeTimers(); const receive = vi.fn(), stop = subscribeBeatEvents('song', 'subscription', receive);
  const send = (sequence: number, age: number) => window.dispatchEvent(new MessageEvent('message', { source: window, origin: location.origin,
    data: { channel: 'kanban-music-v1', direction: 'extension-event', event: 'beat', sessionId: 'song', subscriptionId: 'subscription', kind: 'onset',
      bands: ['hat'], sequence, emittedAt: Date.now() - age } }));
  send(1, 700); send(2, 0); await vi.advanceTimersByTimeAsync(0);
  expect(receive).toHaveBeenCalledExactlyOnceWith({ kind: 'onset', bands: ['hat'], sequence: 2 });
  stop();
});
it('expires a coalesced event if the UI stays blocked and rejects older delivery after fresh delivery', async () => {
  vi.useFakeTimers(); const receive = vi.fn(), stop = subscribeBeatEvents('song', 'subscription', receive);
  const send = (sequence: number, age: number) => window.dispatchEvent(new MessageEvent('message', { source: window, origin: location.origin,
    data: { channel: 'kanban-music-v1', direction: 'extension-event', event: 'beat', sessionId: 'song', subscriptionId: 'subscription', kind: 'onset',
      bands: ['hat'], sequence, emittedAt: Date.now() - age } }));
  send(1, 1800); vi.setSystemTime(Date.now() + 500); await vi.advanceTimersByTimeAsync(0);
  expect(receive).toHaveBeenCalledExactlyOnceWith({ kind: 'sync.recover' });
  send(3, 0); send(2, 700); await vi.advanceTimersByTimeAsync(0);
  expect(receive).toHaveBeenCalledTimes(2);
  expect(receive).toHaveBeenLastCalledWith({ kind: 'onset', bands: ['hat'], sequence: 3 });
  stop();
});
it('forwards only valid diagnostic sidecars and never rejects an otherwise valid beat because of telemetry', () => {
  beatTelemetry.enable(); const receive = vi.fn();
  const stop = subscribeBeatEvents('song', 'subscription', receive);
  const traces = beatTelemetry.events('onset', ['kick']);
  const send = (telemetry: unknown) => window.dispatchEvent(new MessageEvent('message', { source: window, origin: location.origin,
    data: { channel: 'kanban-music-v1', direction: 'extension-event', event: 'beat', sessionId: 'song', subscriptionId: 'subscription', kind: 'onset', bands: ['kick'], telemetry } }));
  send(traces?.map((t) => ({ ...t, title: 'private' })));
  expect(receive).toHaveBeenLastCalledWith({ kind: 'onset', bands: ['kick'], telemetry: traces });
  send([{ id: 'invalid' }]);
  expect(receive).toHaveBeenLastCalledWith({ kind: 'onset', bands: ['kick'] });
  expect(beatTelemetry.snapshot().counts.EVENT_RECEIVED).toBe(1);
  stop();
});
it('opens instrument setup through a correlated selected-session acknowledgement', async () => {
  const post = vi.spyOn(window, 'postMessage').mockImplementation(message => reply(message, { ok: true }));
  await expect(openInstrumentNotesSetup(session.id)).resolves.toBeUndefined();
  expect(post).toHaveBeenCalledWith(expect.objectContaining({ action: 'instrument.setup', sessionId: session.id }), location.origin);
  post.mockImplementation(message => reply(message, { ok: false, error: 'unavailable' }));
  await expect(openInstrumentNotesSetup(session.id)).rejects.toMatchObject({ code: 'unavailable' });
});

it('accepts isolated instrument states, rejects legacy tonal states and canonicalizes snare to Clap', () => {
  const receive = vi.fn();
  const stop = subscribeBeatEvents('song', 'subscription', receive);
  const send = (data: object) => window.dispatchEvent(new MessageEvent('message', { source: window, origin: location.origin,
    data: { channel: 'kanban-music-v1', direction: 'extension-event', event: 'beat', sessionId: 'song', subscriptionId: 'subscription', captureId: 'live', detector: 'instrument-v1', ...data } }));
  send({ kind: 'melody.state', melody: { active: true, level: NaN, note: 1 } });
  send({ kind: 'melody.state', melody: { active: true, level: 2, note: 1 } });
  send({ kind: 'melody.state', detector: undefined, melody: { active: true, level: .6, note: 1 } });
  expect(receive).not.toHaveBeenCalled();
  send({ kind: 'melody.state', melody: { active: true, level: .6, note: 1 } });
  expect(receive).toHaveBeenCalledWith({ kind: 'melody.state', captureId: 'live', melody: { active: true, level: .6, note: 1 } });
  send({ kind: 'onset', bands: ['snare'] });
  expect(receive).toHaveBeenLastCalledWith({ kind: 'onset', captureId: 'live', bands: ['clap'] });
  stop();
});
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
  emit({ kind: 'tempo.tick', tick: { step: 2, phase: .1, beatPosition: 1, subdivision: 2 } });
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
