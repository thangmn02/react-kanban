// Local, opt-in diagnostics. Never store PCM, spectra, media metadata or URLs.
const stages = new Set(['CAPTURE_START', 'CAPTURE_STOP', 'AUDIO_DETECTED', 'LOW_ENERGY',
  'LEASE_RENEW', 'LEASE_EXPIRED', 'CAPTURE_RECOVERED', 'EVENT_DETECTED', 'EVENT_QUEUED',
  'EVENT_SENT', 'EVENT_RECEIVED', 'EVENT_LATE', 'EVENT_DROPPED', 'EVENT_ACCEPTED',
  'EVENT_STATE_COMMITTED', 'EVENT_COMMITTED', 'EVENT_RENDERED', 'EVENT_SCHEDULED', 'ANALYSIS_FRAME', 'WORKER_BATCH']);
const sources = new Set(['onset', 'tempo', 'random', 'lifecycle']);
['CACHE_HIT', 'CACHE_MISS', 'ANALYSIS_REQUESTED', 'EVENT_PATH', 'EVENT_REPLACED'].forEach(stage => stages.add(stage));
const types = new Set(['kick', 'snare', 'hat', 'bass', 'melodic', 'generic']);
const components = new Set(['capture-engine', 'offscreen', 'beat-sync', 'widget-bridge',
  'instrument-worker', 'instrument-runtime', 'native-instrument', 'native-audio-engine',
  'native-audio-feed', 'media-bridge', 'beat-controller', 'beat-renderer']);
components.add('native-capture'); components.add('native-widget-bridge');
components.add('beat-scheduler');
components.add('beat-event-engine');
const reasons = new Set(['replaced', 'stopped', 'failed', 'expired', 'silent', 'ended',
  'reconfigured', 'queue-full', 'late', 'owner', 'sequence', 'debounce', 'invalid',
  'not-playing', 'sync-stale', 'clock-disconnected', 'audio-backlog', 'transport',
  'instrument-deadline', 'worker-backlog', 'worker-failed', 'disabled', 'renderer-coalesced',
  'renderer-mask', 'capture-disconnected', 'native-capture-unavailable', 'track-changed',
  'muted', 'native-override', 'clock', 'starting', 'audio-context-stalled']);
reasons.add('delivery-late'); reasons.add('delivery-coalesced');
reasons.add('schedule-reset'); reasons.add('schedule-late'); reasons.add('clock-stale');
reasons.add('buffering');
reasons.add('tempo-selected');
reasons.add('semantic-duplicate'); reasons.add('priority');
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const opaque = (s) => typeof s === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(s);
const canonical = (band) => ({ clap: 'snare', melody: 'melodic' })[band] || band;

export function parseBeatTraces(value) {
  try {
    if (!Array.isArray(value) || value.length > 5) return undefined;
    const result = [];
    for (const t of value) {
      if (!t || !opaque(t.id) || !sources.has(t.source) || !types.has(t.type)
        || !finite(t.detectedAt) || !finite(t.targetTime)
        || !['epoch-ms', 'audio-seconds'].includes(t.targetClock)
        || !(t.confidence === null || finite(t.confidence) && t.confidence >= 0 && t.confidence <= 1)) return undefined;
      result.push({ id: t.id, source: t.source, type: t.type, confidence: t.confidence,
        detectedAt: t.detectedAt, targetTime: t.targetTime, targetClock: t.targetClock,
        ...(typeof t.active === 'boolean' ? { active: t.active } : {}),
        ...(Number.isSafeInteger(t.noteSequence) && t.noteSequence >= 0 ? { noteSequence: t.noteSequence } : {}),
        ...(finite(t.targetPlaybackTime) && t.targetPlaybackTime >= 0 ? { targetPlaybackTime: t.targetPlaybackTime } : {}),
        ...(['cache', 'local', 'degraded'].includes(t.eventSource) ? { eventSource: t.eventSource } : {}),
        ...(opaque(t.captureId) ? { captureId: t.captureId } : {}) });
    }
    return result;
  } catch { return undefined; }
}

