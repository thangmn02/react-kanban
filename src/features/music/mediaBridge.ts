export interface BrowserMusicSession {
  id: string;
  title: string;
  artist: string;
  source: string;
  paused: boolean;
  playing?: boolean;
  currentTime?: number;
  playbackRate?: number;
  sampledAt?: number;
}

export interface MusicClock {
  playing: boolean;
  paused: boolean;
  currentTime: number;
  playbackRate: number;
  sampledAt: number;
}
export type BeatBand = 'kick' | 'bass' | 'snare' | 'hat';
export type BeatEvent = { kind: 'clock'; clock: MusicClock }
  | { kind: 'sync.state'; mode: 'clock' | 'capture'; reason?: string; captureId?: string }
  | { kind: 'onset'; bands: BeatBand[]; captureId?: string; sequence?: number };

const channel = 'kanban-music-v1';
export type MusicAction = 'sessions.get' | 'media.play' | 'media.pause';
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
    && ['currentTime', 'playbackRate', 'sampledAt'].every((key) => item[key] === undefined || (typeof item[key] === 'number' && Number.isFinite(item[key]) && (item[key] as number) >= 0));
}

function requestBridge(action: MusicAction | BeatAction, sessionId?: string, subscriptionId?: string): Promise<Record<string, unknown>> {
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
  return response.sessions.slice(0, 30);
}

export async function sendBeatRequest(action: BeatAction, sessionId: string, subscriptionId: string): Promise<void> {
  await requestBridge(action, sessionId, subscriptionId);
}

export function subscribeBeatEvents(sessionId: string, subscriptionId: string, receive: (event: BeatEvent) => void) {
  const listener = (event: MessageEvent) => {
    const message = event.data;
    if (event.source !== window || event.origin !== window.location.origin || !message || message.channel !== channel
      || message.direction !== 'extension-event' || message.event !== 'beat' || message.sessionId !== sessionId || message.subscriptionId !== subscriptionId) return;
    if (['sync.state', 'status'].includes(message.kind) && ['clock', 'capture'].includes(message.mode)) receive({
      kind: 'sync.state', mode: message.mode,
      reason: typeof (message.reason ?? message.fallbackReason) === 'string' ? String(message.reason ?? message.fallbackReason).slice(0, 80) : undefined,
      captureId: typeof message.captureId === 'string' ? message.captureId.slice(0, 100) : undefined,
    });
    if (message.kind === 'onset' && Array.isArray(message.bands) && message.bands.length <= 4
      && message.bands.every((band: unknown) => typeof band === 'string' && ['kick', 'bass', 'snare', 'hat'].includes(band))) receive({
        kind: 'onset', bands: [...new Set<BeatBand>(message.bands)],
        ...(typeof message.captureId === 'string' ? { captureId: message.captureId.slice(0, 100) } : {}),
        ...(Number.isSafeInteger(message.sequence) && message.sequence > 0 ? { sequence: message.sequence } : {}),
      });
    if (message.kind === 'clock') {
      const clock = message.clock;
      if (clock && typeof clock.playing === 'boolean' && typeof clock.paused === 'boolean'
        && ['currentTime', 'playbackRate', 'sampledAt'].every((key) => typeof clock[key] === 'number' && Number.isFinite(clock[key]) && clock[key] >= 0)) receive({ kind: 'clock', clock });
    }
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
