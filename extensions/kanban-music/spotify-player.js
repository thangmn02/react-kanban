// Spotify's Canvas is an HTML video; its song may be owned by the Web Playback
// SDK. Read the song transport rather than assigning song metadata to Canvas.
(() => {
  if (globalThis.__kanbanSpotifyPlayer) return;
  let anchor;
  let pending, settleTimer;
  const time = (selector) => {
    const text = document.querySelector(selector)?.textContent?.trim();
    if (!text || !/^\d{1,3}:\d{2}(?::\d{2})?$/.test(text)) return undefined;
    const parts = text.split(':').map(Number);
    if (parts.slice(1).some(value => value >= 60)) return undefined;
    return parts.reduce((total, value) => total * 60 + value, 0);
  };
  const button = (name) => {
    const element = document.querySelector(`[data-testid="control-button-${name}"]`);
    return element && !element.disabled && element.getAttribute('aria-disabled') !== 'true' ? element : undefined;
  };
  const player = new EventTarget();
  let lastSnapshot, snapshotAt;
  player.identity = () => {
    let url; try { url = new URL(document.querySelector('[data-testid="nowplaying-track-link"]')?.href); } catch { return undefined; }
    return url.origin === 'https://open.spotify.com' && /^\/(track|episode)\/[A-Za-z0-9]{22}$/.test(url.pathname) ? url.origin + url.pathname : undefined;
  };
  player.audio = (snapshot) => {
    if (!snapshot) return undefined;
    const matches = (globalThis.__kanbanMusicMedia?.mediaEntries() || []).filter(media => media instanceof HTMLAudioElement
      && media.currentSrc && !media.ended && media.readyState > 0 && media.paused === snapshot.paused
      && Math.abs(media.duration - snapshot.duration) < 2 && Math.abs(media.currentTime - snapshot.currentTime) < 1.5);
    return matches.length === 1 ? matches[0] : undefined;
  };
  const read = () => {
    if (location.hostname !== 'open.spotify.com') return undefined;
    const link = document.querySelector('[data-testid="nowplaying-track-link"]');
    let url; try { url = new URL(link?.href); } catch { return undefined; }
    if (url.origin !== 'https://open.spotify.com' || !/^\/(track|episode)\/[A-Za-z0-9]{22}$/.test(url.pathname)) return undefined;
    const position = time('[data-testid="playback-position"]');
    const duration = time('[data-testid="playback-duration"]');
    const toggle = button('playpause');
    if (!toggle || position === undefined || !duration || position > duration) return undefined;
    const state = navigator.mediaSession?.playbackState;
    const label = toggle.getAttribute('aria-label') || '';
    const paused = state === 'paused' ? true : state === 'playing' ? false
      : /^(play|phát)(?:\s|$)/i.test(label) ? true : /^(pause|tạm dừng)(?:\s|$)/i.test(label) ? false : undefined;
    if (paused === undefined) return undefined;
    const sampledAt = Date.now(), src = url.origin + url.pathname;
    // Spotify can replace the link and counters in separate React commits.
    // Resample a changed transport tuple after a short settling interval.
    if (anchor && anchor.src !== src) {
      if (!pending || pending.src !== src) pending = { src, position, duration, since: sampledAt, until: sampledAt + 2000 };
      else if (pending.position !== position || pending.duration !== duration) Object.assign(pending, { position, duration, since: sampledAt });
      if (position === anchor.raw && duration === anchor.duration || sampledAt - pending.since < 200) {
        clearTimeout(settleTimer);
        if (sampledAt < pending.until) settleTimer = setTimeout(() => player.snapshot(), 100);
        return undefined;
      }
    }
    clearTimeout(settleTimer); pending = undefined;
    // The visible counter has one-second precision. Interpolate within that
    // second, and stop advancing if it stalls. A normal counter tick must not
    // look like a seek and restart audio analysis every second.
    const predicted = anchor ? anchor.position + (!anchor.paused ? (sampledAt - anchor.at) / 1000 : 0) : position;
    const changed = !anchor || anchor.src !== src || position !== anchor.raw && Math.abs(position - predicted) > 1.5;
    if (changed) anchor = { src, duration, raw: position, position: Math.min(duration, position + (paused ? 0 : .5)), at: sampledAt,
      changedAt: sampledAt, paused, generation: (anchor?.generation || 0) + 1 };
    else if (position !== anchor.raw || paused !== anchor.paused) anchor = { ...anchor, raw: position,
      position: Math.max(position, Math.min(position + .999, predicted)), at: sampledAt,
      changedAt: sampledAt, paused };
    const buffering = !paused && sampledAt - anchor.changedAt > 2000;
    const currentTime = Math.min(duration, position + .999, anchor.position + (!paused ? Math.max(0, sampledAt - anchor.at) / 1000 : 0));
    const snapshot = { src, assetUrl: src, title: (link.textContent?.trim() || navigator.mediaSession?.metadata?.title || document.title).slice(0, 500),
      artist: (navigator.mediaSession?.metadata?.artist || '').slice(0, 500), source: location.hostname,
      currentTime, duration, paused, playing: !paused && !buffering && position < duration, buffering,
      seeking: false, generation: anchor.generation, playbackRate: 1, sampledAt,
      muted: false, canSeek: false, canPrevious: Boolean(button('skip-back')), canNext: Boolean(button('skip-forward')), observed: true };
    const audio = player.audio(snapshot);
    if (audio) Object.assign(snapshot, { volume: audio.volume, muted: audio.muted || audio.volume === 0, canSeek: audio.seekable.length > 0 });
    return snapshot;
  };
  player.snapshot = () => {
    const snapshot = read();
    if (snapshot) { lastSnapshot = snapshot; snapshotAt = Date.now(); return snapshot; }
    const sampledAt = Date.now(), identity = player.identity();
    if (!lastSnapshot || sampledAt - snapshotAt > 750 || identity && identity !== lastSnapshot.src) return undefined;
    const paused = navigator.mediaSession?.playbackState === 'paused' || lastSnapshot.paused;
    return { ...lastSnapshot, paused, playing: lastSnapshot.playing && !paused, sampledAt,
      currentTime: Math.min(lastSnapshot.duration, lastSnapshot.currentTime + (paused ? 0 : (sampledAt - lastSnapshot.sampledAt) / 1000)) };
  };
  player.control = (src, action) => {
    const snapshot = player.snapshot();
    if (!snapshot || snapshot.src !== src) throw new Error('Track changed. Refresh and try again.');
    const name = action === 'media.previous' ? 'skip-back' : action === 'media.next' ? 'skip-forward'
      : ['media.play', 'media.pause'].includes(action) ? 'playpause' : undefined;
    if (!name) throw new Error('Playback control unavailable.');
    if (action === 'media.play' && !snapshot.paused || action === 'media.pause' && snapshot.paused) return true;
    const target = button(name);
    if (!target) throw new Error('Playback control unavailable.');
    target.click(); return true;
  };
  globalThis.__kanbanSpotifyPlayer = player;
  player.dispose = () => { clearTimeout(settleTimer); };
})();
