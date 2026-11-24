import { useEffect, useMemo, useState } from 'react';
import type { BrowserMusicSession } from './mediaBridge';
import { hueBins, huePeaks, type HueBins } from './video-palette';

const SAMPLE = 16;
const thumbnails = new Map<string, Promise<HueBins | null>>();
const MAX_THUMBNAILS = 64;

/** A 16×16 read of the track's cover, from hosts that allow it (YouTube, SoundCloud, Spotify, Apple Music…). Seeds colours before video frames. */
function thumbnailBins(source: string): Promise<HueBins | null> {
  const known = thumbnails.get(source);
  if (known) return known;
  const loading = new Promise<HueBins | null>(resolve => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') { resolve(null); return; }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE; canvas.height = SAMPLE;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) { resolve(null); return; }
        context.drawImage(image, 0, 0, SAMPLE, SAMPLE);
        resolve(hueBins(context.getImageData(0, 0, SAMPLE, SAMPLE).data));
      } catch { resolve(null); }
    };
    image.onerror = () => resolve(null);
    image.src = source;
  });
  thumbnails.set(source, loading);
  if (thumbnails.size > MAX_THUMBNAILS) thumbnails.delete(thumbnails.keys().next().value!);
  return loading;
}

/**
 * Hues for the playing track, strongest first, or none (the Kora palette then stays). Video frames collected by the
 * Companion win over the thumbnail once they hold colour.
 */
export function useVideoPalette(session: BrowserMusicSession | undefined, enabled: boolean): number[] {
  const videoId = enabled && session?.asset?.provider === 'youtube' && /^[\w-]{6,20}$/.test(session.asset.id) ? session.asset.id : undefined;
  const cover = videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg` : enabled && session?.artwork?.startsWith('https:') ? session.artwork : undefined;
  const [thumbnail, setThumbnail] = useState<{ id: string; bins: HueBins | null }>();
  useEffect(() => {
    if (!cover) return;
    let current = true;
    void thumbnailBins(cover).then(bins => { if (current) setThumbnail({ id: cover, bins }); });
    return () => { current = false; };
  }, [cover]);
  const frames = enabled ? session?.palette : undefined;
  const framesKey = frames ? JSON.stringify(frames) : '';
  const thumbnailBinsForTrack = thumbnail?.id === cover ? thumbnail?.bins : null;
  return useMemo(() => {
    if (!enabled) return [];
    const fromFrames = frames ? huePeaks(frames.bins, frames.pixels) : [];
    if (fromFrames.length) return fromFrames;
    return thumbnailBinsForTrack ? huePeaks(thumbnailBinsForTrack, SAMPLE * SAMPLE) : [];
  // framesKey stands for the frames object, which arrives as a new object every poll.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, framesKey, thumbnailBinsForTrack]);
}
