// Exact music hosts only. Keep manifest permissions/matches aligned with these.
export const musicHosts = [
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
  'soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com',
  'open.spotify.com', 'music.apple.com',
  'deezer.com', 'www.deezer.com',
  'tidal.com', 'www.tidal.com', 'listen.tidal.com',
];
export const mediaSites = [...musicHosts.map((host) => `https://${host}/*`), 'http://localhost/*', 'http://127.0.0.1/*'];

export function isMusicUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' && musicHosts.includes(url.hostname))
      || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && ['5173', '5174'].includes(url.port));
  } catch { return false; }
}
