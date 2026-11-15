import { useEffect, useMemo, useState } from 'react';
import type { BrowserMusicSession } from './mediaBridge';
import type { BrowserMusicController } from './useBrowserMusic';
import { paletteFromPixels, type TrackPalette } from './track-palette';

const DEMO_KEY = 'kora:dock-demo';
/**
 * Gates every dock demo path (track accent, demo tracks). Live sign-in builds
 * can never turn it on; in the local demo identity it is an explicit opt-in:
 * `?dockDemo=1` switches it on for this browser, `?dockDemo=0` off again.
 */
export function dockDemoEnabled(): boolean {
  if (import.meta.env.VITE_AUTH_MODE === 'supabase' || typeof window === 'undefined') return false;
  try {
    const requested = new URLSearchParams(window.location.search).get('dockDemo');
    if (requested === '1') localStorage.setItem(DEMO_KEY, '1');
    else if (requested === '0') localStorage.removeItem(DEMO_KEY);
    return localStorage.getItem(DEMO_KEY) === '1';
  } catch { return false; }
}

const cover = (from: string, to: string, shape: string) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/>${shape}</svg>`)}`;
/** Saved demo tracks: no audio and no network, so the panel can be reviewed without a live source. */
const demoTracks: (Pick<BrowserMusicSession, 'id' | 'title' | 'artist' | 'source' | 'duration'> & { artwork?: string })[] = [
  { id: 'dock-demo-1', title: 'Night Drive', artist: 'Kora demo', source: 'Demo', duration: 214,
    artwork: cover('#2447d8', '#0b1a66', '<circle cx="88" cy="30" r="14" fill="#ffe14a"/><path d="M0 78h120v42H0z" fill="#0a1238"/><path d="M8 78V52h14v26zm22 0V40h12v38zm20 0V58h16v20zm26 0V46h12v32zm20 0V60h14v18z" fill="#ff2da0"/><path d="M12 58h6v4h-6zm22-10h4v4h-4zm46 6h4v4h-4zm-26 12h8v4h-8z" fill="#ffe14a"/><path d="M0 96h120v6H0z" fill="#3fd2e0"/>') },
  { id: 'dock-demo-2', title: 'Sunrise Loop', artist: 'Kora demo', source: 'Demo', duration: 187,
    artwork: cover('#ff9a3d', '#e2452f', '<circle cx="60" cy="76" r="30" fill="#ffe08a"/><rect y="84" width="120" height="36" fill="#a32a1d"/>') },
  { id: 'dock-demo-3', title: 'Fern Canopy', artist: 'Kora demo', source: 'Demo', duration: 242,
    artwork: cover('#2fa66a', '#0d5a3c', '<path d="M60 104C40 80 36 52 60 20c24 32 20 60 0 84z" fill="#b8f2c9" opacity=".9"/>') },
  { id: 'dock-demo-4', title: 'A track without cover art, with a title long enough to wrap', artist: 'Kora demo', source: 'Demo', duration: 163 },
];

/** A video source's own thumbnail stands in as cover art. Requested only in demo mode. */
function withArtwork(session: BrowserMusicSession): BrowserMusicSession {
  if (session.artwork || session.asset?.provider !== 'youtube' || !/^[\w-]{6,20}$/.test(session.asset.id)) return session;
  return { ...session, artwork: `https://i.ytimg.com/vi/${session.asset.id}/mqdefault.jpg` };
}

const trackKey = (session: BrowserMusicSession) => `${session.title}\n${session.artist}`;

interface DemoState { selectedId: string; paused: boolean; position: number; sampledAt: number; volume: number }
/**
 * In demo mode, when no live source is connected, stand in a small local
 * playlist with a working transport. A live source always wins, and outside
 * demo mode the live controller is returned untouched.
 */
