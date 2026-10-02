// These functions are self-contained because Chrome runs them in a media tab.
export function readMedia() {
  const metadata = navigator.mediaSession?.metadata;
  return Array.from(document.querySelectorAll('audio,video')).flatMap((media, index) => {
    if (!media.currentSrc || media.readyState === 0 || media.ended) return [];
    return [{ index, src: media.currentSrc, title: (metadata?.title || document.title || 'Untitled media').slice(0, 500), artist: (metadata?.artist || '').slice(0, 500), source: location.hostname, paused: media.paused,
      playing: !media.paused && !media.seeking && media.readyState >= 3,
      currentTime: Number.isFinite(media.currentTime) ? media.currentTime : 0,
      playbackRate: media.playbackRate, sampledAt: Date.now(), muted: media.muted || media.volume === 0 }];
  });
}

export async function controlMedia(index, expectedSource, action) {
  const media = document.querySelectorAll('audio,video')[index];
  if (!media || media.currentSrc !== expectedSource) throw new Error('Track changed. Refresh and try again.');
  if (action === 'media.pause') media.pause();
  else if (action === 'media.play') await media.play();
  else throw new Error('Unsupported music command.');
  return true;
}
