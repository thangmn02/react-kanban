import { createCaptureEngine } from './capture-engine.js';
import { prepareInstrumentCapture } from './instrument-runtime.js';
import { beatTelemetry } from './beat-telemetry.js';
const telemetry = beatTelemetry.at('offscreen');

const settings = await chrome.storage.local.get(['instrumentNotesEnabled', 'beatTelemetryEnabled']);
beatTelemetry.enable(settings.beatTelemetryEnabled === true);
let instrumentEnabled = settings.instrumentNotesEnabled === true;

const send = (message) => { telemetry.mark('EVENT_SENT', message.telemetry); void chrome.runtime.sendMessage({ target: 'beat-worker', ...message }).catch(() => { telemetry.mark('EVENT_DROPPED', message.telemetry, { reason: 'transport' }); }); };
const metadata = (telemetry) => telemetry ? { telemetry } : {};
const engine = createCaptureEngine({
  getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  createAudioContext: () => new AudioContext({ sampleRate: 44100 }),
  createInstrumentCapture: (options) => instrumentEnabled ? prepareInstrumentCapture(options) : null,
  onInstrumentFailure: (message) => { void chrome.storage.local.set({ instrumentNotesError: message }); },
  onBeat: (captureId, bands, trace) => send({ kind: 'onset', captureId, bands, ...metadata(trace) }),
  onTempo: (captureId, tempo, trace) => send({ kind: 'tempo.state', captureId, tempo, ...metadata(trace) }),
  onTempoTick: (captureId, tick, trace) => send({ kind: 'tempo.tick', captureId, tick, ...metadata(trace) }),
  onMelody: (captureId, melody, trace) => send({ kind: 'melody.state', detector: 'instrument-v1', captureId, melody, ...metadata(trace) }),
  onAudible: (captureId) => send({ kind: 'audible', captureId }),
  onStop: (captureId, reason) => send({ kind: 'stopped', captureId, reason }),
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.beatTelemetryEnabled) beatTelemetry.enable(changes.beatTelemetryEnabled.newValue === true);
  if (area !== 'local' || !changes.instrumentNotesEnabled && !changes.instrumentNotesRevision) return;
  if (changes.instrumentNotesEnabled) instrumentEnabled = changes.instrumentNotesEnabled.newValue === true;
  engine.stop('reconfigured');
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.tab || message?.target !== 'beat-offscreen') return false;
  if (message.kind === 'start' && typeof message.streamId === 'string') {
    const timeout = setTimeout(() => engine.stopCapture(message.captureId), 4000);
    void engine.start(message.streamId, message.captureId).then((ok) => { clearTimeout(timeout); respond({ ok, delaySeconds: engine.delaySeconds }); });
    return true;
  }
  if (message.kind === 'stop') engine.stopCapture(message.captureId);
  if (message.kind === 'lease') { respond({ ok: engine.renew(message.captureId) }); return false; }
  respond({ ok: true });
  return false;
});
