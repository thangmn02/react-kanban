// MAIN-world, document-start hook. Some players keep new Audio() outside the
// DOM. Observe standard media APIs, not site-specific controls or page state.
(() => {
  if (globalThis.__kanbanMusicMedia?.version === 5) return;
  globalThis.__kanbanMusicMedia?.dispose();
  const entries = new Map();
  const ids = new WeakMap();
  let nextId = 0;
  let watcher;
  const track = (media) => {
    if (!(media instanceof HTMLMediaElement)) return;
    if (!ids.has(media)) ids.set(media, nextId++);
    entries.set(ids.get(media), new WeakRef(media));
  };
  const source = (media) => media.currentSrc || (typeof media.srcObject?.id === 'string' ? `stream:${media.srcObject.id}` : '');
  const list = () => {
    document.querySelectorAll('audio,video').forEach(track);
    // The SDK song transport owns Spotify identity and time. Retained media
    // and decorative videos must never inherit the current song metadata.
    const spotify = globalThis.__kanbanSpotifyPlayer;
    const song = spotify?.snapshot();
    if (song) return [{ index: 2147483647, media: spotify }];
    if (location.hostname === 'open.spotify.com' && spotify?.identity()) return [];
    return Array.from(entries).flatMap(([index, reference]) => {
      const media = reference.deref();
      if (!media) { entries.delete(index); return []; }
      return [{ index, media }];
    });
  };
  // Muted or silent media (YouTube's hover previews on Home) is not a second sound source.
  const silent = media => media.paused || media.ended || media.muted || media.volume === 0;
  // The facts query the page, which YouTube is busy rebuilding while it navigates. The 100 ms clock reuses them for
  // up to a second; a media event on the watched element refreshes them at once.
  let cachedFacts;
  const sourceFacts = (media, maxAgeMs = 0) => {
    if (cachedFacts?.media === media && Date.now() - cachedFacts.at < maxAgeMs) return cachedFacts.facts;
    const facts = {
      kind: media?.tagName === 'AUDIO' ? 'audio-only' : media?.tagName === 'VIDEO' ? 'video' : 'unknown',
      noVideo: !document.querySelector('video'), noFrames: !document.querySelector('iframe,frame'),
      singleSource: list().every(entry => entry.media === media || silent(entry.media)),
    };
    cachedFacts = { media, at: Date.now(), facts };
    return facts;
  };
  // Video colours. A few 16×16 frames of the playing YouTube video, read on this device only, give a hue histogram
  // that Kora turns into Beat Grid colours. No frame or pixel leaves the page: only 36 numbers do. Sampling runs every
  // 2.5 s of visible playback, stops once the main colour holds for three samples after 30 s, and never past 45 s.
  // Keep hueBins in step with hueBins in src/features/music/video-palette.ts.
  const PALETTE_MS = 2500, PALETTE_SETTLE_MS = 30000, PALETTE_LIMIT_MS = 45000;
  const toLinear = value => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const hueBins = (rgba, bins = new Array(36).fill(0)) => {
    for (let index = 0; index + 3 < rgba.length; index += 4) {
      if (rgba[index + 3] < 128) continue;
      const r = toLinear(rgba[index]), g = toLinear(rgba[index + 1]), b = toLinear(rgba[index + 2]);
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
        s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
      const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s, C = Math.hypot(A, B);
      if (C < 0.03 || L < 0.18 || L > 0.95) continue;
      bins[Math.floor(((Math.atan2(B, A) * 180 / Math.PI + 360) % 360) / 10) % 36] += C * C * Math.min(1, (L - 0.18) / 0.2);
    }
    return bins;
  };
  const uniform = rgba => {
    let low = 255, high = 0;
    for (let index = 0; index + 3 < rgba.length; index += 4) for (let channel = 0; channel < 3; channel++) { low = Math.min(low, rgba[index + channel]); high = Math.max(high, rgba[index + channel]); }
    return high - low < 10;
  };
  const palette = { media: undefined, src: '', bins: undefined, pixels: 0, playedMs: 0, blank: 0, top: -1, steady: 0, done: false, timer: undefined, busy: false };
  const stopPalette = () => { clearInterval(palette.timer); palette.timer = undefined; };
  const readFrame = async media => {
    const bitmap = await createImageBitmap(media, { resizeWidth: 16, resizeHeight: 16, resizeQuality: 'low' });
    try {
      const canvas = new OffscreenCanvas(16, 16), context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0);
      return context.getImageData(0, 0, 16, 16).data;
    } finally { bitmap.close(); }
  };
  const samplePalette = async () => {
    const media = palette.media?.deref();
    if (!media || palette.done || source(media) !== palette.src) { stopPalette(); return; }
    if (palette.busy || document.hidden || media.paused || media.ended || media.readyState < 2 || document.querySelector('.ad-showing')) return;
    palette.playedMs += PALETTE_MS;
    if (palette.playedMs > PALETTE_LIMIT_MS) { palette.done = true; stopPalette(); return; }
    palette.busy = true;
    let frame;
    try { frame = await readFrame(media); } catch { palette.blank = 3; } finally { palette.busy = false; }
    // Protected (DRM) or blocked frames read as black or one flat colour. Three of them: keep the thumbnail colours.
    if (!frame || uniform(frame)) { if (++palette.blank >= 3) { palette.done = true; stopPalette(); } return; }
    palette.bins = hueBins(frame, palette.bins);
    palette.pixels += 256;
    const top = palette.bins.indexOf(Math.max(...palette.bins));
    palette.steady = top === palette.top ? palette.steady + 1 : 0;
    palette.top = top;
    if (palette.steady >= 2 && palette.playedMs >= PALETTE_SETTLE_MS) { palette.done = true; stopPalette(); }
  };
  /** The colours collected so far for this player, starting collection when wanted. */
  const videoPalette = (media, wanted) => {
    if (!wanted || !media || media.tagName !== 'VIDEO' || !/(^|\.)youtube\.com$/.test(location.hostname)) { stopPalette(); return undefined; }
    const src = source(media);
    if (palette.src !== src) {
      stopPalette();
      Object.assign(palette, { media: new WeakRef(media), src, bins: undefined, pixels: 0, playedMs: 0, blank: 0, top: -1, steady: 0, done: false });
    }
    if (!palette.done && !palette.timer && typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function') palette.timer = setInterval(samplePalette, PALETTE_MS);
    return palette.bins ? { bins: palette.bins.map(value => Math.round(value * 1e5) / 1e5), pixels: palette.pixels, done: palette.done } : palette.done ? { done: true } : undefined;
  };
  // A media element's generation only goes up, across watchers too: Kora keeps the highest generation it has seen for
  // a player and ignores lower ones. A new song on the same element (same player, new source) starts a new generation,
  // so its capture is not mistaken for an older one.
  const generations = new WeakMap();
  const nextGeneration = (media, src) => {
    if (!media || typeof media !== 'object') return 0;
    const known = generations.get(media), value = !known ? 0 : known.src === src ? known.value : known.value + 1;
    generations.set(media, { src, value });
    return value;
  };
  const stop = () => {
    if (!watcher) return;
    clearInterval(watcher.interval);
    watcher.events.forEach((name) => watcher.media.removeEventListener(name, watcher.report));
    watcher = undefined;
  };
  const receive = (event) => {
    let message;
    try { message = JSON.parse(event.detail); } catch { return; }
    if (message?.kind === 'stop') { if (watcher?.token === message.token) stop(); return; }
    if (message?.kind === 'lease') {
      if (watcher?.token === message.token) watcher.leaseUntil = Date.now() + 6000;
      return;
    }
    if (message?.kind !== 'watch' || !Number.isInteger(message.index) || typeof message.token !== 'string' || typeof message.src !== 'string') return;
    stop();
    const media = message.index === 2147483647 ? globalThis.__kanbanSpotifyPlayer : entries.get(message.index)?.deref();
    const state = { media, token: message.token, leaseUntil: Date.now() + 6000, generation: nextGeneration(media, message.src), buffering: false,
      events: ['play', 'playing', 'pause', 'waiting', 'seeking', 'seeked', 'ended', 'emptied', 'ratechange', 'volumechange'] };
    state.report = (event) => {
      if (watcher !== state) return;
      if (Date.now() > state.leaseUntil) { stop(); return; }
      if (event?.target === media) {
        cachedFacts = undefined;
        if (event.type === 'seeking' || event.type === 'emptied') { state.generation++; if (media) generations.set(media, { src: message.src, value: state.generation }); }
        if (event.type === 'waiting') state.buffering = true;
        if (event.type === 'playing' || event.type === 'seeked') state.buffering = false;
      }
      // Detached does not mean unavailable. The identity/source is the guard.
      const snapshot = media?.snapshot?.();
      const identity = media?.identity?.();
      const valid = media?.snapshot ? Boolean(snapshot && snapshot.src === message.src && (!identity || identity === message.src)) : Boolean(media && source(media) && source(media) === message.src && !media.ended);
      const clock = snapshot || media && !media.snapshot && { currentTime: Number.isFinite(media.currentTime) ? media.currentTime : 0,
        playbackRate: media.playbackRate, sampledAt: Date.now(), paused: media.paused,
        playing: valid && !media.paused && !media.seeking && !state.buffering && media.readyState >= 3,
        seeking: media.seeking, buffering: state.buffering || media.readyState < 3, generation: state.generation,
        muted: media.muted || media.volume === 0, protectedMedia: Boolean(media.mediaKeys), mediaFacts: sourceFacts(media, 1000) };
      document.dispatchEvent(new CustomEvent('kanban-music-media-clock', { detail: JSON.stringify({ token: state.token, valid, clock }) }));
      if (!valid) stop();
    };
    watcher = state;
    if (media) state.events.forEach((name) => media.addEventListener(name, state.report));
    state.interval = setInterval(state.report, 100);
    state.report();
  };
  // The number a site's own slider shows, and a way to move that slider, so Kora, the site and the site's stored
  // preference agree. Sites map the slider to loudness differently (YouTube Music: 50 is 20% loud) and ignore volume
  // set on the element from outside. Returns undefined where no adapter applies; the element is used then.
  const unit = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : undefined;
  const siteVolume = (media) => {
    const host = location.hostname, player = document.querySelector('#movie_player');
    if (host === 'music.youtube.com') {
      const slider = document.querySelector('ytmusic-player-bar #volume-slider, #volume-slider');
      if (!slider || !Number.isFinite(Number(slider.value)) || !media.closest?.('#movie_player, ytmusic-player')) return undefined;
      return { get: () => unit(Number(slider.value) / 100), set: (value) => {
        if (value > 0) player?.unMute?.();
        slider.value = Math.round(value * 100);
        slider.dispatchEvent(new CustomEvent('change', { bubbles: true }));
        media.muted = value === 0;
      } };
    }
    if (/(^|\.)youtube\.com$/.test(host)) {
      if (typeof player?.setVolume !== 'function' || typeof player.getVolume !== 'function' || !player.contains(media)) return undefined;
      return { get: () => unit(player.getVolume() / 100), set: (value) => {
        // Muting keeps the site's level, so unmuting on either side returns to it.
        if (value === 0) { player.mute?.(); return; }
        player.unMute?.(); player.setVolume(Math.round(value * 100));
      } };
    }
    if (/(^|\.)soundcloud\.com$/.test(host)) {
      const slider = document.querySelector('.volume__sliderWrapper'), track = document.querySelector('.volume__sliderBackground');
      const now = () => unit(Number.parseFloat(slider.getAttribute('aria-valuenow')));
      if (!slider || !track || now() === undefined) return undefined;
      return { get: now, set: (value) => {
        // The slider answers to its own pointer handling only. Aim, read what it shows, and correct for its offset.
        let aim = value;
        for (let attempt = 0; attempt < 3; attempt++) {
          const box = track.getBoundingClientRect();
          if (!box.height) throw new Error('Volume unavailable.');
          const at = { bubbles: true, cancelable: true, button: 0, clientX: box.left + box.width / 2, clientY: box.bottom - box.height * aim };
          slider.dispatchEvent(new MouseEvent('mousedown', { ...at, buttons: 1 }));
          document.dispatchEvent(new MouseEvent('mousemove', { ...at, buttons: 1 }));
          document.dispatchEvent(new MouseEvent('mouseup', at));
          const error = now() - value;
          if (!(Math.abs(error) > .005)) break;
          aim -= error;
        }
        slider.closest('.volume')?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
        media.muted = value === 0;
      } };
    }
    if (host === 'open.spotify.com') {
      const range = document.querySelector('[data-testid="volume-bar"] input[type="range"]');
      const max = Number(range?.max) || 1;
      if (!range || unit(Number(range.value) / max) === undefined) return undefined;
      return { get: () => unit(Number(range.value) / max), set: (value) => {
        // React listens for the native setter, not for a plain assignment.
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(range, String(value * max));
        range.dispatchEvent(new Event('input', { bubbles: true })); range.dispatchEvent(new Event('change', { bubbles: true }));
      } };
    }
    return undefined;
  };
  const originalPlay = HTMLMediaElement.prototype.play;
  const observedPlay = function (...args) { track(this); return Reflect.apply(originalPlay, this, args); };
  HTMLMediaElement.prototype.play = observedPlay;
  const OriginalAudio = globalThis.Audio;
  const ObservedAudio = new Proxy(OriginalAudio, {
    construct(target, args, newTarget) { const media = Reflect.construct(target, args, newTarget); track(media); return media; },
    apply(target, receiver, args) { const media = Reflect.apply(target, receiver, args); track(media); return media; },
  });
  globalThis.Audio = ObservedAudio;
  document.addEventListener('kanban-music-media-watch', receive);
  globalThis.__kanbanMusicMedia = { version: 5, siteVolume, entries: list, sourceFacts, videoPalette, hueBins,
    mediaEntries: () => Array.from(entries.values()).flatMap(reference => reference.deref() ? [reference.deref()] : []),
    dispose() {
      stop();
      stopPalette();
      document.removeEventListener('kanban-music-media-watch', receive);
      if (this.controlListener) document.removeEventListener('kanban-music-control', this.controlListener);
      if (HTMLMediaElement.prototype.play === observedPlay) HTMLMediaElement.prototype.play = originalPlay;
      if (globalThis.Audio === ObservedAudio) globalThis.Audio = OriginalAudio;
      delete globalThis.__kanbanMusicMedia;
    },
  };
})();
