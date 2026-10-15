import { BeatDetector } from './beat-detector.js';
import { TempoTracker } from './tempo-tracker.js';
import { beatTelemetry } from './beat-telemetry.js';
import { outputTiming } from './beat-timing.js';
import { createPercussionRuntime } from './percussion-runtime.js';
import { createLeadAudioTap } from './lead-audio-tap.js';
import { privateBeatCandidate } from './beat-candidate.js';
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
  let teardown = Promise.resolve();
  const setOutput = (state, bufferMs = 0) => {
    if(!state.candidate||monitorOnly||!state.source||!state.context.createGain)return false;
    const previous=state.output;
    clearTimeout(state.outputSwap);
    state.retiringOutput?.delay?.disconnect();state.retiringOutput?.gain.disconnect();
    const gain=state.context.createGain();gain.gain.value=previous?0:1;gain.connect(state.context.destination);
    const delay=bufferMs?state.context.createDelay(.5):undefined;
    if(delay){delay.delayTime.value=bufferMs/1000;state.source.connect(delay);delay.connect(gain);}
    else state.source.connect(gain);
    state.output={gain,delay};state.bufferMs=bufferMs;
    if(previous){
      previous.gain.gain.setTargetAtTime?.(0,state.context.currentTime,.003);
      state.retiringOutput=previous;
      state.outputSwap=setTimeout(()=>{
        try{state.source.disconnect(previous.delay||previous.gain);}catch{/* Replaced graph. */}
        previous.delay?.disconnect();previous.gain.disconnect();state.retiringOutput=undefined;
        if(active===state)gain.gain.setTargetAtTime?.(1,state.context.currentTime,.003);
      },16);
    }
    return true;
  };
  const calibration = state => {
    const sorted=(state?.latencies||[]).slice().sort((a,b)=>a-b);
    return {samples:sorted.length,p95Ms:sorted[Math.ceil(sorted.length*.95)-1]??null,
      p99Ms:sorted[Math.ceil(sorted.length*.99)-1]??null};
  };

  function stop(reason = 'stopped') {
    generation++;
    requestedId = undefined;
    const previous = active;
    active = undefined;
    if (!previous) return teardown;
    telemetry.record('CAPTURE_STOP', undefined, { captureId: previous.captureId, reason });
    previous.events?.forEach((event) => telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'stopped' }));
    cancel(previous.interval);
    previous.percussionOwner?.abort.abort();
    previous.percussionOwner?.runtime?.stop();
    previous.audioTap?.stop();
    clearTimeout(previous.outputSwap);
    const release=()=>{
      previous.stream?.getTracks().forEach((track) => track.stop());
      previous.source?.disconnect();previous.analyser?.disconnect();previous.monitor?.disconnect();
      previous.output?.delay?.disconnect();previous.output?.gain?.disconnect();
      previous.retiringOutput?.delay?.disconnect();previous.retiringOutput?.gain.disconnect();
      void previous.context?.close().catch(() => {});onStop(previous.captureId, reason);
    };
    if(previous.candidate&&previous.output?.gain.gain.setTargetAtTime){
      previous.output.gain.gain.setTargetAtTime(0,previous.context.currentTime,.003);
      teardown=new Promise(resolve=>setTimeout(()=>{release();resolve();},16));
    }else{release();teardown=Promise.resolve();}
    return teardown;
  }

  async function start(streamId, captureId, requestOptions = {}) {
    stop('replaced');
    const request = ++generation;
    requestedId = captureId;
    if(privateBeatCandidate)await teardown;
    if(request!==generation)return false;
    let stream;
    let failureStage = 'audio-context';
    lastFailure = undefined;
    try {
      const state = { captureId, leaseUntil: now() + 6000, lastAudio: now(), interval: undefined,
        candidate:privateBeatCandidate&&requestOptions.candidate===true,bufferMs:0,latencies:[],typedPreview:false,
        acceptAfter:Infinity,droppedSemanticEvents:0 };
      active = state;
      if(state.candidate&&requestOptions.sourceProvider==='spotify')throw new Error('Provider analysis blocked');
      telemetry.record('CAPTURE_START', undefined, { captureId });
      state.context = createAudioContext();
      state.events = []; state.eventOrder = 0;
      const enqueue = (kind, payload, at = (state.context.currentTime ?? now() / 1000), producerTrace, immediate = false) => {
        const target = at + (monitorOnly ? 0 : (state.context.baseLatency || 0) + (state.context.outputLatency || 0) + state.bufferMs/1000);
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
        // Learned results are already late; do not wait for the next FFT timer.
        if (immediate && state.audioDetected) flushEvents();
      };
      const flushEvents = () => {
        const audioTime = state.context.currentTime ?? now() / 1000;
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
          if(timing&&state.candidate)timing.synchronizationEpoch=state.synchronizationEpoch;
          const metadata = timing ? [event.telemetry, timing] : event.telemetry ? [event.telemetry] : [];
          if (event.kind === 'beat') onBeat(captureId, event.payload, ...metadata);
          if (event.kind === 'tempo') onTempo(captureId, event.payload, ...metadata);
          if (event.kind === 'tick') onTempoTick(captureId, event.payload, ...metadata);
        }
      };
      failureStage = 'stream-open';
      const constraints=tabConstraints(streamId);
      // The private audio graph needs no video track. Stopping a companion
      // video track can mark Chrome's capture registry stopped while audio lives.
      stream = await getUserMedia(state.candidate?{audio:constraints.audio}:constraints);
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
      } else if(!state.candidate||!setOutput(state,0))state.source.connect(state.context.destination);
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
      state.percussionFailures = 0;
      const startPercussion = () => {
        const owner = { abort: new AbortController() };
        state.percussionOwner = owner;
        state.percussionRetryAt = undefined;
        const failed = (reason = 'worker-failed') => {
          if (active !== state || state.percussionOwner !== owner) return;
          state.percussionOwner = undefined;
          owner.abort.abort(); owner.runtime?.stop();
          state.events = state.events.filter(event => {
            const drum = event.kind === 'beat' && event.payload.some(band => band !== 'bass');
            if (drum) telemetry.mark('EVENT_DROPPED', event.telemetry, { reason });
            return !drum;
          });
          drumHits.length = 0;
          state.percussionRecovery = reason;
          state.percussionRetryAt = now() + Math.min(30000, 1000 * 2 ** Math.min(state.percussionFailures++, 5));
          telemetry.record('EVENT_DROPPED', undefined, { captureId, reason });
        };
        void createPercussion({ context: state.context, source: state.source, signal: owner.abort.signal,
          ...(state.candidate?{classifier:'onset-guided'}:{}),
          onFailure: failed,
          onProgress() {
            if (active !== state || state.percussionOwner !== owner) return;
            state.percussionFailures = 0;
            if (state.percussionRecovery) {
              telemetry.record('CAPTURE_RECOVERED', undefined, { captureId, reason: state.percussionRecovery });
              state.percussionRecovery = undefined;
            }
          },
          onEvent(event) {
            if (active !== state || state.percussionOwner !== owner || !['kick', 'clap', 'hat'].includes(event.band)
              || !Number.isFinite(event.audioTime) || !Number.isFinite(event.confidence)
              || event.confidence < 0 || event.confidence > 1 || !Number.isFinite(event.classMargin) || event.classMargin < 0) return;
            if(state.candidate){
              const latency=(state.context.currentTime-event.audioTime)*1000;
              if(Number.isFinite(latency)&&latency>=0){state.latencies.push(latency);if(state.latencies.length>512)state.latencies.shift();}
              if(!state.typedPreview||event.audioTime<state.acceptAfter){state.droppedSemanticEvents++;return;}
            }
            const at = now() + (event.audioTime - state.context.currentTime) * 1000;
            if (event.band === 'kick') tempo.snapToBeat(at);
            drumHits.push(at);
            const trace = telemetry.events('onset', [event.band], { captureId,
              origin: 'local-detector', confidence: event.confidence, targetTime: event.audioTime, targetClock: 'audio-seconds' });
            percussionTelemetry.mark('EVENT_DETECTED', trace, { semantic: true, audioTime:event.audioTime });
            enqueue('beat', [event.band], event.audioTime, trace, true);
          },
        }).then(runtime => {
          if (active !== state || state.percussionOwner !== owner) { runtime?.stop(); return; }
          if (runtime) owner.runtime = runtime;
          else failed();
        }).catch(() => failed());
      };
      startPercussion();
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
        if (state.percussionRetryAt !== undefined && time >= state.percussionRetryAt) startPercussion();
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
        if (result.hits.includes('bass')&&(!state.candidate||state.typedPreview)) enqueue('beat', ['bass']);
        if (rhythm.updated) enqueue('tempo', { locked: tempoLocked, bpm: tempoLocked ? rhythm.bpm : null, confidence: rhythm.confidence });
        if (tempoLocked && rhythm.tick) enqueue('tick', rhythm.tick);
        flushEvents();
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
    get delaySeconds() { return (active?.bufferMs||0)/1000; },
    get calibration(){return calibration(active);},
    get health(){return active?{context:active.context?.state,bufferMs:active.bufferMs,
      queuedEvents:active.events.length,droppedSemanticEvents:active.droppedSemanticEvents,
      dropReason:active.typedPreview?'none':'detector-unqualified',workerFailures:active.percussionFailures||0}:undefined;},
    configureSynchronization(captureId,settings){
      const state=active;
      if(!state?.candidate||state.captureId!==captureId||monitorOnly
        ||!Number.isFinite(settings?.bufferMs)||settings.bufferMs<0||settings.bufferMs>500
        ||settings.live===true&&(settings.bufferMs!==0||state.bufferMs!==0)
        ||settings.bufferMs>0&&(!settings.eligible||settings.paused!==true)
        ||settings.flush!==true&&settings.paused!==true&&settings.live!==true)return false;
      state.events.length=0;
      state.synchronizationEpoch=typeof settings.epoch==='string'&&/^[a-zA-Z0-9:_-]{1,160}$/.test(settings.epoch)
        ?settings.epoch:crypto.randomUUID();
      state.acceptAfter=state.context.currentTime;
      state.typedPreview=settings.eligible===true&&settings.allowTypedPreview===true;
      if(settings.live===true)return true;
      return setOutput(state,settings.bufferMs);
    },
    get lastFailure() { return lastFailure && { ...lastFailure }; },
    stopCapture(captureId) {
      if (requestedId === captureId) return stop();
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
