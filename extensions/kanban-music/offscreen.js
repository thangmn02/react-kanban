import { createCaptureEngine } from './capture-engine.js';

const send = (message) => { void chrome.runtime.sendMessage({ target: 'beat-worker', ...message }).catch(() => {}); };
const engine = createCaptureEngine({
  getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  createAudioContext: () => new AudioContext(),
  onBeat: (captureId, bands) => send({ kind: 'onset', captureId, bands }),
  onStop: (captureId, reason) => send({ kind: 'stopped', captureId, reason }),
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.tab || message?.target !== 'beat-offscreen') return false;
  if (message.kind === 'start' && typeof message.streamId === 'string') {
    const timeout = setTimeout(() => engine.stopCapture(message.captureId), 4000);
    void engine.start(message.streamId, message.captureId).then((ok) => { clearTimeout(timeout); respond({ ok }); });
    return true;
  }
  if (message.kind === 'stop') engine.stopCapture(message.captureId);
  if (message.kind === 'lease') { respond({ ok: engine.renew(message.captureId) }); return false; }
  respond({ ok: true });
  return false;
});
