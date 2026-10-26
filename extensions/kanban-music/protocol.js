import { validSyncConfiguration } from './beat-mode.js';
export function validDiagnosticRequest(value){return value&&['start','status','read','stop'].includes(value.operation)
  &&typeof value.recordingId==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value.recordingId)
  &&(value.durationSeconds===undefined||[30,60,90].includes(value.durationSeconds));}
export const appOrigins = new Set([
  'https://kanthangboard.netlify.app',
  'https://koraspace.online',
  'http://localhost:5173', 'http://localhost:5174',
  'http://127.0.0.1:5173', 'http://127.0.0.1:5174',
  'http://localhost:1420', 'http://127.0.0.1:1420',
]);

export function allowedRequest(message, sender) {
  try {
    const origin = new URL(sender.url).origin;
    if (!appOrigins.has(origin) || (sender.origin && sender.origin !== origin)) return false;
    return message?.protocol === 'kanban-music-v1' && (
      message.action === 'sessions.get'
      || message.action === 'diagnostics.get'
      || (message.action==='beat.diagnostics'&&['http://127.0.0.1:1420','http://localhost:1420'].includes(origin)
        &&validDiagnosticRequest(message.diagnostic)&&typeof message.sessionId==='string'&&message.sessionId.length<250)
      || (message.action === 'beat.experimental.configure' && validSyncConfiguration(message.configuration)
        && typeof message.sessionId === 'string' && message.sessionId.length < 250)
      || ((['media.play', 'media.pause', 'media.focus', 'media.previous', 'media.next'].includes(message.action)
        || message.action === 'media.seek' && Number.isFinite(message.value) && message.value >= 0 && message.value <= 864000
        || message.action === 'media.volume' && Number.isFinite(message.value) && message.value >= 0 && message.value <= 1)
        && typeof message.sessionId === 'string' && message.sessionId.length < 250)
      || (['dock.beat.sync.start', 'dock.beat.sync.stop', 'dock.audio.read'].includes(message.action)
        && typeof message.sessionId === 'string' && message.sessionId.length < 250
        && typeof message.subscriptionId === 'string' && message.subscriptionId.length > 0 && message.subscriptionId.length <= 100)
    );
  } catch { return false; }
}
