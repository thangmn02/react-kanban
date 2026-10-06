import { isNativeWidget } from '../native/runtime';
import { requestNativeMusic, subscribeNativeMusic } from '../native/nativeMusic';
import { beatTelemetry, parseBeatTraces, type BeatTrace } from '../../../extensions/kanban-music/beat-telemetry.js';
import { parsePlaybackTiming, parsePlaybackClock, playbackDeadline, type PlaybackTiming, type PlaybackClock } from '../../../extensions/kanban-music/beat-timing.js';
const telemetry = beatTelemetry.at('media-bridge');

export interface BrowserMusicSession {
  id: string;
  title: string;
  artist: string;
  source: string;
  paused: boolean;
  playing?: boolean;
  canControl?: boolean;
  currentTime?: number;
  duration?: number;
  volume?: number;
  muted?: boolean;
  canSeek?: boolean;
  canPrevious?: boolean;
  canNext?: boolean;
  playbackRate?: number;
  sampledAt?: number;
  selectionToken?: string;
  syncState?: { mode: 'clock' | 'capture'; reason?: string; captureId?: string };
}

export type MusicClock = PlaybackClock;
export type BeatBand = 'kick' | 'clap' | 'hat' | 'bass' | 'melody';
export interface MelodyState { active: boolean; level: number; note: number }
export type BeatEvent = ({ kind: 'clock'; clock: MusicClock }
  | { kind: 'sync.recover' }
  | { kind: 'sync.state'; mode: 'clock' | 'capture'; reason?: string; captureId?: string }
  | { kind: 'onset'; bands: BeatBand[]; captureId?: string; sequence?: number }
  | { kind: 'melody.state'; captureId: string; melody: MelodyState }
  | { kind: 'tempo.state'; captureId: string; tempo: { locked: boolean; bpm: number | null; confidence: number } }
  | { kind: 'tempo.tick'; captureId: string; tick: { step: number; phase: number; beatPosition: number; subdivision: 2 } }) & { telemetry?: BeatTrace[] } & Partial<PlaybackTiming>;

const channel = 'kanban-music-v1';
const supportedBands = ['kick', 'clap', 'hat', 'bass', 'melody', 'snare'];
const canonicalBand = (band: string): BeatBand => band === 'snare' ? 'clap' : band as BeatBand;
export type MusicAction = 'sessions.get' | 'diagnostics.get' | 'media.play' | 'media.pause' | 'media.focus' | 'media.seek' | 'media.volume' | 'media.previous' | 'media.next' | 'instrument.setup';
type BeatAction = 'dock.beat.sync.start' | 'dock.beat.sync.stop';

export class MusicBridgeError extends Error {
  readonly code: 'not-installed' | 'unavailable' | 'playback' | 'invalid-response';
  constructor(code: MusicBridgeError['code']) {
    super(code);
    this.code = code;
  }
}

export function getMusicInstallUrl(language: 'en' | 'vi'): string {
  const listing = import.meta.env.VITE_MUSIC_EXTENSION_STORE_URL;
  if (listing) {
    try {
      const url = new URL(listing);
      if (url.protocol === 'https:' && ['chromewebstore.google.com', 'microsoftedge.microsoft.com'].includes(url.hostname)) return url.href;
    } catch { /* Use the local guide until a store listing is configured. */ }
  }
  return `/music-companion.html?lang=${language}`;
}

export function isMusicSession(value: unknown): value is BrowserMusicSession {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return ['id', 'title', 'artist', 'source'].every((key) => typeof item[key] === 'string' && (item[key] as string).length <= 1000)
    && typeof item.paused === 'boolean'
    && (item.playing === undefined || typeof item.playing === 'boolean')
    && (item.canControl === undefined || typeof item.canControl === 'boolean')
    && ['muted', 'canSeek', 'canPrevious', 'canNext'].every(key => item[key] === undefined || typeof item[key] === 'boolean')
    && (item.duration === undefined || typeof item.duration === 'number' && Number.isFinite(item.duration) && item.duration >= 0)
    && (item.volume === undefined || typeof item.volume === 'number' && Number.isFinite(item.volume) && item.volume >= 0 && item.volume <= 1)
    && (item.selectionToken === undefined || (typeof item.selectionToken === 'string' && item.selectionToken.length <= 100))
    && (item.syncState === undefined || isSyncState(item.syncState))
    && ['currentTime', 'playbackRate', 'sampledAt'].every((key) => item[key] === undefined || (typeof item[key] === 'number' && Number.isFinite(item[key]) && (item[key] as number) >= 0));
}

function isSyncState(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  return (state.mode === 'clock' || state.mode === 'capture')
    && (state.reason === undefined || (typeof state.reason === 'string' && state.reason.length <= 80))
    && (state.captureId === undefined || (typeof state.captureId === 'string' && state.captureId.length <= 100));
}

