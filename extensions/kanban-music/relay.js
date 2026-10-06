// Runs only in the Kanban app. The page never needs an extension ID.
const allowedOrigins = new Set([
  'https://kanthangboard.netlify.app',
  'https://koraspace.online',
  'http://localhost:5173', 'http://localhost:5174',
  'http://127.0.0.1:5173', 'http://127.0.0.1:5174',
]);
const channel = 'kanban-music-v1';
let pending = 0;

if (allowedOrigins.has(location.origin)) {
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.protocol !== channel || message.event !== 'beat') return;
    window.postMessage({ channel, direction: 'extension-event', ...message }, location.origin);
    respond({ ok: true });
    return false;
  });
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin || !message
      || message.channel !== channel || message.direction !== 'app-to-extension'
      || typeof message.requestId !== 'string' || message.requestId.length > 100
      || !['sessions.get', 'diagnostics.get', 'media.play', 'media.pause', 'media.focus', 'instrument.setup', 'dock.beat.sync.start', 'dock.beat.sync.stop'].includes(message.action) || pending >= 4) return;
    if (!['sessions.get', 'diagnostics.get'].includes(message.action) && (typeof message.sessionId !== 'string' || message.sessionId.length > 250)) return;
    if (message.action.startsWith('dock.beat.') && (typeof message.subscriptionId !== 'string' || message.subscriptionId.length > 100)) return;
    pending++;
    const reply = (result) => {
      pending--;
      window.postMessage({ channel, direction: 'extension-to-app', requestId: message.requestId, ...result }, location.origin);
    };
    try {
      chrome.runtime.sendMessage({ protocol: channel, action: message.action, sessionId: message.sessionId,
        ...(message.subscriptionId ? { subscriptionId: message.subscriptionId } : {}) }, (response) => {
        if (chrome.runtime.lastError) reply({ ok: false, error: 'unavailable' });
        else reply(response || { ok: false, error: 'unavailable' });
      });
    } catch { reply({ ok: false, error: 'unavailable' }); }
  });
}
