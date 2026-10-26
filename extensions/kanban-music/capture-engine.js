import { BeatDetector } from './beat-detector.js';
import { TempoTracker } from './tempo-tracker.js';
import { beatTelemetry } from './beat-telemetry.js';
import { outputTiming } from './beat-timing.js';
import { createPercussionRuntime } from './percussion-runtime.js';
import { createHybridPercussionRuntime } from './hybrid-percussion-runtime.js';
import { createLeadAudioTap } from './lead-audio-tap.js';
import { createDelayedAudioOutput } from './delayed-audio-output.js';
import { privateBeatCandidate, privatePercussionDiagnostics, privatePercussionClassifier,semanticPrecisionGuards,privateHatLabelMapping } from './beat-candidate.js';
import {ADTOF_CLASS_NAMES} from './percussion-label-contract.js';
import {LiveDiagnosticRecorder} from './live-diagnostic-recorder.js';
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
  createHybrid = createHybridPercussionRuntime,
  createAudioTap = createLeadAudioTap,
  now = () => performance.now(), schedule = setInterval, cancel = clearInterval }) {
  let generation = 0;
  let active;
  let requestedId;
  let lastFailure;
  let teardown = Promise.resolve();
  let recording,recordTimer,recordUnsubscribe,recordPriorTelemetry;
  const finishRecording=reason=>{
    if(!recording?.active)return;
    active?.percussionOwner?.runtime?.recordDiagnostics?.(recording.meta.recordingId,false);
    recording.finish(reason);clearTimeout(recordTimer);recordUnsubscribe?.();recordUnsubscribe=undefined;
    beatTelemetry.enable(recordPriorTelemetry);
  };
  const setOutput = (state, bufferMs = 0, paused = false) => {
    if(!state.candidate||monitorOnly||!state.source||!state.context.createGain)return false;
    state.output ||= createDelayedAudioOutput(state.context,state.source);
    state.output.replace(bufferMs,{muted:bufferMs>0&&paused});state.bufferMs=bufferMs;
    state.outputPaused=bufferMs>0&&paused;
    telemetry.record('OUTPUT_ROUTE_CHANGED',undefined,{captureId:state.captureId,sourceGeneration:state.sourceGeneration,
      synchronizationEpoch:state.synchronizationEpoch,configuredAudioDelayMs:bufferMs,audioTime:state.context.currentTime});
    return true;
  };
  const calibration = state => {
    const sorted=(state?.latencies||[]).slice().sort((a,b)=>a-b);
    return {samples:sorted.length,p95Ms:sorted[Math.ceil(sorted.length*.95)-1]??null,
      p99Ms:sorted[Math.ceil(sorted.length*.99)-1]??null};
  };
  const diagnosticClock=state=>{
    if(!state?.candidate||!privatePercussionDiagnostics)return undefined;
    const context=state.context;let outputTimestamp;
    try{outputTimestamp=context.getOutputTimestamp?.();}catch{/* Unsupported output clock. */}
    const lastFrame=state.diagnosticFrames.at(-1);
    return {sampledAt:Date.now(),performanceNow:performance.now(),timeOrigin:performance.timeOrigin,
      currentAudioTime:context.currentTime,contextState:context.state,baseLatency:context.baseLatency,outputLatency:context.outputLatency,
      outputTimestamp,bufferMs:state.bufferMs,outputRoute:state.output?.snapshot(),captureId:state.captureId,
      sourceId:state.sourceId,sourceGeneration:state.sourceGeneration,synchronizationEpoch:state.synchronizationEpoch,
      lastModelAudioTime:lastFrame?.audioTime,
      analysisLagMs:lastFrame?(context.currentTime-lastFrame.audioTime)*1000:null,
      lastInferenceMs:lastFrame?lastFrame.inferenceEndedAt-lastFrame.inferenceStartedAt:null};
  };

  function stop(reason = 'stopped') {
    finishRecording(reason);
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
    previous.output?.stop();
    previous.context?.removeEventListener?.('sinkchange',previous.outputChanged);
    const release=()=>{
      previous.stream?.getTracks().forEach((track) => track.stop());
      previous.source?.disconnect();previous.analyser?.disconnect();previous.monitor?.disconnect();
      const closing=previous.context?.close().catch(() => {});onStop(previous.captureId, reason);
      return closing;
    };
    previous.events?.splice(0);teardown=Promise.resolve(release());
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
        sourceId:requestOptions.sourceId||captureId,sourceGeneration:requestOptions.sourceGeneration||0,
        synchronizationEpoch:requestOptions.synchronizationEpoch||crypto.randomUUID(),
        candidate:privateBeatCandidate&&requestOptions.candidate===true,bufferMs:0,latencies:[],typedPreview:false,
        percussionClassifier:privatePercussionClassifier,hybridMode:'L0',
        acceptAfter:Infinity,droppedSemanticEvents:0,diagnosticFrames:[],diagnosticPredictions:[],diagnosticEvicted:0,diagnosticFeatures:[] };
      active = state;
      if(state.candidate&&requestOptions.sourceProvider==='spotify')throw new Error('Provider analysis blocked');
      telemetry.record('CAPTURE_START', undefined, { captureId });
      state.context = createAudioContext();
      state.outputChanged=()=>{if(active===state&&state.bufferMs>0)stop('output-device-changed');};
      state.context.addEventListener?.('sinkchange',state.outputChanged);
      state.events = []; state.eventOrder = 0;
      const enqueue = (kind, payload, at = (state.context.currentTime ?? now() / 1000), producerTrace, immediate = false) => {
        const target = at + (monitorOnly ? 0 : (state.context.baseLatency || 0) + (state.context.outputLatency || 0) + state.bufferMs/1000);
        const traces = producerTrace?.map((trace) => ({ ...trace, origin: monitorOnly ? 'native-audio-engine' : 'capture-engine', captureId, targetTime: target, targetClock: 'audio-seconds' }))
          || telemetry.events(kind === 'tempo' || kind === 'tick' ? 'tempo' : 'onset', kind === 'beat' ? payload : ['generic'],
            { captureId, origin: monitorOnly ? 'native-audio-engine' : 'capture-engine', targetTime: target, targetClock: 'audio-seconds', confidence: kind === 'tempo' ? payload.confidence : undefined });
        for(const trace of traces||[])Object.assign(trace,{sourceId:state.sourceId,sourceGeneration:state.sourceGeneration,
          synchronizationEpoch:state.synchronizationEpoch,sourceAudioTime:at,detectorReadyAt:trace.detectorReadyAt??Date.now(),configuredAudioDelayMs:state.bufferMs});
        if (!producerTrace) telemetry.mark('EVENT_DETECTED', traces);
        if (active !== state) { telemetry.mark('EVENT_DROPPED', traces, { reason: 'owner' }); return; }
        if (state.events.length >= 2048) {
          const index = state.events.reduce((oldest, event, i, events) => event.order < events[oldest].order ? i : oldest, 0);
          const [oldest] = state.events.splice(index, 1);
          telemetry.mark('EVENT_DROPPED', oldest.telemetry, { reason: 'queue-full', queueDepth: state.events.length });
          state.recoveryReason = 'queue-full';
        }
        state.events.push({ kind, payload, at: target, epoch:state.synchronizationEpoch, order: state.eventOrder++, ...(traces ? { telemetry: traces } : {}) });
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
          if(active!==state||event.epoch!==state.synchronizationEpoch)continue;
          if (audioTime - event.at > .6) { telemetry.mark('EVENT_LATE', event.telemetry, { delayMs: (audioTime - event.at) * 1000 }); telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'late' }); state.recoveryReason = 'late'; continue; }
          if (state.recoveryReason) {
            telemetry.record('CAPTURE_RECOVERED', undefined, { captureId, reason: state.recoveryReason, queueDepth: state.events.length });
            state.recoveryReason = undefined;
          }
          telemetry.mark('EVENT_SENT', event.telemetry, { audioTime, delayMs: (audioTime - event.at) * 1000 });
          const timing = outputTiming(state.context, event.at, monitorOnly);
          if(timing)Object.assign(timing,{sourceId:state.sourceId,sourceGeneration:state.sourceGeneration,synchronizationEpoch:state.synchronizationEpoch});
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
      let detector = new BeatDetector(state.context.sampleRate);
      let tempo = new TempoTracker();
      state.resetDetectors=(resetFft=false)=>{
        detector=new BeatDetector(state.context.sampleRate);tempo=new TempoTracker();
        if(resetFft){
          state.source.disconnect(state.analyser);state.analyser.disconnect();
          state.analyser=state.context.createAnalyser();state.analyser.fftSize=2048;state.analyser.smoothingTimeConstant=0;
          state.source.connect(state.analyser);spectrum.fill(-Infinity);
        }
      };
      const drumHits = [];
      const spectrum = new Float32Array(state.analyser.frequencyBinCount);
      // Loading/inference must never block playback, Bass or lease renewal.
      // Without a learned identity, acoustic proposals cannot label drum rows.
      state.percussionFailures = 0;
      const startPercussion = () => {
        const owner = { abort: new AbortController(), epoch:state.synchronizationEpoch };
        state.percussionOwner = owner;
        state.percussionRetryAt = undefined;
        const failed = (reason = 'worker-failed') => {
          if (active !== state || state.percussionOwner !== owner || owner.epoch!==state.synchronizationEpoch) return;
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
        const createRuntime=state.hybridMode==='L0'?createPercussion:createHybrid;
        void createRuntime({ context: state.context, source: state.source, signal: owner.abort.signal,hybridMode:state.hybridMode,
          ...(state.candidate?{onCaptureDiagnostic(result){
            if(active!==state||state.percussionOwner!==owner||!recording?.active||result.diagnosticRecordingId!==recording.meta.recordingId)return;
            if(result.detectorModel==='CNN-B'){
              if(result.kind==='diagnostic-start')recording.cnnWorkerStart=result;
              if(result.kind==='result'){
                recording.append('cnnBatches',{...result.timing,receivedAt:Date.now(),receivedAudioTime:state.context.currentTime});
                for(const frame of result.diagnostics||[])recording.append('cnnFrames',frame);
                for(const event of result.events||[])recording.append('cnnEvents',{...event,hybridMode:state.hybridMode,
                  shadow:state.hybridMode==='H-SHADOW',companionReceiveTime:Date.now()});
              }else if(result.kind==='failed'||result.kind==='discontinuity')recording.append('issues',result);
              return;
            }
            if(result.kind==='diagnostic-start')recording.workerStart=result;
            if(result.kind==='backlog'||result.kind==='failed')recording.append('issues',{kind:result.kind,at:Date.now()});
            if(result.kind==='result'){
              recording.append('batches',{at:Date.now(),receivedAudioTime:result.receivedAudioTime,
                durationMs:result.durationMs,queueDepth:result.queueDepth,timing:result.timing,
                inferenceStartedAt:result.inferenceStartedAt,inferenceEndedAt:result.inferenceEndedAt});
              for(const frame of result.diagnostics||[])recording.append('frames',{...frame,
                receivedAt:result.mainThreadReceivedAt,audioContextTime:state.context.currentTime,
                ...outputTiming(state.context,frame.audioTime+(state.context.baseLatency||0)+(state.context.outputLatency||0)+state.bufferMs/1000),
                configuredAudioDelayMs:state.bufferMs});
            }
          }}:{}),
          ownership:{captureId,sourceId:state.sourceId,sourceGeneration:state.sourceGeneration,synchronizationEpoch:owner.epoch},
          ...(state.candidate?{semanticPrecisionGuards,hatLabelMapping:privateHatLabelMapping||'off'}:{}),
          ...(state.candidate?{classifier:state.percussionClassifier}:{}),
          ...(state.candidate&&(state.hybridMode!=='L0'||privatePercussionDiagnostics||(privateHatLabelMapping||'off')!=='off'||(semanticPrecisionGuards?.mode||'off')!=='off')?{onDiagnostic(result){
            if(active!==state||state.percussionOwner!==owner)return;
            if(result.detectorModel==='CNN-B'){
              state.hybridObservations||=[];
              for(const event of result.events||[])state.hybridObservations.push({...event,shadow:state.hybridMode==='H-SHADOW',
                sourceId:state.sourceId,sourceGeneration:state.sourceGeneration,synchronizationEpoch:owner.epoch,
                companionReceiveTime:result.mainThreadReceivedAt});
              if(state.hybridObservations.length>512)state.hybridObservations.splice(0,state.hybridObservations.length-512);
              return;
            }
            if(result.guardDecisions){
              state.precisionDecisions||=[];state.precisionDecisions.push(...result.guardDecisions);
              if(state.precisionDecisions.length>512)state.precisionDecisions.splice(0,state.precisionDecisions.length-512);
            }
            if(result.labelCandidates){state.labelCandidates||=[];state.labelCandidates.push(...result.labelCandidates);
              if(state.labelCandidates.length>512)state.labelCandidates.splice(0,state.labelCandidates.length-512);}
            if(((semanticPrecisionGuards?.mode||'off')!=='off'||(privateHatLabelMapping||'off')!=='off')&&result.diagnostics){
              state.precisionFrames||=[];state.precisionFrames.push(...result.diagnostics);
              if(state.precisionFrames.length>512)state.precisionFrames.splice(0,state.precisionFrames.length-512);
            }
            if(!privatePercussionDiagnostics)return;
            if(result.kind==='features'){
              state.diagnosticFeatures.push(result);
              if(state.diagnosticFeatures.length>400)state.diagnosticFeatures.shift();
            }
            for(const frame of result.diagnostics||[]){
              state.diagnosticFrames.push({...frame,receivedAudioTime:result.receivedAudioTime,
                receivedAt:result.mainThreadReceivedAt,inferenceStartedAt:result.inferenceStartedAt,inferenceEndedAt:result.inferenceEndedAt,
                ...outputTiming(state.context,frame.audioTime+(state.context.baseLatency||0)+(state.context.outputLatency||0)+state.bufferMs/1000)});
              if(state.diagnosticFrames.length>1800){state.diagnosticFrames.shift();state.diagnosticEvicted++;}
            }
          }}:{}),
          onFailure: failed,
          onProgress() {
            if (active !== state || state.percussionOwner !== owner || owner.epoch!==state.synchronizationEpoch) return;
            state.percussionFailures = 0;
            if (state.percussionRecovery) {
              telemetry.record('CAPTURE_RECOVERED', undefined, { captureId, reason: state.percussionRecovery });
              state.percussionRecovery = undefined;
            }
          },
          onEvent(event) {
            if(event.detectorModel==='CNN-B'&&state.hybridMode!=='H-LIVE'
              ||state.hybridMode==='H-LIVE'&&event.band==='hat'&&event.detectorModel!=='CNN-B')return;
            if (active !== state || state.percussionOwner !== owner || owner.epoch!==state.synchronizationEpoch || !['kick', 'clap', 'hat'].includes(event.band)
              || !Number.isFinite(event.audioTime) || !Number.isFinite(event.confidence)
              || event.confidence < 0 || event.confidence > 1 || !Number.isFinite(event.classMargin) || event.classMargin < 0) return;
            const observed=state.candidate&&(privatePercussionDiagnostics||(privateHatLabelMapping||'off')!=='off'||recording?.active)?{
              ...((privateHatLabelMapping||'off')!=='off'?state.labelCandidates?.find(candidate=>
                candidate.originalClassIndex===event.classIndex&&candidate.audioTime===event.audioTime&&candidate.mapping===(privateHatLabelMapping==='M1'?'M1':'M0')):{}),
              ...event,receivedAt:Date.now(),receivedAudioTime:state.context.currentTime,
              captureId:state.captureId,rejected:null,traceId:null}:undefined;
            if(observed){state.diagnosticPredictions.push(observed);if(state.diagnosticPredictions.length>512)state.diagnosticPredictions.shift();}
            if(state.candidate){
              const latency=(state.context.currentTime-event.audioTime)*1000;
              if(Number.isFinite(latency)&&latency>=0){state.latencies.push(latency);if(state.latencies.length>512)state.latencies.shift();}
              if(!state.typedPreview||event.audioTime<state.acceptAfter){
                if(observed)observed.rejected=!state.typedPreview?'typed-preview-disabled':'pre-configuration-boundary';
                if(observed)recording?.append('emissions',observed);
                state.droppedSemanticEvents++;return;
              }
            }
            const at = now() + (event.audioTime - state.context.currentTime) * 1000;
            if (event.band === 'kick') tempo.snapToBeat(at);
            drumHits.push(at);
            const trace = telemetry.events('onset', [event.band], { captureId,
              origin: 'local-detector', confidence: event.confidence, targetTime: event.audioTime, targetClock: 'audio-seconds' });
            if(event.detectorModel==='CNN-B')for(const item of trace||[])Object.assign(item,{detectorModel:'CNN-B',originalClassIndex:2,
              ...event.timing});
            else if(state.candidate&&Number.isInteger(event.classIndex)&&event.classIndex>=0&&event.classIndex<5)
              for(const item of trace||[])Object.assign(item,{originalClassIndex:event.classIndex,
                percussionLabelMapping:privateHatLabelMapping==='M1'?'M1':'M0'});
            if(Number.isFinite(event.timing?.decisionAt))for(const item of trace||[])item.detectorReadyAt=event.timing.decisionAt;
            if(observed)observed.traceId=trace?.[0]?.id||null;
            percussionTelemetry.mark('EVENT_DETECTED', trace, { semantic: true, audioTime:event.audioTime });
            if (event.timing) percussionTelemetry.mark('DETECTOR_TIMING', trace, {
              ...event.timing, audioTime: event.audioTime, receivedAt: Date.now(),
            });
            enqueue('beat', [event.band], event.audioTime, trace, true);
            if(observed)recording?.append('emissions',{...observed,enqueued:true});
          },
        }).then(runtime => {
          if (active !== state || state.percussionOwner !== owner || owner.epoch!==state.synchronizationEpoch) { runtime?.stop(); return; }
          if (runtime) owner.runtime = runtime;
          else failed();
        }).catch(() => failed());
      };
      state.restartPercussion=()=>{
        finishRecording('detector-or-source-reset');
        state.precisionDecisions=[];
        state.precisionFrames=[];state.hybridObservations=[];
        state.labelCandidates=[];
        const previous=state.percussionOwner;
        state.percussionOwner=undefined;
        previous?.abort.abort();previous?.runtime?.stop();
        drumHits.length=0;
        state.latencies.length=0;
        state.diagnosticFrames.length=0;state.diagnosticPredictions.length=0;state.diagnosticFeatures.length=0;
        startPercussion();
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
      const epoch=owner?.synchronizationEpoch;
      if (monitorOnly || owner?.captureId !== captureId || owner.context?.state !== 'running') return;
      owner.audioTapUntil = now() + 1000;
      if (!owner.audioTap && !owner.audioTapStarting) {
        owner.audioTapStarting = createAudioTap({ context: owner.context, source: owner.source, ownership:{captureId,sourceId:owner.sourceId,sourceGeneration:owner.sourceGeneration,synchronizationEpoch:epoch} }).then(tap => {
          if (active !== owner || epoch!==owner.synchronizationEpoch || now() > owner.audioTapUntil) { tap?.stop(); return; }
          owner.audioTap = tap;
        }).catch(() => {}).finally(() => { owner.audioTapStarting = undefined; });
      }
      await owner.audioTapStarting;
      if (active !== owner || epoch!==owner.synchronizationEpoch || now() > owner.audioTapUntil) return;
      const packet = owner.audioTap?.read();
      if (!packet) return;
      const timing = outputTiming(owner.context, packet.endTime);
      return timing ? { pcm: packet.pcm, sequence: packet.sequence, sampleRate: 44100, sourceId:owner.sourceId,sourceGeneration:owner.sourceGeneration,synchronizationEpoch:epoch,...timing } : undefined;
    },
    get delaySeconds() { return (active?.bufferMs||0)/1000; },
    get precisionDiagnostics(){return active?.candidate?{mode:semanticPrecisionGuards?.mode||'off',captureId:active.captureId,
      sourceId:active.sourceId,sourceGeneration:active.sourceGeneration,synchronizationEpoch:active.synchronizationEpoch,
      decisions:active.precisionDecisions?.slice()||[],frames:active.precisionFrames?.slice()||[],capacity:512}:undefined;},
    get labelDiagnostics(){return active?.candidate&&(privateHatLabelMapping||'off')!=='off'?{
      captureId:active.captureId,sourceId:active.sourceId,sourceGeneration:active.sourceGeneration,synchronizationEpoch:active.synchronizationEpoch,
      mode:privateHatLabelMapping,detectorVariant:active.percussionClassifier==='early-finalization'?'L1-gap0':'L0',guardMode:semanticPrecisionGuards?.mode||'off',capacity:512,
      candidates:active.labelCandidates?.slice()||[],frames:active.precisionFrames?.slice()||[],
      emissions:active.diagnosticPredictions.map(event=>({...active.labelCandidates?.find(candidate=>
        candidate.originalClassIndex===event.classIndex&&candidate.audioTime===event.audioTime&&candidate.mapping===(privateHatLabelMapping==='M1'?'M1':'M0')),
        ...event,originalClassIndex:event.classIndex,
        originalClassName:ADTOF_CLASS_NAMES[event.classIndex],rawClassScore:event.confidence,peakNovelty:event.value,
        mappedSemanticKind:event.band,finalEmissionDecision:event.rejected||'enqueued-for-transport',
        actualVisualFlash:'NOT_MEASURED'})),
      clock:{audioTime:active.context.currentTime,sampledAt:Date.now(),bufferMs:active.bufferMs},
    }:undefined;},
    get calibration(){return calibration(active);},
    get health(){return active?{context:active.context?.state,bufferMs:active.bufferMs,
      hybridMode:active.hybridMode,hybridFailure:active.percussionRecovery||null,
      hybridObservedEvents:active.hybridObservations?.length||0,
      queuedEvents:active.events.length,droppedSemanticEvents:active.droppedSemanticEvents,
      dropReason:active.typedPreview?'none':'detector-unqualified',workerFailures:active.percussionFailures||0}:undefined;},
    get percussionDiagnostics(){
      if(!active?.candidate||!privatePercussionDiagnostics)return undefined;
      return {captureId:active.captureId,classifier:active.percussionClassifier,
        hybrid:{mode:active.hybridMode,events:active.hybridObservations?.slice()||[],capacity:512},frames:active.diagnosticFrames.slice(),
        predictions:active.diagnosticPredictions.slice(),featureBlocks:active.diagnosticFeatures.slice(),
        clock:diagnosticClock(active),evictedFrames:active.diagnosticEvicted,limitFrames:1800,limitFeatureBlocks:400};
    },
    get percussionClock(){return diagnosticClock(active);},
    configureSynchronization(captureId,settings){
      const state=active;
      if(!state?.candidate||state.captureId!==captureId||monitorOnly
        ||settings?.detectorVariant!==undefined&&!['L0','L1-gap0','H-SHADOW','H-LIVE'].includes(settings.detectorVariant)
        ||settings?.detectorVariant==='L1-gap0'&&settings.live!==true
        ||!Number.isFinite(settings?.bufferMs)||settings.bufferMs<0||settings.bufferMs>500
        ||settings.live===true&&(settings.bufferMs!==0||state.bufferMs!==0)
        ||settings.bufferMs>0&&(!settings.eligible||settings.paused!==true
          &&!(settings.resume===true&&settings.flush===true&&state.outputPaused&&settings.bufferMs===state.bufferMs))
        ||settings.flush!==true&&settings.paused!==true&&settings.live!==true)return false;
      state.events.length=0;
      state.synchronizationEpoch=typeof settings.epoch==='string'&&/^[a-zA-Z0-9:_-]{1,160}$/.test(settings.epoch)
        ?settings.epoch:crypto.randomUUID();
      state.acceptAfter=state.context.currentTime;
      state.audioTap?.stop();state.audioTap=undefined;
      state.resetDetectors?.(state.bufferMs>0||settings.bufferMs>0);
      state.typedPreview=settings.eligible===true&&settings.allowTypedPreview===true;
      state.hybridMode=settings.eligible===true&&['H-SHADOW','H-LIVE'].includes(settings.detectorVariant)?settings.detectorVariant:'L0';
      const classifier=settings.live===true&&state.typedPreview&&settings.detectorVariant==='L1-gap0'
        ?'early-finalization':privatePercussionClassifier;
      if(classifier!==state.percussionClassifier){
        state.percussionClassifier=classifier;
        telemetry.record('DETECTOR_CHANGED',undefined,{captureId,classifier});
      }
      state.restartPercussion();
      if(settings.live===true)return true;
      try{return setOutput(state,settings.bufferMs,settings.paused===true);}
      catch{stop('failed');return false;}
    },
    diagnosticCapture(captureId,operation,recordingId,durationSeconds=30){
      if(!privateBeatCandidate||typeof recordingId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(recordingId))return {ok:false,error:'unavailable'};
      if(![30,60,90].includes(durationSeconds))return {ok:false,error:'unavailable'};
      const state=active;
      if(operation==='start'){
        if(recording?.active||!state?.candidate||state.captureId!==captureId||!state.percussionOwner?.runtime?.recordDiagnostics)return {ok:false,error:'detector-not-ready'};
        recording=new LiveDiagnosticRecorder({recordingId,captureId,sourceId:state.sourceId,sourceGeneration:state.sourceGeneration,
          synchronizationEpoch:state.synchronizationEpoch,audioContextStart:state.context.currentTime+1,windowLeadMs:1000,
          configuredAudioDelayMs:state.bufferMs,classifier:state.percussionClassifier,
          hybridMode:state.hybridMode,durationSeconds,
          labelMapping:privateHatLabelMapping==='M1'?'M1':'M0',precisionGuards:semanticPrecisionGuards?.mode||'off',
          baseLatency:state.context.baseLatency,outputLatency:state.context.outputLatency});
        recordPriorTelemetry=beatTelemetry.enabled;beatTelemetry.enable();
        recordUnsubscribe=beatTelemetry.subscribe(record=>{if(record.captureId===captureId&&['EVENT_DROPPED','EVENT_LATE','OUTPUT_ROUTE_CHANGED'].includes(record.stage))recording?.append('issues',record);});
        if(!state.percussionOwner.runtime.recordDiagnostics(recordingId,true)){finishRecording('worker-unavailable');return {ok:false,error:'worker-unavailable'};}
        recordTimer=setTimeout(()=>finishRecording('window-ended'),durationSeconds*1000+2000);
      }else if(!recording||recording.meta.recordingId!==recordingId||recording.meta.captureId!==captureId)return {ok:false,error:'recording-not-found'};
      if(operation==='stop'){finishRecording('owner-stopped');beatTelemetry.enable(recordPriorTelemetry);}
      if(!recording.active)beatTelemetry.enable(recordPriorTelemetry);
      return {ok:true,recording:recording.snapshot(operation==='read')};
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
