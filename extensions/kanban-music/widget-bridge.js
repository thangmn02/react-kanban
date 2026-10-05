// Only metadata and validated beat events cross this loopback connection.
// No PCM, microphone, desktop audio or arbitrary page commands.
export function createWidgetBridge({ api, handle, disconnected, Socket = WebSocket }) {
  let socket;
  let nonce;
  let heartbeat;
  let retry;
  let stopped = false;
  const send = (value) => {
    if (!nonce || socket?.readyState !== 1) return false;
    socket.send(JSON.stringify({ ...value, nonce })); return true;
  };
  const valid = (request) => request?.type === 'request' && request.nonce === nonce
    && typeof request.requestId === 'string' && request.requestId.length <= 100
    && (request.action === 'sessions.get'
      || ['media.play', 'media.pause', 'media.focus', 'instrument.setup'].includes(request.action) && typeof request.sessionId === 'string' && request.sessionId.length <= 250
      || ['dock.beat.sync.start', 'dock.beat.sync.stop'].includes(request.action)
        && typeof request.sessionId === 'string' && request.sessionId.length <= 250
        && typeof request.subscriptionId === 'string' && request.subscriptionId.length > 0 && request.subscriptionId.length <= 100);
  function connect() {
    if (stopped || socket && socket.readyState < 2) return;
    const current = new Socket('ws://127.0.0.1:47635/kora-music');
    socket = current;
    current.onmessage = async ({ data }) => {
      if (current !== socket || typeof data !== 'string' || data.length > 65536) return;
      let request;
      try { request = JSON.parse(data); } catch { return; }
      if (request.type === 'hello' && request.protocol === 'kora-widget-v1' && typeof request.nonce === 'string' && request.nonce.length === 36) {
        nonce = request.nonce;
        send({ type: 'hello', protocol: 'kora-widget-v1' });
        clearInterval(heartbeat);
        heartbeat = setInterval(() => send({ type: 'keepalive' }), 20000);
        return;
      }
      if (!valid(request)) return;
      const owner = nonce;
      let result;
      try { result = await handle(request, { native: owner }); }
      catch { result = { ok: false, error: 'unavailable' }; }
      if (current === socket && owner === nonce) send({ ...result, type: 'response', requestId: request.requestId });
    };
    current.onclose = () => {
      if (current !== socket) return;
      const owner = nonce;
      nonce = undefined; socket = undefined; clearInterval(heartbeat);
      if (owner) void disconnected(owner);
      if (!stopped) retry = setTimeout(connect, 3000);
    };
    current.onerror = () => current.close();
  }
  // Alarms wake an idle/restarted service worker; successful sockets keep alive
  // below Chrome's 30-second inactivity deadline. No app/browser tab required.
  if (api?.alarms) {
    void api.alarms.create('kora-widget-reconnect', { periodInMinutes: 0.5 });
    api.alarms.onAlarm.addListener((alarm) => { if (alarm.name === 'kora-widget-reconnect') connect(); });
  }
  return {
    connect,
    get connected() { return Boolean(nonce && socket?.readyState === 1); },
    beat(owner, event) { if (owner === nonce) return send({ ...event, type: 'beat', emittedAt: Date.now() }); return false; },
    close() { stopped = true; clearTimeout(retry); clearInterval(heartbeat); socket?.close(); },
  };
}
