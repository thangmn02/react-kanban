import { BeatDetector } from './beat-detector.js';
import { TempoTracker } from './tempo-tracker.js';
import { beatTelemetry } from './beat-telemetry.js';
import { outputTiming } from './beat-timing.js';
import { createPercussionRuntime } from './percussion-runtime.js';
import { createLeadAudioTap } from './lead-audio-tap.js';
const telemetry = beatTelemetry.at('capture-engine');
const percussionTelemetry = beatTelemetry.at('percussion-classifier');

// Chrome's documented offscreen recipe uses both constraints with the same ID.
// Video tracks are stopped immediately and are never rendered or analyzed.
export function tabConstraints(streamId) {
  const mandatory = { chromeMediaSource: 'tab', chromeMediaSourceId: streamId };
  return { audio: { mandatory: { ...mandatory } }, video: { mandatory: { ...mandatory } } };
}

export function createCaptureEngine({ getUserMedia, createAudioContext, onBeat, onStop, onAudible = () => {},
  onTempo = () => {}, onTempoTick = () => {},
  monitorOnly = false,
  createPercussion = createPercussionRuntime,
  createAudioTap = createLeadAudioTap,
  now = () => performance.now(), schedule = setInterval, cancel = clearInterval }) {
  let generation = 0;
  let active;
  let requestedId;
  let lastFailure;

  function stop(reason = 'stopped') {
    generation++;
    requestedId = undefined;
    const previous = active;
    active = undefined;
    if (!previous) return;
    telemetry.record('CAPTURE_STOP', undefined, { captureId: previous.captureId, reason });
    previous.events?.forEach((event) => telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'stopped' }));
    cancel(previous.interval);
    previous.percussionAbort?.abort();
    previous.percussion?.stop();
    previous.audioTap?.stop();
    previous.stream?.getTracks().forEach((track) => track.stop());
    previous.source?.disconnect();
    previous.analyser?.disconnect();
    previous.monitor?.disconnect();
    void previous.context?.close().catch(() => {});
    onStop(previous.captureId, reason);
  }

  async function start(streamId, captureId) {
    stop('replaced');
    const request = ++generation;
    requestedId = captureId;
    let stream;
    let failureStage = 'audio-context';
    lastFailure = undefined;
    try {
      const state = { captureId, leaseUntil: now() + 6000, lastAudio: now(), interval: undefined };
      active = state;
      telemetry.record('CAPTURE_START', undefined, { captureId });
      state.context = createAudioContext();
      state.events = []; state.eventOrder = 0;
      const enqueue = (kind, payload, at = (state.context.currentTime ?? now() / 1000), producerTrace) => {
        const target = at + (monitorOnly ? 0 : (state.context.baseLatency || 0) + (state.context.outputLatency || 0));
        const traces = producerTrace?.map((trace) => ({ ...trace, origin: monitorOnly ? 'native-audio-engine' : 'capture-engine', captureId, targetTime: target, targetClock: 'audio-seconds' }))
          || telemetry.events(kind === 'tempo' || kind === 'tick' ? 'tempo' : 'onset', kind === 'beat' ? payload : ['generic'],
            { captureId, origin: monitorOnly ? 'native-audio-engine' : 'capture-engine', targetTime: target, targetClock: 'audio-seconds', confidence: kind === 'tempo' ? payload.confidence : undefined });
        if (!producerTrace) telemetry.mark('EVENT_DETECTED', traces);
        if (active !== state) { telemetry.mark('EVENT_DROPPED', traces, { reason: 'owner' }); return; }
        if (state.events.length >= 2048) {
          const index = state.events.reduce((oldest, event, i, events) => event.order < events[oldest].order ? i : oldest, 0);
          const [oldest] = state.events.splice(index, 1);
          telemetry.mark('EVENT_DROPPED', oldest.telemetry, { reason: 'queue-full', queueDepth: state.events.length });
          state.recoveryReason = 'queue-full';
        }
        state.events.push({ kind, payload, at: target, order: state.eventOrder++, ...(traces ? { telemetry: traces } : {}) });
        telemetry.mark('EVENT_QUEUED', traces, { queueDepth: state.events.length, audioTime: state.context.currentTime });
        state.events.sort((a, b) => a.at - b.at);
      };
      failureStage = 'stream-open';
      stream = await getUserMedia(tabConstraints(streamId));
      if (request !== generation) { stream.getTracks().forEach((track) => track.stop()); return false; }
      state.stream = stream;
      stream.getVideoTracks().forEach((track) => track.stop());
      if (!stream.getAudioTracks().length) throw new Error('No audio track');
      state.lastAudio = now(); state.leaseUntil = now() + 6000;
      failureStage = 'audio-graph';
      state.source = state.context.createMediaStreamSource(stream);
      state.analyser = state.context.createAnalyser();
      state.analyser.fftSize = 2048; state.analyser.smoothingTimeConstant = 0;
      state.source.connect(state.analyser);
      // Restore tab audio once; native capture only monitors the original output.
      if (monitorOnly) {
        state.monitor = state.context.createGain(); state.monitor.gain.value = 0;
        state.source.connect(state.monitor); state.monitor.connect(state.context.destination);
      } else state.source.connect(state.context.destination);
      failureStage = 'audio-resume';
      await state.context.resume();
      if (request !== generation) return false;
      if (state.context.state !== 'running') throw new Error('Audio context unavailable');
      const detector = new BeatDetector(state.context.sampleRate);
      const tempo = new TempoTracker();
      const drumHits = [];
      const spectrum = new Float32Array(state.analyser.frequencyBinCount);
      // Loading/inference must never block playback, Bass or lease renewal.
      // Without a learned identity, acoustic proposals cannot label drum rows.
      state.percussionAbort = new AbortController();
      void createPercussion({ context: state.context, source: state.source, signal: state.percussionAbort.signal, onEvent(event) {
        if (active !== state || !['kick', 'clap', 'hat'].includes(event.band)
          || !Number.isFinite(event.audioTime) || !Number.isFinite(event.confidence)
          || event.confidence < 0 || event.confidence > 1 || !Number.isFinite(event.classMargin) || event.classMargin < 0) return;
        const at = now() + (event.audioTime - state.context.currentTime) * 1000;
        if (event.band === 'kick') tempo.snapToBeat(at);
        drumHits.push(at);
        const trace = telemetry.events('onset', [event.band], { captureId,
          origin: 'local-detector', confidence: event.confidence, targetTime: event.audioTime, targetClock: 'audio-seconds' });
        percussionTelemetry.mark('EVENT_DETECTED', trace, { semantic: true });
        enqueue('beat', [event.band], event.audioTime, trace);
      } }).then(runtime => {
        if (active === state) state.percussion = runtime;
        else runtime?.stop();
      }).catch(() => { telemetry.record('EVENT_DROPPED', undefined, { captureId, reason: 'worker-failed' }); });
      stream.getAudioTracks().forEach((track) => track.addEventListener('ended', () => {
        if (active === state) stop('ended');
      }, { once: true }));
      // Offscreen documents have no visible animation frame. Sample at 60 Hz
      // with a timer while the audio graph runs, reusing all FFT buffers.
      state.interval = schedule(() => {
        if (active !== state) return;
        const time = now();
        if (state.audioTap && time > state.audioTapUntil) { state.audioTap.stop(); state.audioTap = undefined; }
        if (time > state.leaseUntil || state.context.state !== 'running') { telemetry.record('LEASE_EXPIRED', undefined, { captureId }); stop('expired'); return; }
        const analysisAt = beatTelemetry.enabled ? performance.now() : 0;
        state.analyser.getFloatFrequencyData(spectrum);
        const result = detector.analyze(spectrum, time);
        const rhythm = tempo.analyze(result.envelope, time);
        telemetry.record('ANALYSIS_FRAME', undefined, { captureId, audioTime: state.context.currentTime, queueDepth: state.events.length,
          ...(beatTelemetry.enabled ? { durationMs: performance.now() - analysisAt } : {}) });
        if (result.hits.some(band => band !== 'bass')) {
          const proposals = telemetry.events('onset', ['generic'], { captureId, origin: 'local-detector' });
          telemetry.mark('EVENT_DETECTED', proposals, { semantic: false });
        }
        while (drumHits.length && drumHits[0] < time - 4000) drumHits.shift();
        // Strong, regular drums retain direct onset lighting. Tempo lock is
        // for periodic music whose transient rows are sparse.
        const tempoLocked = rhythm.locked && drumHits.length < 20;
        // Audibility is independent of instrument detection (it can be vocals).
        const audible = spectrum.some((db) => Number.isFinite(db) && db > -65);
        if (result.audible || audible) {
          if (state.lowEnergy) telemetry.record('CAPTURE_RECOVERED', undefined, { captureId });
          state.lowEnergy = false;
          state.lastAudio = time;
          if (!state.audioDetected) { state.audioDetected = true; telemetry.record('AUDIO_DETECTED', undefined, { captureId }); onAudible(captureId); }
        } else if (!state.lowEnergy) {
          state.lowEnergy = true; telemetry.record('LOW_ENERGY', undefined, { captureId });
        }
        // Quiet audio is not an ended stream. The owner lease still bounds its
        // lifetime; sampling continues so returning audio needs no new capture.
        if (result.hits.includes('bass')) enqueue('beat', ['bass']);
        if (rhythm.updated) enqueue('tempo', { locked: tempoLocked, bpm: tempoLocked ? rhythm.bpm : null, confidence: rhythm.confidence });
        if (tempoLocked && rhythm.tick) enqueue('tick', rhythm.tick);
        const audioTime = state.context.currentTime ?? time / 1000;
        // Send ahead of the existing audio deadline. The UI owns timed release;
        // this bounded queue still protects work awaiting the sampling callback.
        while (state.events.length) {
          const event = state.events.shift();
          if (audioTime - event.at > .6) { telemetry.mark('EVENT_LATE', event.telemetry, { delayMs: (audioTime - event.at) * 1000 }); telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'late' }); state.recoveryReason = 'late'; continue; }
          if (state.recoveryReason) {
            telemetry.record('CAPTURE_RECOVERED', undefined, { captureId, reason: state.recoveryReason, queueDepth: state.events.length });
            state.recoveryReason = undefined;
          }
          telemetry.mark('EVENT_SENT', event.telemetry, { audioTime, delayMs: (audioTime - event.at) * 1000 });
          const timing = outputTiming(state.context, event.at, monitorOnly);
          const metadata = timing ? [event.telemetry, timing] : event.telemetry ? [event.telemetry] : [];
          if (event.kind === 'beat') onBeat(captureId, event.payload, ...metadata);
          if (event.kind === 'tempo') onTempo(captureId, event.payload, ...metadata);
          if (event.kind === 'tick') onTempoTick(captureId, event.payload, ...metadata);
        }
      }, 1000 / 60);
      return true;
    } catch (error) {
      if (request === generation) {
        // Report only an allowlisted category; browser messages may contain
        // source identifiers. This observation does not alter capture recovery.
        const codes = ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'AbortError', 'OverconstrainedError', 'SecurityError', 'InvalidStateError', 'TypeError'];
        lastFailure = { stage: failureStage, code: codes.includes(error?.name) ? error.name : 'Error' };
        if (active) stop('failed');
        else { stream?.getTracks().forEach((track) => track.stop()); onStop(captureId, 'failed'); }
      } else stream?.getTracks().forEach((track) => track.stop());
      return false;
    }
  }

  return {
    start,
    stop,
    async readAudio(captureId) {
      const owner = active;
      if (monitorOnly || owner?.captureId !== captureId || owner.context?.state !== 'running') return;
      owner.audioTapUntil = now() + 1000;
      if (!owner.audioTap && !owner.audioTapStarting) {
        owner.audioTapStarting = createAudioTap({ context: owner.context, source: owner.source }).then(tap => {
          if (active !== owner || now() > owner.audioTapUntil) { tap?.stop(); return; }
          owner.audioTap = tap;
        }).catch(() => {}).finally(() => { owner.audioTapStarting = undefined; });
      }
      await owner.audioTapStarting;
      if (active !== owner || now() > owner.audioTapUntil) return;
      const packet = owner.audioTap?.read();
      if (!packet) return;
      const timing = outputTiming(owner.context, packet.endTime);
      return timing ? { pcm: packet.pcm, sequence: packet.sequence, sampleRate: 44100, ...timing } : undefined;
    },
    get delaySeconds() { return 0; },
    get lastFailure() { return lastFailure && { ...lastFailure }; },
    stopCapture(captureId) {
      if (requestedId === captureId) stop();
    },
    renew(captureId) {
      if (active?.captureId !== captureId || active.context?.state !== 'running'
        || !active.stream?.getAudioTracks().some((track) => track.readyState === 'live')) return false;
      active.leaseUntil = now() + 6000;
      telemetry.record('LEASE_RENEW', undefined, { captureId });
      return true;
    },
  };
}
