import { createCaptureEngine } from './capture-engine.js';
import { prepareInstrumentCapture } from './instrument-runtime.js';

let instrumentEnabled = (await chrome.storage.local.get('instrumentNotesEnabled')).instrumentNotesEnabled === true;

const send = (message) => { void chrome.runtime.sendMessage({ target: 'beat-worker', ...message }).catch(() => {}); };
const engine = createCaptureEngine({
  getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  createAudioContext: () => new AudioContext({ sampleRate: 44100 }),
  createInstrumentCapture: (options) => instrumentEnabled ? prepareInstrumentCapture(options) : null,
  onInstrumentFailure: (message) => { void chrome.storage.local.set({ instrumentNotesError: message }); },
  onBeat: (captureId, bands) => send({ kind: 'onset', captureId, bands }),
  onTempo: (captureId, tempo) => send({ kind: 'tempo.state', captureId, tempo }),
  onTempoTick: (captureId, tick) => send({ kind: 'tempo.tick', captureId, tick }),
  onMelody: (captureId, melody) => send({ kind: 'melody.state', detector: 'instrument-v1', captureId, melody }),
  onAudible: (captureId) => send({ kind: 'audible', captureId }),
  onStop: (captureId, reason) => send({ kind: 'stopped', captureId, reason }),
});
chrome.storage.onChanged.addListener((changes, area) => {
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
