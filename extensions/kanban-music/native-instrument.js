import { createInstrumentWorker } from './instrument-runtime.js';

const preference = 'kora.native.instrument-notes';
let enabled = false;
try { enabled = localStorage.getItem(preference) === 'true'; } catch { /* Private storage can be unavailable. */ }
let status = enabled ? 'waiting' : 'off', active;
const listeners = new Set();
const update = (value) => { status = value; for (const listener of listeners) listener(); };
export const getNativeInstrumentStatus = () => status;
export function subscribeNativeInstrument(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function setNativeInstrumentEnabled(value) {
  enabled = value;
  try { localStorage.setItem(preference, String(value)); } catch { /* Analysis still works without persistence. */ }
  active?.restart();
  if (!active) update(enabled ? 'waiting' : 'off');
}

// Native loopback cannot suppress and delay the browser's original audio.
// Preserve the AI's attack spacing on a delayed visual timeline instead.
export function createNativeInstrument(onMelody, workerFactory = createInstrumentWorker) {
  let worker, ready = false, frames = 0, generation = 0, offset;
  const timers = new Set();
  function clear() {
    generation++; ready = false; frames = 0; offset = undefined;
    worker?.stop(); worker = undefined;
    for (const timer of timers) clearTimeout(timer);
    timers.clear(); onMelody({ active: false, level: 0, note: 0 });
  }
  function fail() { clear(); update('failed'); }
  function restart() {
    clear();
    if (!enabled) { update('off'); return; }
    update('loading');
    const request = generation;
    try {
      worker = workerFactory({
        workerUrl: new URL('/music-analysis/generated/instrument-worker.js', window.location.href),
        progress: (bytes, total) => { if (request === generation) update(`loading:${Math.round(bytes / total * 100)}`); },
        error: () => { if (request === generation) fail(); },
        notes: (events) => {
          if (request !== generation || !ready || !events.length) return;
          const now = performance.now() / 1000;
          const first = events[0].time;
          if (!Number.isFinite(first) || events.some((event) => !Number.isFinite(event.time) || event.time < first || event.time - first > 3)) { fail(); return; }
          // Retain a small visual reserve across inference batches. Re-anchor
          // only if the worker misses it, rather than jittering every phrase.
          if (offset === undefined || first + offset < now + .02) offset = now + .5 - first;
          if (timers.size + events.length > 256) { fail(); return; }
          for (const event of events) {
            const timer = setTimeout(() => {
              timers.delete(timer);
              if (request === generation) onMelody(event.state);
            }, Math.max(0, (event.time + offset - now) * 1000));
            timers.add(timer);
          }
        },
      });
      worker.ready.then(() => { if (request === generation) { ready = true; update('ready'); } })
        .catch(() => { if (request === generation) fail(); });
    } catch { fail(); }
  }
  const control = { restart };
  active = control; restart();
  return {
    push(left, right) {
      if (!ready) return;
      for (let at = 0; at < left.length && ready; at += 4096) {
        const end = Math.min(left.length, at + 4096);
        worker.send({ kind: 'pcm', left: left.slice(at, end), right: right.slice(at, end), startFrame: frames });
        frames += end - at;
      }
    },
    stop() {
      clear();
      if (active === control) { active = undefined; update(enabled ? 'waiting' : 'off'); }
    },
  };
}