function requestBridge(action: MusicAction | BeatAction, sessionId?: string, subscriptionId?: string, value?: number): Promise<Record<string, unknown>> {
  if (isNativeWidget()) return requestNativeMusic(action, sessionId, subscriptionId, value).then((response) => {
    if (response.ok !== true) throw new MusicBridgeError(response.error === 'not-installed' ? 'not-installed' : 'unavailable');
    return response;
  }).catch((error) => {
    if (error instanceof MusicBridgeError) throw error;
    throw new MusicBridgeError(action.startsWith('media.') ? 'playback' : 'unavailable');
  });
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const cleanup = () => { clearTimeout(timeout); window.removeEventListener('message', receive); };
    const receive = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const response = event.data;
      if (!response || response.channel !== channel || response.direction !== 'extension-to-app' || response.requestId !== requestId) return;
      cleanup();
      if (response.ok !== true) { reject(new MusicBridgeError(response.error === 'playback' ? 'playback' : 'unavailable')); return; }
      resolve(response);
    };
    const timeout = window.setTimeout(() => { cleanup(); reject(new MusicBridgeError('not-installed')); }, 2500);
    window.addEventListener('message', receive);
    window.postMessage({ channel, direction: 'app-to-extension', requestId, action, sessionId,
      ...(value !== undefined ? { value } : {}),
      ...(subscriptionId ? { subscriptionId } : {}) }, window.location.origin);
  });
}

export async function sendMusicRequest(action: MusicAction, sessionId?: string, value?: number): Promise<BrowserMusicSession[]> {
  if (action === 'media.seek' && (!Number.isFinite(value) || value! < 0 || value! > 864000)
    || action === 'media.volume' && (!Number.isFinite(value) || value! < 0 || value! > 1)) throw new MusicBridgeError('playback');
  const response = await requestBridge(action, sessionId, undefined, value);
  if (!Array.isArray(response.sessions) || !response.sessions.every(isMusicSession)) throw new MusicBridgeError('invalid-response');
  return response.sessions;
}

export async function sendBeatRequest(action: BeatAction, sessionId: string, subscriptionId: string): Promise<void> {
  await requestBridge(action, sessionId, subscriptionId);
}

export async function sendMusicDiagnostics(): Promise<unknown[]> {
  const response = await requestBridge('diagnostics.get');
  if (!Array.isArray(response.tabs)) throw new MusicBridgeError('invalid-response');
  return response.tabs;
}

export async function openInstrumentNotesSetup(sessionId: string): Promise<void> {
  await requestBridge('instrument.setup', sessionId);
}

