// Local, opt-in diagnostics. Never store PCM, spectra, media metadata or URLs.
const stages = new Set(['CAPTURE_START', 'CAPTURE_STOP', 'AUDIO_DETECTED', 'LOW_ENERGY',
  'LEASE_RENEW', 'LEASE_EXPIRED', 'CAPTURE_RECOVERED', 'EVENT_DETECTED', 'EVENT_QUEUED',
  'EVENT_SENT', 'EVENT_RECEIVED', 'EVENT_LATE', 'EVENT_DROPPED', 'EVENT_ACCEPTED',
  'EVENT_STATE_COMMITTED', 'EVENT_COMMITTED', 'EVENT_RENDERED', 'EVENT_SCHEDULED', 'ANALYSIS_FRAME', 'WORKER_BATCH']);
const sources = new Set(['onset', 'tempo', 'random', 'lifecycle']);
['CACHE_HIT', 'CACHE_MISS', 'ANALYSIS_REQUESTED', 'EVENT_PATH', 'EVENT_REPLACED', 'LEAD_EVENT'].forEach(stage => stages.add(stage));
stages.add('PREVIEW_REVOKED');
stages.add('CAPTURE_REPLACED');
stages.add('DETECTOR_TIMING');
stages.add('OUTPUT_ROUTE_CHANGED');
stages.add('COMPENSATION_REVOKED');
const types = new Set(['kick', 'snare', 'hat', 'bass', 'melodic', 'generic']);
const origins = new Set(['event-track-cache', 'local-detector', 'capture-engine', 'native-audio-engine', 'visual-decoration']);
const components = new Set(['capture-engine', 'offscreen', 'beat-sync', 'widget-bridge',
  'instrument-worker', 'instrument-runtime', 'native-instrument', 'native-audio-engine',
  'native-audio-feed', 'media-bridge', 'beat-controller', 'beat-renderer']);
components.add('native-capture'); components.add('native-widget-bridge');
components.add('beat-scheduler');
components.add('beat-event-engine');
components.add('percussion-classifier');
components.add('lead-fixture');
components.add('owned-local-audio');
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
reasons.add('worker-stalled');
reasons.add('output-device-changed');
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
        ...(opaque(t.eventId) ? { eventId: t.eventId } : {}),
        ...(opaque(t.sourceId)?{sourceId:t.sourceId}:{}),
        ...(opaque(t.synchronizationEpoch)?{synchronizationEpoch:t.synchronizationEpoch}:{}),
        ...(Number.isSafeInteger(t.sourceGeneration)&&t.sourceGeneration>=0?{sourceGeneration:t.sourceGeneration}:{}),
        ...(finite(t.sourceAudioTime)&&t.sourceAudioTime>=0?{sourceAudioTime:t.sourceAudioTime}:{}),
        ...(finite(t.detectorReadyAt)&&t.detectorReadyAt>=0?{detectorReadyAt:t.detectorReadyAt}:{}),
        ...(finite(t.configuredAudioDelayMs)&&t.configuredAudioDelayMs>=0&&t.configuredAudioDelayMs<=500?{configuredAudioDelayMs:t.configuredAudioDelayMs}:{}),
        ...(Number.isInteger(t.originalClassIndex)&&t.originalClassIndex>=0&&t.originalClassIndex<5?{originalClassIndex:t.originalClassIndex}:{}),
        ...(['M0','M1'].includes(t.percussionLabelMapping)?{percussionLabelMapping:t.percussionLabelMapping}:{}),
        ...(['CNN-B','ADTOF-A'].includes(t.detectorModel)?{detectorModel:t.detectorModel}:{}),
        ...Object.fromEntries(['frontendReadyTime','cnnInferenceStart','cnnInferenceEnd','detectorDecisionReady','workerPostTime','companionReceiveTime']
          .filter(key=>finite(t[key])&&t[key]>=0).map(key=>[key,t[key]])),
        ...(origins.has(t.origin) ? { origin: t.origin } : {}),
        ...(opaque(t.captureId) ? { captureId: t.captureId } : {}) });
    }
    return result;
  } catch { return undefined; }
}

