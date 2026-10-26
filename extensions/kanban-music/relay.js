// Runs only in the Kanban app. The page never needs an extension ID.
const allowedOrigins = new Set([
  'https://kanthangboard.netlify.app',
  'https://koraspace.online',
  'http://localhost:5173', 'http://localhost:5174',
  'http://127.0.0.1:5173', 'http://127.0.0.1:5174',
  'http://localhost:1420', 'http://127.0.0.1:1420',
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
      || !['sessions.get', 'diagnostics.get', 'beat.diagnostics', 'beat.experimental.configure', 'media.play', 'media.pause', 'media.focus', 'media.seek', 'media.volume', 'media.previous', 'media.next', 'dock.beat.sync.start', 'dock.beat.sync.stop', 'dock.audio.read'].includes(message.action) || pending >= 4) return;
    if(message.action==='beat.diagnostics'&&(!['http://127.0.0.1:1420','http://localhost:1420'].includes(location.origin)
      ||!['start','status','read','stop'].includes(message.diagnostic?.operation)
      ||typeof message.diagnostic?.recordingId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(message.diagnostic.recordingId)
      ||message.diagnostic.durationSeconds!==undefined&&![30,60,90].includes(message.diagnostic.durationSeconds)))return;
    if (message.action === 'media.seek' && (!Number.isFinite(message.value) || message.value < 0 || message.value > 864000)) return;
    if (message.action === 'media.volume' && (!Number.isFinite(message.value) || message.value < 0 || message.value > 1)) return;
    if (!['sessions.get', 'diagnostics.get'].includes(message.action) && (typeof message.sessionId !== 'string' || message.sessionId.length > 250)) return;
    if (message.action.startsWith('dock.') && (typeof message.subscriptionId !== 'string' || !message.subscriptionId.length || message.subscriptionId.length > 100)) return;
    if (message.action === 'beat.experimental.configure' && message.configuration?.detectorVariant !== undefined
      && !['L0', 'L1-gap0','H-SHADOW','H-LIVE'].includes(message.configuration.detectorVariant)) return;
    pending++;
    const reply = (result) => {
      pending--;
      window.postMessage({ channel, direction: 'extension-to-app', requestId: message.requestId, ...result }, location.origin);
    };
    try {
      chrome.runtime.sendMessage({ protocol: channel, action: message.action, sessionId: message.sessionId,
        ...(message.action==='beat.diagnostics'?{diagnostic:{operation:message.diagnostic.operation,recordingId:message.diagnostic.recordingId,
          ...(message.diagnostic.durationSeconds!==undefined?{durationSeconds:message.diagnostic.durationSeconds}:{})}}:{}),
        ...(message.action === 'beat.experimental.configure' ? { configuration: {
          enabled: message.configuration?.enabled, captureId: String(message.configuration?.captureId || '').slice(0,160),
          generation: message.configuration?.generation, intentionalDelay: message.configuration?.intentionalDelay===true,
          outputHeard: message.configuration?.outputHeard===true, authorizedAudio: message.configuration?.authorizedAudio===true,
          preview: message.configuration?.preview===true,
          live: message.configuration?.live===true, latencyAccepted: message.configuration?.latencyAccepted===true,
          ...(message.configuration?.detectorVariant!==undefined?{detectorVariant:message.configuration.detectorVariant}:{}),
          ...(message.configuration?.compensationMs!==undefined?{compensationMs:message.configuration.compensationMs}:{}),
        } } : {}),
        ...(message.action === 'dock.beat.sync.start' && typeof message.telemetryEnabled === 'boolean' ? { telemetryEnabled: message.telemetryEnabled } : {}),
        ...(message.value !== undefined ? { value: message.value } : {}),
        ...(message.subscriptionId ? { subscriptionId: message.subscriptionId } : {}) }, (response) => {
        if (chrome.runtime.lastError) reply({ ok: false, error: 'unavailable' });
        else reply(response || { ok: false, error: 'unavailable' });
      });
    } catch { reply({ ok: false, error: 'unavailable' }); }
  });
}
