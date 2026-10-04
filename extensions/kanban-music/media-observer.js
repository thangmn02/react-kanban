// MAIN-world, document-start hook. Some players keep new Audio() outside the
// DOM. Observe standard media APIs, not site-specific controls or page state.
(() => {
  if (globalThis.__kanbanMusicMedia?.version === 1) return;
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
    return Array.from(entries).flatMap(([index, reference]) => {
      const media = reference.deref();
      if (!media) { entries.delete(index); return []; }
      return [{ index, media }];
    });
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
    if (message?.kind === 'stop') { stop(); return; }
    if (message?.kind === 'lease') {
      if (watcher?.token === message.token) watcher.leaseUntil = Date.now() + 6000;
      return;
    }
    if (message?.kind !== 'watch' || !Number.isInteger(message.index) || typeof message.token !== 'string' || typeof message.src !== 'string') return;
    stop();
    const media = entries.get(message.index)?.deref();
    const state = { media, token: message.token, leaseUntil: Date.now() + 6000,
      events: ['play', 'playing', 'pause', 'waiting', 'seeking', 'seeked', 'ended', 'emptied', 'ratechange', 'volumechange'] };
    state.report = () => {
      if (watcher !== state) return;
      if (Date.now() > state.leaseUntil) { stop(); return; }
      // Detached does not mean unavailable. The identity/source is the guard.
      const valid = Boolean(media && source(media) && source(media) === message.src && !media.ended);
      const clock = media && { currentTime: Number.isFinite(media.currentTime) ? media.currentTime : 0,
        playbackRate: media.playbackRate, sampledAt: Date.now(), paused: media.paused,
        playing: valid && !media.paused && !media.seeking && media.readyState >= 3,
        muted: media.muted || media.volume === 0, protectedMedia: Boolean(media.mediaKeys) };
      document.dispatchEvent(new CustomEvent('kanban-music-media-clock', { detail: JSON.stringify({ token: state.token, valid, clock }) }));
      if (!valid) stop();
    };
    watcher = state;
    if (media) state.events.forEach((name) => media.addEventListener(name, state.report));
    state.interval = setInterval(state.report, 100);
    state.report();
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
  globalThis.__kanbanMusicMedia = { version: 1, entries: list,
    dispose() {
      stop();
      document.removeEventListener('kanban-music-media-watch', receive);
      if (HTMLMediaElement.prototype.play === observedPlay) HTMLMediaElement.prototype.play = originalPlay;
      if (globalThis.Audio === ObservedAudio) globalThis.Audio = OriginalAudio;
      delete globalThis.__kanbanMusicMedia;
    },
  };
})();
