import { createCaptureEngine } from './capture-engine.js';
import { beatTelemetry } from './beat-telemetry.js';
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
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.tab || message?.target !== 'beat-offscreen') return false;
  if (message.kind === 'start' && typeof message.streamId === 'string') {
    beatTelemetry.enable(message.telemetryEnabled === true);
    const timeout = setTimeout(() => engine.stopCapture(message.captureId), 4000);
    void engine.start(message.streamId, message.captureId).then((ok) => { clearTimeout(timeout); respond({ ok, delaySeconds: engine.delaySeconds,
      ...(!ok && engine.lastFailure ? { captureError: engine.lastFailure } : {}) }); });
    return true;
  }
  if (message.kind === 'stop') engine.stopCapture(message.captureId);
  if (message.kind === 'audio.read') {
    void engine.readAudio(message.captureId).then(packet => respond({ ok: true, packet }), () => respond({ ok: false }));
    return true;
  }
  if (message.kind === 'lease') { beatTelemetry.enable(message.telemetryEnabled === true); respond({ ok: engine.renew(message.captureId) }); return false; }
  respond({ ok: true });
  return false;
});
