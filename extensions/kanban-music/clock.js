// Installed only on supported media sites; activated for one selected element.
(() => {
try { globalThis.__kanbanMusicClock?.dispose(); } catch { /* Previous extension context was reloaded. */ }
let watcher;
function stopClock() {
  if (!watcher) return;
  clearInterval(watcher.interval);
  watcher.events.forEach((name) => document.removeEventListener(name, watcher.report, true));
  watcher = undefined;
}

const receive = (message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.target !== 'beat-clock') return false;
  if (message.kind === 'stop') { stopClock(); respond({ ok: true }); return false; }
  if (message.kind === 'lease') {
    const ok = watcher?.token === message.token;
    if (ok) watcher.leaseUntil = Date.now() + 6000;
    respond({ ok }); return false;
  }
  if (message.kind !== 'watch' || !Number.isInteger(message.index) || typeof message.token !== 'string') return false;
  stopClock();
  const media = document.querySelectorAll('audio,video')[message.index];
  if (!media) { respond({ ok: false }); return false; }
  const state = { token: message.token, leaseUntil: Date.now() + 6000,
    events: ['play', 'playing', 'pause', 'waiting', 'seeking', 'seeked', 'ended', 'emptied', 'ratechange', 'volumechange'] };
  state.report = () => {
    if (watcher !== state) return;
    if (Date.now() > state.leaseUntil) { stopClock(); return; }
    const valid = media.isConnected && document.querySelectorAll('audio,video')[message.index] === media && Boolean(media.currentSrc) && !media.ended;
    void chrome.runtime.sendMessage({ target: 'beat-worker', kind: 'clock', token: state.token, valid,
      clock: { currentTime: Number.isFinite(media.currentTime) ? media.currentTime : 0,
        playbackRate: media.playbackRate, sampledAt: Date.now(), paused: media.paused,
        playing: valid && !media.paused && !media.seeking && media.readyState >= 3,
        muted: media.muted || media.volume === 0 } }).catch(() => { if (watcher === state) stopClock(); });
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
globalThis.__kanbanMusicClock = { dispose() { stopClock(); chrome.runtime.onMessage.removeListener(receive); } };
})();
