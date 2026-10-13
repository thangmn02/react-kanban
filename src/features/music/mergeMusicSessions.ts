import type { BrowserMusicSession } from './mediaBridge';

// Discovery may finish after a newer clock event. Keep metadata from discovery,
// but don't rewind playback (or briefly resume it) with an older observation.
export function mergeMusicSessions(previous: BrowserMusicSession[], next: BrowserMusicSession[]): BrowserMusicSession[] {
  return next.map((session) => {
    const latest = previous.find((item) => item.id === session.id);
    if (!latest || latest.asset?.provider !== session.asset?.provider || latest.asset?.id !== session.asset?.id
      || (latest.sampledAt ?? 0) <= (session.sampledAt ?? 0)) return session;
    return { ...session, paused: latest.paused, playing: latest.playing,
      currentTime: latest.currentTime, playbackRate: latest.playbackRate, sampledAt: latest.sampledAt,
      ...Object.fromEntries(['muted', 'buffering', 'seeking', 'generation'].filter(key => key in latest)
        .map(key => [key, latest[key as keyof BrowserMusicSession]])) };
  });
}
