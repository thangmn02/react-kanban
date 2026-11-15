import type { BrowserMusicSession } from './mediaBridge';

// Discovery may finish after a newer clock event. Keep metadata from discovery,
// but don't rewind playback (or briefly resume it) with an older observation.
export function mergeMusicSessions(previous: BrowserMusicSession[], next: BrowserMusicSession[]): BrowserMusicSession[] {
  return next.map((incoming) => {
    const latest = previous.find((item) => item.id === incoming.id);
    // A known song does not lose its identity because the page moved (YouTube Home, miniplayer, browse pages). An
    // older Companion still reports no asset there; the same player with the same title keeps the last one.
    const session = latest?.asset && !incoming.asset && latest.title === incoming.title ? { ...incoming, asset: latest.asset } : incoming;
    if (!latest || latest.asset?.provider !== session.asset?.provider || latest.asset?.id !== session.asset?.id
      || (latest.sampledAt ?? 0) <= (session.sampledAt ?? 0)) return session;
    return { ...session, paused: latest.paused, playing: latest.playing,
      currentTime: latest.currentTime, playbackRate: latest.playbackRate, sampledAt: latest.sampledAt,
      ...Object.fromEntries(['muted', 'buffering', 'seeking', 'generation'].filter(key => key in latest)
        .map(key => [key, latest[key as keyof BrowserMusicSession]])) };
  });
}

// Pages such as YouTube keep sub-second interface sounds in media elements. They are
// never music, and must not steal the automatic selection from the song.
export const isInterfaceClip = (session: BrowserMusicSession) =>
  Number.isFinite(session.duration) && session.duration! > 0 && session.duration! < 3;
