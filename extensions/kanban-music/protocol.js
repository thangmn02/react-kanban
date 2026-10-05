export const appOrigins = new Set([
  'https://kanthangboard.netlify.app',
  'http://localhost:5173', 'http://localhost:5174',
  'http://127.0.0.1:5173', 'http://127.0.0.1:5174',
]);

export function allowedRequest(message, sender) {
  try {
    const origin = new URL(sender.url).origin;
    if (!appOrigins.has(origin) || (sender.origin && sender.origin !== origin)) return false;
    return message?.protocol === 'kanban-music-v1' && (
      message.action === 'sessions.get'
      || message.action === 'diagnostics.get'
      || (['media.play', 'media.pause', 'media.focus', 'instrument.setup'].includes(message.action) && typeof message.sessionId === 'string' && message.sessionId.length < 250)
      || (['dock.beat.sync.start', 'dock.beat.sync.stop'].includes(message.action)
        && typeof message.sessionId === 'string' && message.sessionId.length < 250
        && typeof message.subscriptionId === 'string' && message.subscriptionId.length > 0 && message.subscriptionId.length <= 100)
    );
  } catch { return false; }
}