export function createBeatTelemetry({ now = Date.now, limit = 2048 } = {}) {
  const capacity = Math.max(1, Math.min(2048, Math.floor(limit) || 2048));
  let enabled = false, prefix, sequence = 0, write = 0, size = 0, evicted = 0;
  const records = new Array(capacity), counts = {};
  const api = {
    enable(value = true) { enabled = value === true; },
    get enabled() { return enabled; },
    clear() { records.fill(undefined); write = size = evicted = 0; for (const key of Object.keys(counts)) delete counts[key]; },
    snapshot() { return { enabled, evicted, counts: { ...counts }, records: Array.from({ length: size }, (_, i) => ({ ...records[(write - size + i + capacity) % capacity] })) }; },
    record(stage, trace, details = {}) {
      if (!enabled || !stages.has(stage)) return;
      try {
        const safe = trace ? parseBeatTraces([trace])?.[0] : undefined;
        const time = now();
        const entry = { stage, at: time, ...safe };
        if (safe?.targetClock === 'epoch-ms') entry.offsetMs = time - safe.targetTime;
        if (components.has(details.component)) entry.component = details.component;
        for (const key of ['queueDepth', 'sequence', 'frames', 'audioTime', 'delayMs', 'durationMs', 'targetPlaybackTime', 'playbackTime', 'offsetMs']) {
          if (finite(details[key])) entry[key] = details[key];
        }
        if (opaque(details.captureId)) entry.captureId = details.captureId;
        if (opaque(details.parentId)) entry.parentId = details.parentId;
        if (reasons.has(details.reason)) entry.reason = details.reason;
        if (['cache', 'local', 'degraded'].includes(details.eventSource)) entry.eventSource = details.eventSource;
        if (stage === 'EVENT_SENT') entry.emittedAt = time;
        if (stage === 'EVENT_COMMITTED' || stage === 'EVENT_STATE_COMMITTED') entry.committedAt = time;
        if (stage === 'EVENT_RENDERED') entry.renderedAt = time;
        records[write] = entry; write = (write + 1) % capacity;
        if (size < capacity) size++; else evicted++;
        counts[stage] = (counts[stage] || 0) + 1;
      } catch { /* Diagnostics must never interrupt audio or rendering. */ }
    },
    events(source, bands, details = {}) {
      if (!enabled || !sources.has(source)) return undefined;
      try {
        prefix ??= crypto.randomUUID();
        const detectedAt = now();
        return bands.slice(0, 5).map(canonical).filter((type) => types.has(type)).map((type) => ({
          id: `${prefix}:${++sequence}`, source, type, confidence: finite(details.confidence) ? Math.max(0, Math.min(1, details.confidence)) : null,
          detectedAt, targetTime: finite(details.targetTime) ? details.targetTime : detectedAt,
          targetClock: details.targetClock === 'audio-seconds' ? 'audio-seconds' : 'epoch-ms',
          ...(typeof details.active === 'boolean' ? { active: details.active } : {}),
          ...(Number.isSafeInteger(details.noteSequence) && details.noteSequence >= 0 ? { noteSequence: details.noteSequence } : {}),
          ...(opaque(details.captureId) ? { captureId: details.captureId } : {}),
        }));
      } catch { return undefined; }
    },
    mark(stage, traces, details) { if (traces?.length) traces.forEach((trace) => api.record(stage, trace, details)); },
    at(component) {
      return { ...api, get enabled() { return api.enabled; }, record(stage, trace, details) { api.record(stage, trace, { ...details, component }); },
        mark(stage, traces, details) { traces?.forEach((trace) => api.record(stage, trace, { ...details, component })); } };
    },
  };
  return api;
}

export const beatTelemetry = createBeatTelemetry();
// Each realm has its own bounded buffer. The extension setting enables its
// background/offscreen realms; the app can enable via ?musicDebug=1 or console.
try {
  beatTelemetry.enable(new URL(globalThis.location.href).searchParams.get('musicDebug') === '1');
  globalThis.__koraBeatTelemetry = beatTelemetry;
} catch { /* A non-browser test environment can configure the recorder directly. */ }
