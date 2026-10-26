import { createCaptureEngine } from './capture-engine.js';
import { beatTelemetry } from './beat-telemetry.js';
import { privateBeatCandidate, privatePercussionDiagnostics } from './beat-candidate.js';
const telemetry = beatTelemetry.at('offscreen');

const send = (message) => { telemetry.mark('EVENT_SENT', message.telemetry); void chrome.runtime.sendMessage({ target: 'beat-worker', ...message }).catch(() => { telemetry.mark('EVENT_DROPPED', message.telemetry, { reason: 'transport' }); }); };
const metadata = (telemetry, timing) => ({ ...(telemetry ? { telemetry } : {}), ...(timing || {}) });
const engine = createCaptureEngine({
  getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  createAudioContext: () => new AudioContext({ sampleRate: 44100 }),
  onBeat: (captureId, bands, trace, timing) => send({ kind: 'onset', captureId, bands, ...metadata(trace, timing) }),
  onTempo: (captureId, tempo, trace, timing) => send({ kind: 'tempo.state', captureId, tempo, ...metadata(trace, timing) }),
  onTempoTick: (captureId, tick, trace, timing) => send({ kind: 'tempo.tick', captureId, tick, ...metadata(trace, timing) }),
  onAudible: (captureId) => send({ kind: 'audible', captureId }),
  onStop: (captureId, reason) => send({ kind: 'stopped', captureId, reason,
    ...(engine.lastFailure ? { captureError: engine.lastFailure } : {}) }),
});
navigator.mediaDevices?.addEventListener?.('devicechange',()=>{
  if(engine.delaySeconds>0)void engine.stop('output-device-changed');
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.tab || message?.target !== 'beat-offscreen') return false;
  if(privateBeatCandidate&&message.kind==='precision-diagnostics'){respond(engine.precisionDiagnostics||{});return false;}
  if(privateBeatCandidate&&message.kind==='label-diagnostics'){respond(engine.labelDiagnostics||{});return false;}
  if(privateBeatCandidate&&privatePercussionDiagnostics&&message.kind==='percussion-diagnostics') {respond(engine.percussionDiagnostics||{});return false;}
  if(privateBeatCandidate&&privatePercussionDiagnostics&&message.kind==='percussion-clock') {respond(engine.percussionClock||{});return false;}
  if(privateBeatCandidate&&message.kind==='diagnostics') {respond({health:engine.health,telemetry:beatTelemetry.snapshot()});return false;}
  if(privateBeatCandidate&&message.kind==='diagnostic-capture'){respond(engine.diagnosticCapture(message.captureId,message.operation,message.recordingId,message.durationSeconds));return false;}
  if (message.kind === 'start' && typeof message.streamId === 'string') {
    beatTelemetry.enable(message.telemetryEnabled === true);
    const timeout = setTimeout(() => engine.stopCapture(message.captureId), 4000);
    void engine.start(message.streamId, message.captureId, {candidate:message.candidate===true,sourceProvider:message.sourceProvider,
      sourceId:message.sourceId,sourceGeneration:message.sourceGeneration,synchronizationEpoch:message.synchronizationEpoch}).then((ok) => { clearTimeout(timeout); respond({ ok, delaySeconds: engine.delaySeconds,
      ...(!ok && engine.lastFailure ? { captureError: engine.lastFailure } : {}) }); });
    return true;
  }
  if (message.kind === 'stop') {void Promise.resolve(engine.stopCapture(message.captureId)).then(()=>respond({ok:true}));return true;}
  if (message.kind === 'synchronization') {respond({ok:engine.configureSynchronization(message.captureId,message.settings)});return false;}
  if (message.kind === 'audio.read') {
    void engine.readAudio(message.captureId).then(packet => respond({ ok: true, packet }), () => respond({ ok: false }));
    return true;
  }
  if (message.kind === 'lease') { beatTelemetry.enable(message.telemetryEnabled === true); respond({ ok: engine.renew(message.captureId),calibration:engine.calibration,
    ...(privateBeatCandidate?{health:engine.health}:{}) }); return false; }
  respond({ ok: true });
  return false;
});
