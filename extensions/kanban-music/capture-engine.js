import { BeatDetector } from './beat-detector.js';
import { TempoTracker } from './tempo-tracker.js';
import { beatTelemetry } from './beat-telemetry.js';
const telemetry = beatTelemetry.at('capture-engine');

// Chrome's documented offscreen recipe uses both constraints with the same ID.
// Video tracks are stopped immediately and are never rendered or analyzed.
export function tabConstraints(streamId) {
  const mandatory = { chromeMediaSource: 'tab', chromeMediaSourceId: streamId };
  return { audio: { mandatory: { ...mandatory } }, video: { mandatory: { ...mandatory } } };
}

export function createCaptureEngine({ getUserMedia, createAudioContext, onBeat, onStop, onAudible = () => {},
  onTempo = () => {}, onTempoTick = () => {}, onMelody = () => {},
  createInstrumentCapture,
  monitorOnly = false,
  onInstrumentFailure = () => {},
  now = () => performance.now(), schedule = setInterval, cancel = clearInterval }) {
  let generation = 0;
  let active;
  let requestedId;

  function stop(reason = 'stopped') {
    generation++;
    requestedId = undefined;
    const previous = active;
    active = undefined;
    if (!previous) return;
    telemetry.record('CAPTURE_STOP', undefined, { captureId: previous.captureId, reason });
    previous.events?.forEach((event) => telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'stopped' }));
    cancel(previous.interval);
    previous.stream?.getTracks().forEach((track) => track.stop());
    previous.source?.disconnect();
    previous.instrument?.stop();
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
    try {
      const state = { captureId, leaseUntil: now() + 6000, lastAudio: now(), interval: undefined };
      active = state;
      telemetry.record('CAPTURE_START', undefined, { captureId });
      state.context = createAudioContext();
      state.events = []; state.delaySeconds = 0; state.note = 0;
      const enqueue = (kind, payload, at = (state.context.currentTime ?? now() / 1000) + state.delaySeconds, producerTrace) => {
        const target = at + (monitorOnly ? 0 : (state.context.baseLatency || 0) + (state.context.outputLatency || 0));
        const traces = producerTrace?.map((trace) => ({ ...trace, captureId, targetTime: target, targetClock: 'audio-seconds' }))
          || telemetry.events(kind === 'tempo' || kind === 'tick' ? 'tempo' : 'onset', kind === 'beat' ? payload : kind === 'tick' ? payload.bands : [kind === 'melody' ? 'melodic' : 'generic'],
            { captureId, targetTime: target, targetClock: 'audio-seconds', confidence: kind === 'tempo' ? payload.confidence : undefined });
        if (!producerTrace) telemetry.mark('EVENT_DETECTED', traces);
        if (active !== state || state.events.length >= 2048) { telemetry.mark('EVENT_DROPPED', traces, { reason: active !== state ? 'owner' : 'queue-full', queueDepth: state.events.length }); return; }
        state.events.push({ kind, payload, at: target, ...(traces ? { telemetry: traces } : {}) });
        telemetry.mark('EVENT_QUEUED', traces, { queueDepth: state.events.length, audioTime: state.context.currentTime });
        state.events.sort((a, b) => a.at - b.at);
      };
      const instrumentError = (message = 'Instrument analysis missed its playback deadline') => {
        if (active !== state) return;
        state.events = state.events.filter((event) => {
          if (event.kind === 'melody') telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'instrument-deadline' });
          return event.kind !== 'melody';
        });
        state.instrumentFailed = true;
        state.instrument?.stopAnalysis();
        onInstrumentFailure(String(message).slice(0, 160));
        onMelody(captureId, { active: false, level: 0, note: state.note });
      };
      if (createInstrumentCapture) {
        try {
          state.instrument = createInstrumentCapture({ context: state.context, onError: instrumentError, onNotes(events) {
            if (active !== state || state.instrumentFailed) return;
            if (events.some((event) => event.time + state.delaySeconds < state.context.currentTime - .05)) {
              events.forEach((event) => telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'instrument-deadline' })); instrumentError(); return;
            }
            events.forEach((event) => enqueue('melody', event.state, event.time + state.delaySeconds, event.telemetry));
          } });
          if (state.instrument) {
            let setupTimeout;
            try {
              await Promise.race([state.instrument.ready, new Promise((_, reject) => {
                setupTimeout = setTimeout(() => reject(new Error('Instrument setup took too long. Retry from AI instrument notes.')), 3000);
              })]);
            } finally { clearTimeout(setupTimeout); }
            if (request !== generation) return false;
            state.delaySeconds = monitorOnly ? 0 : state.instrument.delaySeconds;
          }
        } catch (error) {
          if (active === state) instrumentError(error.message);
          state.instrument?.stop(); state.instrument = undefined;
        }
      }
      if (request !== generation) return false;
      // Load/warm the model before capture suppresses the tab's normal output.
      stream = await getUserMedia(tabConstraints(streamId));
      if (request !== generation) { stream.getTracks().forEach((track) => track.stop()); return false; }
      state.stream = stream;
      stream.getVideoTracks().forEach((track) => track.stop());
      if (!stream.getAudioTracks().length) throw new Error('No audio track');
      state.lastAudio = now(); state.leaseUntil = now() + 6000;
      state.source = state.context.createMediaStreamSource(stream);
      state.analyser = state.context.createAnalyser();
      state.analyser.fftSize = 2048; state.analyser.smoothingTimeConstant = 0;
      state.source.connect(state.analyser);
      // Restore original audio once, delayed only after actual model setup.
      if (state.instrument) state.instrument.connect(state.source);
      else if (monitorOnly) {
        state.monitor = state.context.createGain(); state.monitor.gain.value = 0;
        state.source.connect(state.monitor); state.monitor.connect(state.context.destination);
      } else state.source.connect(state.context.destination);
      await state.context.resume();
      if (request !== generation) return false;
      if (state.context.state !== 'running') throw new Error('Audio context unavailable');
      const detector = new BeatDetector(state.context.sampleRate);
      const tempo = new TempoTracker();
      const drumHits = [];
      const spectrum = new Float32Array(state.analyser.frequencyBinCount);
      stream.getAudioTracks().forEach((track) => track.addEventListener('ended', () => {
        if (active === state) stop('ended');
      }, { once: true }));
      // Offscreen documents have no visible animation frame. Sample at 60 Hz
      // with a timer while the audio graph runs, reusing all FFT buffers.
      state.interval = schedule(() => {
        if (active !== state) return;
        const time = now();
        if (time > state.leaseUntil || state.context.state !== 'running') { telemetry.record('LEASE_EXPIRED', undefined, { captureId }); stop('expired'); return; }
        const analysisAt = beatTelemetry.enabled ? performance.now() : 0;
        state.analyser.getFloatFrequencyData(spectrum);
        const result = detector.analyze(spectrum, time);
        const rhythm = tempo.analyze(result.envelope, time);
        telemetry.record('ANALYSIS_FRAME', undefined, { captureId, audioTime: state.context.currentTime, queueDepth: state.events.length,
          ...(beatTelemetry.enabled ? { durationMs: performance.now() - analysisAt } : {}) });
        if (rhythm.locked && result.hits.includes('kick')) tempo.snapToBeat(time);
        for (const band of result.hits) if (band === 'kick' || band === 'clap' || band === 'hat') drumHits.push(time);
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
        if (time - state.lastAudio > 2500 + state.delaySeconds * 1000) { stop('silent'); return; }
        if (result.hits.length) enqueue('beat', result.hits);
        if (rhythm.updated) enqueue('tempo', { locked: tempoLocked, bpm: tempoLocked ? rhythm.bpm : null, confidence: rhythm.confidence });
        if (tempoLocked && rhythm.tick) enqueue('tick', rhythm.tick);
        if (state.lastMelody === undefined) { state.lastMelody = time; onMelody(captureId, { active: false, level: 0, note: 0 }); }
        const audioTime = state.context.currentTime ?? time / 1000;
        while (state.events[0]?.at <= audioTime) {
          const event = state.events.shift();
          if (audioTime - event.at > .6) { telemetry.mark('EVENT_LATE', event.telemetry, { delayMs: (audioTime - event.at) * 1000 }); telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'late' }); continue; }
          telemetry.mark('EVENT_SENT', event.telemetry, { audioTime, delayMs: (audioTime - event.at) * 1000 });
          const metadata = event.telemetry ? [event.telemetry] : [];
          if (event.kind === 'beat') onBeat(captureId, event.payload, ...metadata);
          if (event.kind === 'tempo') onTempo(captureId, event.payload, ...metadata);
          if (event.kind === 'tick') onTempoTick(captureId, event.payload, ...metadata);
          if (event.kind === 'melody') { state.note = event.payload.note; onMelody(captureId, event.payload, ...metadata); }
        }
      }, 1000 / 60);
      return true;
    } catch {
      if (request === generation) {
        if (active) stop('failed');
        else { stream?.getTracks().forEach((track) => track.stop()); onStop(captureId, 'failed'); }
      } else stream?.getTracks().forEach((track) => track.stop());
      return false;
    }
  }

  return { start, stop, get delaySeconds() { return active?.delaySeconds || 0; }, stopCapture(captureId) { if (requestedId === captureId) stop(); }, renew(captureId) {
    if (active?.captureId !== captureId || active.context?.state !== 'running'
      || !active.stream?.getAudioTracks().some((track) => track.readyState === 'live')) return false;
    active.leaseUntil = now() + 6000;
    telemetry.record('LEASE_RENEW', undefined, { captureId });
    return true;
  } };
}
