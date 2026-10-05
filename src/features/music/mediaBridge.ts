import { isNativeWidget } from '../native/runtime';
import { requestNativeMusic, subscribeNativeMusic } from '../native/nativeMusic';

export interface BrowserMusicSession {
  id: string;
  title: string;
  artist: string;
  source: string;
  paused: boolean;
  playing?: boolean;
  canControl?: boolean;
  currentTime?: number;
  playbackRate?: number;
  sampledAt?: number;
  selectionToken?: string;
  syncState?: { mode: 'clock' | 'capture'; reason?: string; captureId?: string };
}

export interface MusicClock {
  playing: boolean;
  paused: boolean;
  currentTime: number;
  playbackRate: number;
  sampledAt: number;
}
export type BeatBand = 'kick' | 'clap' | 'hat' | 'bass' | 'melody';
export interface MelodyState { active: boolean; level: number; note: number }
export type BeatEvent = { kind: 'clock'; clock: MusicClock }
  | { kind: 'sync.state'; mode: 'clock' | 'capture'; reason?: string; captureId?: string }
  | { kind: 'onset'; bands: BeatBand[]; captureId?: string; sequence?: number }
  | { kind: 'melody.state'; captureId: string; melody: MelodyState }
  | { kind: 'tempo.state'; captureId: string; tempo: { locked: boolean; bpm: number | null; confidence: number } }
  | { kind: 'tempo.tick'; captureId: string; tick: { step: number; bands: BeatBand[] } };

const channel = 'kanban-music-v1';
const supportedBands = ['kick', 'clap', 'hat', 'bass', 'melody', 'snare'];
const canonicalBand = (band: string): BeatBand => band === 'snare' ? 'clap' : band as BeatBand;
export type MusicAction = 'sessions.get' | 'diagnostics.get' | 'media.play' | 'media.pause' | 'media.focus' | 'instrument.setup';
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

function requestBridge(action: MusicAction | BeatAction, sessionId?: string, subscriptionId?: string): Promise<Record<string, unknown>> {
  if (isNativeWidget()) return requestNativeMusic(action, sessionId, subscriptionId).then((response) => {
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
      ...(subscriptionId ? { subscriptionId } : {}) }, window.location.origin);
  });
}

export async function sendMusicRequest(action: MusicAction, sessionId?: string): Promise<BrowserMusicSession[]> {
  const response = await requestBridge(action, sessionId);
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

export function subscribeBeatEvents(sessionId: string, subscriptionId: string, receive: (event: BeatEvent) => void) {
  const parse = (data: unknown, native = false) => {
    if (!data || typeof data !== 'object') return;
    // Payload fields are checked below before reaching the controller.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = data as Record<string, any>;
    if (message.sessionId !== sessionId || message.subscriptionId !== subscriptionId) return;
    if (!native && (message.channel !== channel || message.direction !== 'extension-event' || message.event !== 'beat')) return;
    // Never replay queued flashes when a minimized webview resumes.
    if (native && (typeof message.emittedAt !== 'number' || !Number.isFinite(message.emittedAt)
      || Date.now() - message.emittedAt > 600 || message.emittedAt > Date.now() + 100)) return;
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
      && Array.isArray(message.tick.bands) && message.tick.bands.length <= 3
      && message.tick.bands.every((band: unknown) => typeof band === 'string' && ['kick', 'clap', 'snare', 'hat'].includes(band))) receive({
        kind: 'tempo.tick', captureId: message.captureId,
        tick: { step: message.tick.step, bands: [...new Set<BeatBand>(message.tick.bands.map(canonicalBand))] },
      });
    if (message.kind === 'clock') {
      const clock = message.clock;
      if (clock && typeof clock.playing === 'boolean' && typeof clock.paused === 'boolean'
        && ['currentTime', 'playbackRate', 'sampledAt'].every((key) => typeof clock[key] === 'number' && Number.isFinite(clock[key]) && clock[key] >= 0)) receive({ kind: 'clock', clock });
    }
  };
  if (isNativeWidget()) return subscribeNativeMusic((payload) => parse(payload, true));
  const listener = (event: MessageEvent) => {
    if (event.source === window && event.origin === window.location.origin) parse(event.data);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