export function subscribeBeatEvents(sessionId: string, subscriptionId: string, callback: (event: BeatEvent) => void) {
  const delayed = new Map<string, { event: BeatEvent; expiresAt: number }>();
  const latestAt = new Map<string, number>();
  let pending: ReturnType<typeof setTimeout> | undefined;
  let lastRecovery = -Infinity;
  let recovering = false;
  const recover = () => {
    if (Date.now() - lastRecovery < 1000) return;
    lastRecovery = Date.now();
    recovering = true;
    telemetry.record('EVENT_SENT', undefined, { reason: 'delivery-late' });
    callback({ kind: 'sync.recover' });
  };
  const flush = () => {
    pending = undefined;
    // State establishes the capture owner before its latest semantic event.
    for (const kind of ['clock', 'sync.state', 'tempo.state', 'tempo.tick', 'onset', 'melody.state']) {
      const queued = delayed.get(kind);
      if (!queued) continue;
      if (Date.now() > queued.expiresAt) {
        telemetry.mark('EVENT_LATE', queued.event.telemetry);
        telemetry.mark('EVENT_DROPPED', queued.event.telemetry, { reason: 'late' });
        recover();
      } else {
        callback(queued.event);
        telemetry.record('CAPTURE_RECOVERED', undefined, { reason: 'delivery-late' });
        recovering = false;
      }
    }
    delayed.clear();
  };
  const parse = (data: unknown, native = false) => {
    if (!data || typeof data !== 'object') return;
    // Payload fields are checked below before reaching the controller.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = data as Record<string, any>;
    const traces = parseBeatTraces(message.telemetry);
    if (message.sessionId !== sessionId || message.subscriptionId !== subscriptionId) { telemetry.mark('EVENT_DROPPED', traces, { reason: 'owner' }); return; }
    if (!native && (message.channel !== channel || message.direction !== 'extension-event' || message.event !== 'beat')) return;
    const age = Date.now() - message.emittedAt;
    const timing = parsePlaybackTiming(message);
    if ((message.targetPlaybackTime !== undefined || message.playbackClock !== undefined) && !timing) {
      telemetry.mark('EVENT_DROPPED', traces, { reason: 'invalid' }); return;
    }
    const deadline = timing ? playbackDeadline(timing) : undefined;
    const ahead = deadline !== undefined && deadline >= Date.now() && deadline - Date.now() <= 8000;
    if (native && (typeof message.emittedAt !== 'number' || !Number.isFinite(message.emittedAt)
      || message.emittedAt > Date.now() + 100)) { telemetry.mark('EVENT_DROPPED', traces, { reason: 'invalid' }); return; }
    const late = (native || Number.isFinite(message.emittedAt)) && age > 600;
    if (late) telemetry.mark('EVENT_LATE', traces, { delayMs: age });
    if (late && age > 2000 && !ahead) { telemetry.mark('EVENT_DROPPED', traces, { reason: 'late' }); recover(); return; }
    telemetry.mark('EVENT_RECEIVED', traces);
    let delivered = false;
    const receive = (event: BeatEvent) => {
      delivered = true;
      const value = { ...event, ...(traces ? { telemetry: traces } : {}), ...(timing || {}) };
      const timestamp = Number.isFinite(message.emittedAt) ? message.emittedAt : Date.now();
      if (!ahead && timestamp < (latestAt.get(event.kind) ?? -Infinity)) { telemetry.mark('EVENT_DROPPED', traces, { reason: 'delivery-coalesced' }); return; }
      latestAt.set(event.kind, timestamp);
      const previous = delayed.get(event.kind);
      if (previous) telemetry.mark('EVENT_DROPPED', previous.event.telemetry, { reason: 'delivery-coalesced' });
      delayed.delete(event.kind);
      if (late && !ahead) {
        delayed.set(event.kind, { event: value, expiresAt: timestamp + 2000 });
        pending ??= setTimeout(flush, 0);
      } else {
        callback(value);
        if (recovering) { telemetry.record('CAPTURE_RECOVERED', undefined, { reason: 'delivery-late' }); recovering = false; }
      }
    };
    if (message.kind === 'sync.recover') { delivered = true; recover(); }
    if (['sync.state', 'status'].includes(message.kind) && ['clock', 'capture'].includes(message.mode)) receive({
      kind: 'sync.state', mode: message.mode,
      reason: typeof (message.reason ?? message.fallbackReason) === 'string' ? String(message.reason ?? message.fallbackReason).slice(0, 80) : undefined,
      captureId: typeof message.captureId === 'string' ? message.captureId.slice(0, 100) : undefined,
    });
    if (message.kind === 'onset' && Array.isArray(message.bands) && message.bands.length <= 5
      && message.bands.every((band: unknown) => typeof band === 'string' && supportedBands.includes(band))) receive({
        kind: 'onset', bands: [...new Set<BeatBand>(message.bands.map(canonicalBand))],
        ...(typeof message.captureId === 'string' ? { captureId: message.captureId.slice(0, 100) } : {}),
        ...(Number.isSafeInteger(message.sequence) && message.sequence > 0 ? { sequence: message.sequence } : {}),
      });
    if (message.kind === 'tempo.state' && typeof message.captureId === 'string' && message.captureId.length <= 100
      && typeof message.tempo?.locked === 'boolean' && typeof message.tempo.confidence === 'number'
      && Number.isFinite(message.tempo.confidence) && message.tempo.confidence >= 0 && message.tempo.confidence <= 1
      && (message.tempo.bpm === null || typeof message.tempo.bpm === 'number' && Number.isFinite(message.tempo.bpm)
        && message.tempo.bpm >= 60 && message.tempo.bpm <= 180)) receive({ kind: 'tempo.state', captureId: message.captureId,
        tempo: { locked: message.tempo.locked, bpm: message.tempo.bpm, confidence: message.tempo.confidence } });
    if (message.kind === 'melody.state' && message.detector === 'instrument-v1' && typeof message.captureId === 'string' && message.captureId.length <= 100
      && typeof message.melody?.active === 'boolean' && Number.isFinite(message.melody.level)
      && message.melody.level >= 0 && message.melody.level <= 1
      && Number.isSafeInteger(message.melody.note) && message.melody.note >= 0) receive({
        kind: 'melody.state', captureId: message.captureId,
        melody: { active: message.melody.active, level: message.melody.level, note: message.melody.note },
      });
    if (message.kind === 'tempo.tick' && typeof message.captureId === 'string' && message.captureId.length <= 100
      && Number.isInteger(message.tick?.step) && message.tick.step >= 0 && message.tick.step < 8
      && Number.isFinite(message.tick.phase) && message.tick.phase >= 0 && message.tick.phase < 1
      && Number.isFinite(message.tick.beatPosition) && message.tick.beatPosition >= 0 && message.tick.subdivision === 2) receive({
        kind: 'tempo.tick', captureId: message.captureId,
        tick: { step: message.tick.step, phase: message.tick.phase, beatPosition: message.tick.beatPosition, subdivision: 2 },
      });
    if (message.kind === 'clock') {
      const clock = parsePlaybackClock(message.clock);
      if (clock) receive({ kind: 'clock', clock });
    }
    if (!delivered) telemetry.mark('EVENT_DROPPED', traces, { reason: 'invalid' });
  };
  const clearPending = () => { clearTimeout(pending); delayed.forEach(({ event }) => telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'owner' })); delayed.clear(); };
  if (isNativeWidget()) {
    const stop = subscribeNativeMusic((payload) => parse(payload, true));
    return () => { stop(); clearPending(); };
  }
  const listener = (event: MessageEvent) => {
    if (event.source === window && event.origin === window.location.origin) parse(event.data);
  };
  window.addEventListener('message', listener);
  return () => { window.removeEventListener('message', listener); clearPending(); };
}
