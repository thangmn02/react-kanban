import { createInstrumentWorker } from './instrument-runtime.js';
import { beatTelemetry, parseBeatTraces } from './beat-telemetry.js';
const telemetry = beatTelemetry.at('native-instrument');

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
  const pendingTraces = new Map();
  function clear() {
    generation++; ready = false; frames = 0; offset = undefined;
    worker?.stop(); worker = undefined;
    for (const timer of timers) clearTimeout(timer);
    for (const traces of pendingTraces.values()) telemetry.mark('EVENT_DROPPED', traces, { reason: 'stopped' });
    pendingTraces.clear();
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
          if (request !== generation || !ready || !events.length) {
            events.forEach((event) => telemetry.mark('EVENT_DROPPED', parseBeatTraces(event.telemetry), { reason: 'owner' })); return;
          }
          const now = performance.now() / 1000;
          const first = events[0].time;
          if (!Number.isFinite(first) || events.some((event) => !Number.isFinite(event.time) || event.time < first || event.time - first > 3)) {
            events.forEach((event) => telemetry.mark('EVENT_DROPPED', parseBeatTraces(event.telemetry), { reason: 'invalid' })); fail(); return;
          }
          // Retain a small visual reserve across inference batches. Re-anchor
          // only if the worker misses it, rather than jittering every phrase.
          if (offset === undefined || first + offset < now + .02) {
            if (offset !== undefined) events.forEach((event) => telemetry.mark('EVENT_LATE', parseBeatTraces(event.telemetry), { delayMs: (now - first - offset) * 1000 }));
            offset = now + .5 - first;
          }
          if (timers.size + events.length > 256) {
            events.forEach((event) => telemetry.mark('EVENT_DROPPED', parseBeatTraces(event.telemetry), { reason: 'queue-full', queueDepth: timers.size })); fail(); return;
          }
          for (const event of events) {
            const traces = parseBeatTraces(event.telemetry)?.map((trace) => ({ ...trace,
              targetTime: Date.now() + (event.time + offset - now) * 1000, targetClock: 'epoch-ms' }));
            telemetry.mark('EVENT_QUEUED', traces, { queueDepth: timers.size + 1 });
            const timer = setTimeout(() => {
              timers.delete(timer);
              pendingTraces.delete(timer);
              if (request === generation) { telemetry.mark('EVENT_SENT', traces); onMelody(event.state, ...(traces ? [traces] : [])); }
              else telemetry.mark('EVENT_DROPPED', traces, { reason: 'owner' });
            }, Math.max(0, (event.time + offset - now) * 1000));
            timers.add(timer);
            if (traces) pendingTraces.set(timer, traces);
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
