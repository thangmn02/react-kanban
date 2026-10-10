// Installed only on supported media sites; activated for one selected element.
(() => {
try { if (globalThis.__kanbanMusicClock?.active()) return; globalThis.__kanbanMusicClock?.dispose(); } catch { /* Previous extension context was reloaded. */ }
let watcher;
function stopClock() {
  if (!watcher) return;
  clearInterval(watcher.interval);
  watcher.events.forEach((name) => document.removeEventListener(name, watcher.report, true));
  if (watcher.bridge) {
    document.removeEventListener('kanban-music-media-clock', watcher.report);
    document.dispatchEvent(new CustomEvent('kanban-music-media-watch', { detail: JSON.stringify({ kind: 'stop' }) }));
  }
  watcher = undefined;
}

const receive = (message, sender, respond) => {
  if (sender.id === chrome.runtime.id && message?.target === 'media-control') {
    const token = crypto.randomUUID();
    const complete = (ok) => { clearTimeout(timeout); document.removeEventListener('kanban-music-control-result', result); respond({ ok }); };
    const result = (event) => {
      let response; try { response = JSON.parse(event.detail); } catch { return; }
      if (response?.token === token) complete(response.ok === true);
    };
    const timeout = setTimeout(() => complete(false), 4000);
    document.addEventListener('kanban-music-control-result', result);
    document.dispatchEvent(new CustomEvent('kanban-music-control', { detail: JSON.stringify({
      token, index: message.index, src: message.src, action: message.action, value: message.value,
    }) }));
    return true;
  }
  if (sender.id !== chrome.runtime.id || message?.target !== 'beat-clock') return false;
  if (message.kind === 'stop') { stopClock(); respond({ ok: true }); return false; }
  if (message.kind === 'lease') {
    const ok = watcher?.token === message.token;
    if (ok) {
      watcher.leaseUntil = Date.now() + 6000;
      if (watcher.bridge) document.dispatchEvent(new CustomEvent('kanban-music-media-watch', { detail: JSON.stringify({ kind: 'lease', token: message.token }) }));
    }
    respond({ ok }); return false;
  }
  if (message.kind !== 'watch' || !Number.isInteger(message.index) || typeof message.token !== 'string') return false;
  stopClock();
  if (message.observed === true && typeof message.src === 'string') {
    const state = { bridge: true, token: message.token, events: [], leaseUntil: Date.now() + 6000 };
    state.report = (event) => {
      if (watcher !== state || typeof event.detail !== 'string' || event.detail.length > 4000) return;
      if (Date.now() > state.leaseUntil) { stopClock(); return; }
      let sample;
      try { sample = JSON.parse(event.detail); } catch { return; }
      if (sample?.token !== state.token || typeof sample.valid !== 'boolean') return;
      void chrome.runtime.sendMessage({ target: 'beat-worker', kind: 'clock', token: state.token,
        valid: sample.valid, clock: sample.clock }).catch(() => { if (watcher === state) stopClock(); });
      if (!sample.valid) stopClock();
    };
    watcher = state;
    document.addEventListener('kanban-music-media-clock', state.report);
    state.interval = setInterval(() => { if (watcher === state && Date.now() > state.leaseUntil) stopClock(); }, 1000);
    document.dispatchEvent(new CustomEvent('kanban-music-media-watch', { detail: JSON.stringify({ kind: 'watch', index: message.index, src: message.src, token: message.token }) }));
    respond({ ok: watcher === state });
    return false;
  }
  const media = document.querySelectorAll('audio,video')[message.index];
  if (!media) { respond({ ok: false }); return false; }
  const state = { token: message.token, leaseUntil: Date.now() + 6000, generation: 0, buffering: false,
    events: ['play', 'playing', 'pause', 'waiting', 'seeking', 'seeked', 'ended', 'emptied', 'ratechange', 'volumechange'] };
  state.report = (event) => {
    if (watcher !== state) return;
    if (Date.now() > state.leaseUntil) { stopClock(); return; }
    if (event?.target === media) {
      if (event.type === 'seeking' || event.type === 'emptied') state.generation++;
      if (event.type === 'waiting') state.buffering = true;
      if (event.type === 'playing' || event.type === 'seeked') state.buffering = false;
    }
    const valid = media.isConnected && document.querySelectorAll('audio,video')[message.index] === media && Boolean(media.currentSrc || media.srcObject?.id) && !media.ended;
    void chrome.runtime.sendMessage({ target: 'beat-worker', kind: 'clock', token: state.token, valid,
      clock: { currentTime: Number.isFinite(media.currentTime) ? media.currentTime : 0,
        playbackRate: media.playbackRate, sampledAt: Date.now(), paused: media.paused,
        playing: valid && !media.paused && !media.seeking && !state.buffering && media.readyState >= 3,
        seeking: media.seeking, buffering: state.buffering || media.readyState < 3, generation: state.generation,
        muted: media.muted || media.volume === 0, protectedMedia: Boolean(media.mediaKeys) } }).catch(() => { if (watcher === state) stopClock(); });
    if (!valid) stopClock();
  };
  watcher = state;
  state.events.forEach((name) => document.addEventListener(name, state.report, true));
  state.interval = setInterval(state.report, 100);
  state.report();
  respond({ ok: true });
  return false;
};
chrome.runtime.onMessage.addListener(receive);
globalThis.__kanbanMusicClock = { active() { return Boolean(chrome.runtime.id); }, dispose() { stopClock(); chrome.runtime.onMessage.removeListener(receive); } };
})();