export function useDockDemoMusic(live: BrowserMusicController, enabled: boolean): BrowserMusicController {
  const [state, setState] = useState<DemoState>(() => ({ selectedId: demoTracks[0].id, paused: true, position: 0, sampledAt: Date.now(), volume: 0.7 }));
  const active = enabled && live.sessions.length === 0;
  const sessions = useMemo<BrowserMusicSession[]>(() => demoTracks.map(track => {
    const selected = track.id === state.selectedId;
    return { ...track, paused: selected ? state.paused : true, playing: selected && !state.paused, canControl: true, canSeek: true, canPrevious: true, canNext: true,
      currentTime: selected ? state.position : 0, sampledAt: state.sampledAt, playbackRate: 1, volume: state.volume, muted: false };
  }), [state]);
  // The same track can arrive as two sessions (page and player); the one without a video id borrows its twin's cover.
  const liveSessions = useMemo(() => {
    const withArt = live.sessions.map(withArtwork), covers = new Map(withArt.filter(session => session.artwork).map(session => [trackKey(session), session.artwork]));
    return withArt.map(session => session.artwork || !covers.has(trackKey(session)) ? session : { ...session, artwork: covers.get(trackKey(session)) });
  }, [live.sessions]);
  // A live source keeps its own controller; the demo only adds the cover its video already has.
  if (enabled && !active) return { ...live, sessions: liveSessions, selected: liveSessions.find(session => session.id === live.selected?.id) ?? live.selected } as BrowserMusicController;
  if (!active) return live;
  const now = () => Date.now();
  const elapsed = (current: DemoState) => current.paused ? current.position : current.position + (now() - current.sampledAt) / 1000;
  const selected = sessions.find(session => session.id === state.selectedId) ?? sessions[0];
  const step = (offset: number) => setState(current => {
    const index = demoTracks.findIndex(track => track.id === current.selectedId);
    return { ...current, selectedId: demoTracks[(index + offset + demoTracks.length) % demoTracks.length].id, position: 0, sampledAt: now() };
  });
  return { ...live, sessions, selected, connected: true, checking: false, error: '', busy: false, playing: !state.paused,
    setSelectedId: (id: string) => setState(current => ({ ...current, selectedId: id, position: 0, sampledAt: now() })),
    toggle: async () => setState(current => ({ ...current, paused: !current.paused, position: Math.min(elapsed(current), selected.duration ?? 0), sampledAt: now() })),
    openMusicTab: async () => {}, refresh: () => {},
    control: async (action, value) => {
      if (action === 'media.next') step(1);
      else if (action === 'media.previous') step(-1);
      else if (action === 'media.seek' && typeof value === 'number') setState(current => ({ ...current, position: value, sampledAt: now() }));
      else if (action === 'media.volume' && typeof value === 'number') setState(current => ({ ...current, volume: value }));
    },
  } as BrowserMusicController;
}

const SAMPLE = 16;
let sampler: CanvasRenderingContext2D | null | undefined;
/** One reusable 16×16 software canvas for every sample. */
function samplerContext() {
  if (sampler === undefined) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = SAMPLE;
    sampler = canvas.getContext('2d', { willReadFrequently: true });
  }
  return sampler;
}
/** Extracted palettes by artwork, so a track is sampled once and playback costs nothing. null = unreadable image. */
const paletteCache = new Map<string, TrackPalette | null>();
const whenIdle = (work: () => void) => typeof requestIdleCallback === 'function' ? requestIdleCallback(work, { timeout: 100 }) : setTimeout(work, 0);

/**
 * The Beat Grid palette for the selected track, sampled from its cover or video
 * thumbnail. Null (the grid's own colours) when disabled, while the image
 * loads, or when the track has no readable image.
 */
export function useTrackPalette(session: BrowserMusicSession | undefined, enabled: boolean): TrackPalette | null {
  const artwork = enabled ? session?.artwork : undefined;
  const [, setSampled] = useState(0);
  useEffect(() => {
    if (!artwork || paletteCache.has(artwork)) return;
    let current = true;
    const finish = (palette: TrackPalette | null) => { paletteCache.set(artwork, palette); if (current) setSampled(count => count + 1); };
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onerror = () => finish(null);
    // Clustering runs in idle time so it never competes with a beat frame.
    image.onload = () => whenIdle(() => {
      try {
        const context = samplerContext();
        if (!context) return finish(null);
        context.clearRect(0, 0, SAMPLE, SAMPLE); context.drawImage(image, 0, 0, SAMPLE, SAMPLE);
        finish(paletteFromPixels(context.getImageData(0, 0, SAMPLE, SAMPLE).data));
      } catch { finish(null); }
    });
    image.src = artwork;
    return () => { current = false; };
  }, [artwork]);
  return artwork ? paletteCache.get(artwork) ?? null : null;
}
