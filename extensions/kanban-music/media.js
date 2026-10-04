// These functions are self-contained because Chrome runs them in a media tab.
export function readMedia() {
  const metadata = navigator.mediaSession?.metadata;
  const entries = globalThis.__kanbanMusicMedia?.entries() || Array.from(document.querySelectorAll('audio,video'), (media, index) => ({ media, index }));
  return entries.flatMap(({ media, index }) => {
    const src = media.currentSrc || (typeof media.srcObject?.id === 'string' ? `stream:${media.srcObject.id}` : '');
    if (!src || media.readyState === 0 || media.ended) return [];
    return [{ index, src, title: (metadata?.title || document.title || 'Untitled media').slice(0, 500), artist: (metadata?.artist || '').slice(0, 500), source: location.hostname, paused: media.paused,
      playing: !media.paused && !media.seeking && media.readyState >= 3,
      currentTime: Number.isFinite(media.currentTime) ? media.currentTime : 0,
      playbackRate: media.playbackRate, sampledAt: Date.now(), muted: media.muted || media.volume === 0,
      protectedMedia: Boolean(media.mediaKeys), observed: Boolean(globalThis.__kanbanMusicMedia) }];
  });
}

export async function controlMedia(index, expectedSource, action) {
  const media = globalThis.__kanbanMusicMedia
    ? globalThis.__kanbanMusicMedia.entries().find((entry) => entry.index === index)?.media
    : document.querySelectorAll('audio,video')[index];
  const src = media?.currentSrc || (typeof media?.srcObject?.id === 'string' ? `stream:${media.srcObject.id}` : '');
  if (!media || src !== expectedSource) throw new Error('Track changed. Refresh and try again.');
  if (action === 'media.pause') media.pause();
  else if (action === 'media.play') await media.play();
  else throw new Error('Unsupported music command.');
  return true;
}
