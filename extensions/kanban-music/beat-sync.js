const offscreenPath = 'offscreen.html';
const validBands = new Set(['kick', 'bass', 'snare', 'hat']);
const sameOwner = (a, b) => a.tabId === b.tabId && a.documentId === b.documentId;
const timeout = (promise, ms) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timeout')), ms); })]).finally(() => clearTimeout(timer));
};

export function createBeatSync(api) {
  let state;
  let creating;
  let queue = Promise.resolve();
  const serialize = (fn) => { queue = queue.catch(() => {}).then(fn); return queue; };
  const offscreenMessage = (message) => api.runtime.sendMessage({ target: 'beat-offscreen', ...message });

  function clockReason(current) {
    if (current.mode === 'capture') return undefined;
    if (!current.clock?.playing) return 'not-playing';
    if (current.clock.muted || current.tabMuted) return 'muted';
    return current.fallbackReason || (current.captureId ? 'starting' : 'clock');
  }

  function publishState(current) {
    publish(current, { kind: 'sync.state', mode: current.mode, reason: clockReason(current), captureId: current.mode === 'capture' ? current.captureId : undefined });
  }

  function publish(current, event) {
    if (state !== current) return;
    void api.tabs.sendMessage(current.owner.tabId, { protocol: 'kanban-music-v1', event: 'beat',
      sessionId: current.session.id, subscriptionId: current.subscriptionId, ...event },
    { documentId: current.owner.documentId }).catch(() => { void stopIfCurrent(current); });
  }

  async function ensureOffscreen() {
    if (creating) return creating;
    creating = (async () => {
      const contexts = await api.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [api.runtime.getURL(offscreenPath)] });
      if (!contexts.length) await api.offscreen.createDocument({ url: offscreenPath, reasons: ['USER_MEDIA'],
        justification: 'Analyze the selected music tab locally for beat lighting and preserve its audible playback.' });
    })();
    try { await creating; } finally { creating = undefined; }
  }

  function cancelCapture(current) {
    const captureId = current.captureId;
    if (!captureId && current.mode === 'clock') return;
    current.captureId = undefined;
    current.mode = 'clock';
    publishState(current);
    if (captureId) void offscreenMessage({ kind: 'stop', captureId }).catch(() => {});
  }

  async function capture(current, force = false) {
    if (state !== current || current.captureTask || current.captureId || !current.clock?.playing
      || current.clock.muted || current.tabMuted
      || (!force && Date.now() < current.retryAt)) return;
    const captureId = crypto.randomUUID();
    current.captureId = captureId;
    current.fallbackReason = undefined;
    publishState(current);
    current.captureTask = (async () => {
      let stage = 'offscreen-create';
      try {
        await ensureOffscreen();
        if (state !== current || current.captureId !== captureId) return;
        stage = 'capture-permission';
        const streamId = await api.tabCapture.getMediaStreamId({ targetTabId: current.session.tabId });
        if (state !== current || current.captureId !== captureId) return;
        stage = 'capture-stream';
        const response = await timeout(offscreenMessage({ kind: 'start', captureId, streamId }), 4500);
        if (state !== current || current.captureId !== captureId) {
          void offscreenMessage({ kind: 'stop', captureId }).catch(() => {}); return;
        }
        if (!response?.ok) throw new Error('Capture unavailable');
        current.mode = 'capture';
        current.fallbackReason = undefined;
        current.sequence = 0;
        publishState(current);
      } catch {
        if (state === current && current.captureId === captureId) {
          current.retryAt = Date.now() + (stage === 'capture-permission' ? 30000 : 3000);
          current.fallbackReason = stage;
          cancelCapture(current);
        }
      } finally { current.captureTask = undefined; }
    })();
    await current.captureTask;
  }

  async function stopCurrent() {
    const previous = state;
    state = undefined;
    if (previous) {
      void api.tabs.sendMessage(previous.session.tabId, { target: 'beat-clock', kind: 'stop' },
        { documentId: previous.session.documentId }).catch(() => {});
      if (previous.captureId) await offscreenMessage({ kind: 'stop', captureId: previous.captureId }).catch(() => {});
    }
    // Also clean up an orphan left by a restarted service worker.
    await creating?.catch(() => {});
    await api.offscreen.closeDocument().catch(() => {});
  }

  function stopIfCurrent(current) {
    return serialize(async () => { if (state === current) await stopCurrent(); });
  }

  function stop(owner, subscriptionId) {
    return serialize(async () => {
      if (owner && (!state || !sameOwner(state.owner, owner) || state.subscriptionId !== subscriptionId)) return;
      await stopCurrent();
    });
  }

  async function startClock(current) {
    const target = { documentId: current.session.documentId };
    const message = { target: 'beat-clock', kind: 'watch', index: current.session.index, token: current.token };
    let result;
    try { result = await api.tabs.sendMessage(current.session.tabId, message, target); }
    catch {
      await api.scripting.executeScript({ target: { tabId: current.session.tabId, documentIds: [current.session.documentId] }, files: ['clock.js'] });
      result = await api.tabs.sendMessage(current.session.tabId, message, target);
    }
    return result?.ok === true;
  }

  return {
    start(session, owner, subscriptionId) {
      return serialize(async () => {
        if (state && sameOwner(state.owner, owner) && state.subscriptionId === subscriptionId && state.session.id === session.id) {
          const current = state;
          current.tabMuted = session.tabMuted;
          const lease = await api.tabs.sendMessage(session.tabId, { target: 'beat-clock', kind: 'lease', token: current.token },
            { documentId: session.documentId }).catch(() => {});
          if (!lease?.ok) await startClock(current).catch(() => {});
          if (current.captureId && current.mode === 'capture') {
            const captureId = current.captureId;
            const captureLease = await offscreenMessage({ kind: 'lease', captureId }).catch(() => undefined);
            if (!captureLease?.ok && current.captureId === captureId) {
              current.retryAt = Date.now() + 3000;
              current.fallbackReason = 'capture-disconnected';
              cancelCapture(current);
            }
          }
          if (current.tabMuted) cancelCapture(current);
          else void capture(current);
          publishState(current);
          return;
        }
        await stopCurrent();
        const current = { owner, session, subscriptionId, token: crypto.randomUUID(), mode: 'clock', retryAt: 0,
          tabMuted: session.tabMuted, clock: session };
        state = current;
        publishState(current);
        try {
          if (!await startClock(current)) throw new Error('Clock unavailable');
          void capture(current);
        } catch { if (state === current) await stopCurrent(); }
      });
    },
    stop,
    clock(message, sender) {
      const current = state;
      if (!current || sender.tab?.id !== current.session.tabId || sender.documentId !== current.session.documentId || message.token !== current.token) return;
      if (!message.valid) { publish(current, { kind: 'clock', clock: { ...current.clock, playing: false, paused: true } }); void stopIfCurrent(current); return; }
      const clock = message.clock;
      if (!clock || !Number.isFinite(clock.currentTime) || clock.currentTime < 0 || !Number.isFinite(clock.playbackRate)
        || !Number.isFinite(clock.sampledAt) || typeof clock.playing !== 'boolean' || typeof clock.paused !== 'boolean') return;
      const resumed = (!current.clock?.playing || current.clock?.muted) && clock.playing && !clock.muted;
      current.clock = clock;
      if (resumed) current.retryAt = 0;
      publish(current, { kind: 'clock', clock });
      if (!clock.playing || clock.muted || current.tabMuted) cancelCapture(current);
      else void capture(current);
    },
    offscreen(message, sender) {
      const current = state;
      if (sender.url !== api.runtime.getURL(offscreenPath) || sender.tab || !current || message.captureId !== current.captureId) return;
      if (message.kind === 'onset' && current.mode === 'capture' && current.clock?.playing
        && Array.isArray(message.bands) && message.bands.length <= 4 && message.bands.every((band) => validBands.has(band))) {
        publish(current, { kind: 'onset', captureId: current.captureId, sequence: ++current.sequence, bands: [...new Set(message.bands)] });
      }
      if (message.kind === 'stopped') {
        current.retryAt = Date.now() + 3000;
        current.fallbackReason = ['expired', 'silent', 'ended', 'failed'].includes(message.reason) ? message.reason : 'stopped';
        cancelCapture(current);
        if (message.reason === 'expired') void stopIfCurrent(current);
      }
    },
    invoke(tabId) {
      // This click can grant browser permission. It is not our own permission
      // flag: automatic attempts always ask Chrome, including after reloads.
      if (state?.session.tabId === tabId) void capture(state, true);
    },
    tabClosed(tabId) {
      if (state && (state.session.tabId === tabId || state.owner.tabId === tabId)) void stopIfCurrent(state);
    },
    tabMuted(tabId, muted) {
      if (state?.session.tabId !== tabId) return;
      state.tabMuted = muted;
      if (muted) cancelCapture(state);
      else { state.retryAt = 0; void capture(state); }
    },
  };
}