export function createBeatTelemetry({ now = Date.now, limit = 2048 } = {}) {
  const capacity = Math.max(1, Math.min(2048, Math.floor(limit) || 2048));
  let enabled = false, prefix, sequence = 0, write = 0, size = 0, evicted = 0;
  const records = new Array(capacity), counts = {};
  const listeners=new Set();
  const api = {
    enable(value = true) { enabled = value === true; },
    get enabled() { return enabled; },
    clear() { records.fill(undefined); write = size = evicted = 0; for (const key of Object.keys(counts)) delete counts[key]; },
    subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
    snapshot() { return { enabled, evicted, counts: { ...counts }, records: Array.from({ length: size }, (_, i) => ({ ...records[(write - size + i + capacity) % capacity] })) }; },
    record(stage, trace, details = {}) {
      if (!enabled || !stages.has(stage)) return;
      try {
        const safe = trace ? parseBeatTraces([trace])?.[0] : undefined;
        const time = now();
        const entry = { stage, at: time, ...safe };
        if (safe?.targetClock === 'epoch-ms') entry.offsetMs = time - safe.targetTime;
        if (components.has(details.component)) entry.component = details.component;
        for (const key of ['queueDepth', 'sequence', 'frames', 'audioTime', 'delayMs', 'durationMs', 'targetPlaybackTime', 'playbackTime', 'offsetMs','sourceGeneration','configuredAudioDelayMs']) {
          if (finite(details[key])) entry[key] = details[key];
        }
        if (opaque(details.captureId)) entry.captureId = details.captureId;
        if (opaque(details.synchronizationEpoch)) entry.synchronizationEpoch=details.synchronizationEpoch;
        if (opaque(details.parentId)) entry.parentId = details.parentId;
        if (Number.isInteger(details.row) && details.row >= 1 && details.row <= 5) entry.row = details.row;
        if (Number.isInteger(details.cell) && details.cell >= 1 && details.cell <= 8) entry.cell = details.cell;
        if (typeof details.semantic === 'boolean') entry.semantic = details.semantic;
        if (reasons.has(details.reason)) entry.reason = details.reason;
        if (['cache', 'local', 'degraded'].includes(details.eventSource)) entry.eventSource = details.eventSource;
        if (stage === 'WORKER_BATCH' || stage === 'DETECTOR_TIMING') {
          for (const key of ['peakFeatureAvailableAudioTime', 'modelInputAudioTime', 'modelInputAvailableAudioTime',
            'featurePostedAt', 'workerReceivedAt', 'inferenceStartedAt', 'inferenceEndedAt',
            'decisionAudioTime', 'decisionAt', 'receivedAt', 'featureComputeMs']) {
            if (finite(details[key]) && details[key] >= 0) entry[key] = details[key];
          }
        }
        if(stage==='PREVIEW_REVOKED'||stage==='COMPENSATION_REVOKED') {
          if(['clock','renewal'].includes(details.trigger))entry.trigger=details.trigger;
          if(['source-or-output-unproven','capture-unproven','clock-unreliable','not-playing','detector-rights-unavailable'].includes(details.previewReason))entry.previewReason=details.previewReason;
          for(const key of ['playing','paused','seeking','buffering','captureHealthy','clockHealthy','outputOwned','singleSource','compensationEligible'])if(typeof details[key]==='boolean')entry[key]=details[key];
          if(Number.isSafeInteger(details.generation)&&details.generation>=0)entry.generation=details.generation;
          if(finite(details.clockAgeMs))entry.clockAgeMs=details.clockAgeMs;
        }
        if(stage==='CAPTURE_REPLACED')for(const key of ['sameOwner','sameNativeAudio','sameSubscription','sameSession','sameSource'])if(typeof details[key]==='boolean')entry[key]=details[key];
        // Narrow Lead provenance allowlist; never log arbitrary metadata or URLs.
        if (details.policyVersion === 'lead-pulse-v1') {
          entry.policyVersion = details.policyVersion;
          if (['vocals', 'piano', 'guitar', 'other'].includes(details.source)) entry.leadSource = details.source;
          if (['vocal-articulation', 'pitched-note'].includes(details.kind)) entry.leadKind = details.kind;
          if (['melodia', 'vocal-body-articulation'].includes(details.detector)) entry.leadDetector = details.detector;
          if (/^[a-f0-9]{64}$/.test(details.inputSha256 || '')) entry.inputSha256 = details.inputSha256;
          if (finite(details.midiPitch) && details.midiPitch >= 0 && details.midiPitch <= 127) entry.midiPitch = details.midiPitch;
        }
        if (stage === 'EVENT_SENT') entry.emittedAt = time;
        if (stage === 'EVENT_COMMITTED' || stage === 'EVENT_STATE_COMMITTED') entry.committedAt = time;
        if (stage === 'EVENT_RENDERED') entry.renderedAt = time;
        records[write] = entry; write = (write + 1) % capacity;
        if (size < capacity) size++; else evicted++;
        counts[stage] = (counts[stage] || 0) + 1;
        for(const listener of listeners){try{listener({...entry});}catch{/* Observers cannot interrupt playback. */}}
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
          ...(origins.has(details.origin) ? { origin: details.origin } : {}),
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
  const params = new URL(globalThis.location.href).searchParams;
  beatTelemetry.enable(params.get('musicDebug') === '1' || params.get('musicSemanticOnly') === '1');
  globalThis.__koraBeatTelemetry = beatTelemetry;
} catch { /* A non-browser test environment can configure the recorder directly. */ }
