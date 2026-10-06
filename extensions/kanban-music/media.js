// These functions are self-contained because Chrome runs them in a media tab.
export function readMedia() {
  const metadata = navigator.mediaSession?.metadata;
  const navigation = (selectors) => [...document.querySelectorAll(selectors)].find(button =>
    !button.disabled && button.getAttribute('aria-disabled') !== 'true' && button.getClientRects().length);
  const previous = navigation('.ytp-prev-button, ytmusic-player-bar .previous-button, [data-testid="control-button-skip-back"], .skipControl__previous, .player-previous');
  const next = navigation('.ytp-next-button, ytmusic-player-bar .next-button, [data-testid="control-button-skip-forward"], .skipControl__next, .player-next');
  const entries = globalThis.__kanbanMusicMedia?.entries() || Array.from(document.querySelectorAll('audio,video'), (media, index) => ({ media, index }));
  return entries.flatMap(({ media, index }) => {
    const src = media.currentSrc || (typeof media.srcObject?.id === 'string' ? `stream:${media.srcObject.id}` : '');
    if (!src || media.readyState === 0 || media.ended) return [];
    return [{ index, src, title: (metadata?.title || document.title || 'Untitled media').slice(0, 500), artist: (metadata?.artist || '').slice(0, 500), source: location.hostname, paused: media.paused,
      playing: !media.paused && !media.seeking && media.readyState >= 3,
      currentTime: Number.isFinite(media.currentTime) ? media.currentTime : 0,
      playbackRate: media.playbackRate, sampledAt: Date.now(), muted: media.muted || media.volume === 0,
      duration: Number.isFinite(media.duration) && media.duration > 0 ? media.duration : undefined,
      volume: media.volume, canSeek: Number.isFinite(media.duration) && media.duration > 0 && media.seekable.length > 0,
      canPrevious: Boolean(previous), canNext: Boolean(next),
      protectedMedia: Boolean(media.mediaKeys), observed: Boolean(globalThis.__kanbanMusicMedia) }];
  });
}

export async function controlMedia(index, expectedSource, action, value) {
  const media = globalThis.__kanbanMusicMedia
    ? globalThis.__kanbanMusicMedia.entries().find((entry) => entry.index === index)?.media
    : document.querySelectorAll('audio,video')[index];
  const src = media?.currentSrc || (typeof media?.srcObject?.id === 'string' ? `stream:${media.srcObject.id}` : '');
  if (!media || src !== expectedSource) throw new Error('Track changed. Refresh and try again.');
  if (action === 'media.pause') media.pause();
  else if (action === 'media.play') await media.play();
  else if (action === 'media.seek') {
    if (!Number.isFinite(value) || value < 0 || value > 864000 || !media.seekable.length) throw new Error('Seeking unavailable.');
    const position = Math.min(value, Number.isFinite(media.duration) ? media.duration : value);
    let supported = false;
    for (let i = 0; i < media.seekable.length; i++) if (position >= media.seekable.start(i) && position <= media.seekable.end(i)) supported = true;
    if (!supported) throw new Error('Position unavailable.');
    media.currentTime = position;
  }
  else if (action === 'media.volume') {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Invalid volume.');
    media.volume = value; media.muted = value === 0;
  }
  else if (action === 'media.previous' || action === 'media.next') {
    const selector = action === 'media.previous'
      ? '.ytp-prev-button, ytmusic-player-bar .previous-button, [data-testid="control-button-skip-back"], .skipControl__previous, .player-previous'
      : '.ytp-next-button, ytmusic-player-bar .next-button, [data-testid="control-button-skip-forward"], .skipControl__next, .player-next';
    const button = [...document.querySelectorAll(selector)].find(item => !item.disabled && item.getAttribute('aria-disabled') !== 'true' && item.getClientRects().length);
    if (!button) throw new Error('Track navigation unavailable.');
    button.click();
  }
  else throw new Error('Unsupported music command.');
  return true;
}
