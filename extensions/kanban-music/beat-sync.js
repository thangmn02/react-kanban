const offscreenPath = 'offscreen.html';
import { beatTelemetry, parseBeatTraces } from './beat-telemetry.js';
import { audibleClock, playbackTiming, playbackTraces, parsePlaybackClock, clockDiscontinuity } from './beat-timing.js';
const telemetry = beatTelemetry.at('beat-sync');
const validBands = new Set(['kick', 'bass', 'clap', 'hat']);
const sameOwner = (a, b) => a.native === b.native && a.tabId === b.tabId && a.documentId === b.documentId;
function captureFailure(stage, error) {
  if (stage !== 'capture-permission') return stage;
  const message = String(error?.message || '');
  if (/permission|denied|not (?:been )?invoked|activeTab|not allowed/i.test(message)) return 'capture-permission';
  if (/already|in use|being captured/i.test(message)) return 'capture-busy';
  return 'capture-request';
}
const timeout = (promise, ms) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timeout')), ms); })]).finally(() => clearTimeout(timer));
};

export function createBeatSync(api, nativePublish) {
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

  function confirmCapture(current) {
    if (state !== current || !current.captureId || !current.captureReady || !current.audioDetected
      || !current.clock?.playing || current.clock.muted || current.tabMuted) return;
    current.mode = 'capture';
    telemetry.record('AUDIO_DETECTED', undefined, { captureId: current.captureId });
    if (current.recoveryReason) {
      telemetry.record('CAPTURE_RECOVERED', undefined, { captureId: current.captureId, reason: current.recoveryReason });
      current.recoveryReason = undefined;
    }
    current.fallbackReason = undefined;
    publishState(current);
  }

  function publish(current, event) {
    if (state !== current) { telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'owner' }); return; }
    telemetry.mark('EVENT_SENT', event.telemetry);
    event = { ...event, emittedAt: Date.now() };
    if (current.owner.native) {
      nativePublish?.(current.owner.native, { sessionId: current.session.id, subscriptionId: current.subscriptionId, ...event });
      return;
    }
    void api.tabs.sendMessage(current.owner.tabId, { protocol: 'kanban-music-v1', event: 'beat',
      sessionId: current.session.id, subscriptionId: current.subscriptionId, ...event },
    { documentId: current.owner.documentId }).catch(() => { telemetry.mark('EVENT_DROPPED', event.telemetry, { reason: 'transport' }); void stopIfCurrent(current); });
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
    telemetry.record('CAPTURE_STOP', undefined, { captureId, reason: current.fallbackReason || 'stopped' });
    current.captureId = undefined;
    current.captureReady = false;
    current.audioDetected = false;
    current.delaySeconds = 0;
    current.mode = 'clock';
    publishState(current);
    if (captureId) void offscreenMessage({ kind: 'stop', captureId }).catch(() => {});
  }

  async function capture(current, force = false) {
    if (current.owner.nativeAudio) { current.fallbackReason = 'native-audio'; publishState(current); return; }
    if (state !== current) return;
    // Every allowlisted service uses the same browser-approved tab stream.
    // A host name or mediaKeys flag is not evidence that output is silent.
    // Only audible analyser proof can confirm capture; browser restrictions
    // and genuinely silent streams still fall back without fabricated beats.
    if (state !== current || current.captureTask || current.captureId || !current.clock?.playing
      || current.clock.muted || current.tabMuted
      || (!force && Date.now() < current.retryAt)) return;
    const captureId = crypto.randomUUID();
    current.captureId = captureId;
    telemetry.record('CAPTURE_START', undefined, { captureId });
    current.captureReady = false;
    current.audioDetected = false;
    current.sequence = 0;
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
        current.delaySeconds = Number.isFinite(response.delaySeconds) && response.delaySeconds >= 0 && response.delaySeconds <= 5 ? response.delaySeconds : 0;
        current.captureReady = true;
        // An open stream can still be silent/protected. Wait for analyser proof.
        confirmCapture(current);
      } catch (error) {
        if (state === current && current.captureId === captureId) {
          const reason = captureFailure(stage, error);
          current.retryAt = Date.now() + (reason === 'capture-permission' ? 30000 : 3000);
          current.fallbackReason = reason;
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
      if (owner && (!state || !sameOwner(state.owner, owner) || subscriptionId !== undefined && state.subscriptionId !== subscriptionId)) return;
      await stopCurrent();
    });
  }

  async function startClock(current) {
    const target = { documentId: current.session.documentId };
    const message = { target: 'beat-clock', kind: 'watch', index: current.session.index, src: current.session.src,
      observed: current.session.observed, token: current.token };
    let result;
    try { result = await api.tabs.sendMessage(current.session.tabId, message, target); }
    catch {
      await api.scripting.executeScript({ target: { tabId: current.session.tabId, documentIds: [current.session.documentId] }, files: ['clock.js'] });
      result = await api.tabs.sendMessage(current.session.tabId, message, target);
    }
    return result?.ok === true;
  }

  return {
    status(session) {
      if (state?.session.id === session.id) return { mode: state.mode, reason: clockReason(state),
        ...(state.mode === 'capture' ? { captureId: state.captureId } : {}) };
      return { mode: 'clock', reason: !session.playing ? 'not-playing'
        : session.muted || session.tabMuted ? 'muted' : 'not-selected' };
    },
    start(session, owner, subscriptionId) {
      return serialize(async () => {
        if (state && sameOwner(state.owner, owner) && state.owner.nativeAudio === owner.nativeAudio
          && state.subscriptionId === subscriptionId && state.session.id === session.id) {
          const current = state;
          current.tabMuted = session.tabMuted;
          const lease = await api.tabs.sendMessage(session.tabId, { target: 'beat-clock', kind: 'lease', token: current.token },
            { documentId: session.documentId }).catch(() => {});
          if (!lease?.ok) await startClock(current).catch(() => {});
          if (current.captureId && current.captureReady) {
            const captureId = current.captureId;
            const captureLease = await offscreenMessage({ kind: 'lease', captureId }).catch(() => undefined);
            telemetry.record(captureLease?.ok ? 'LEASE_RENEW' : 'LEASE_EXPIRED', undefined, { captureId });
            if (!captureLease?.ok && current.captureId === captureId) {
              current.retryAt = 0;
              current.fallbackReason = 'capture-disconnected';
              current.recoveryReason = current.fallbackReason;
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
      if (!parsePlaybackClock(clock) || current.clock && clock.sampledAt < current.clock.sampledAt) return;
      const resumed = (!current.clock?.playing || current.clock?.muted) && clock.playing && !clock.muted;
      const previous = current.clock;
      const discontinuity = clockDiscontinuity(previous, clock)
        || previous?.playing && clock.playing && previous.playbackRate !== clock.playbackRate;
      current.clock = clock;
      telemetry.record('EVENT_RECEIVED', undefined, { captureId: current.captureId });
      if (resumed) current.retryAt = 0;
      if (discontinuity) { current.retryAt = 0; cancelCapture(current); }
      publish(current, { kind: 'clock', clock: audibleClock(clock, clock.playing ? current.delaySeconds || 0 : 0) || clock });
      if (!clock.playing || clock.muted || current.tabMuted) cancelCapture(current);
      else void capture(current);
    },
    offscreen(message, sender) {
      const current = state;
      const trace = parseBeatTraces(message.telemetry);
      if (sender.url !== api.runtime.getURL(offscreenPath) || sender.tab || !current || message.captureId !== current.captureId) { telemetry.mark('EVENT_DROPPED', trace, { reason: 'owner' }); return; }
      telemetry.mark('EVENT_RECEIVED', trace);
      // Carry only the allowlisted diagnostic envelope. Beat validation below
      // remains independent of telemetry validity or whether tracing is enabled.
      const timing = playbackTiming(current.clock, message, current.delaySeconds || 0);
      const mapped = playbackTraces(trace, timing, message.targetOutputTime);
      const diagnostic = { ...(mapped ? { telemetry: mapped } : {}), ...(timing || {}) };
      let delivered = false;
      if (message.kind === 'audible') {
        current.audioDetected = true;
        confirmCapture(current);
      }
      if (message.kind === 'onset' && current.mode === 'capture' && current.clock?.playing
        && Array.isArray(message.bands) && message.bands.length <= 4 && message.bands.every((band) => validBands.has(band))) {
        delivered = true;
        publish(current, { kind: 'onset', captureId: current.captureId, sequence: ++current.sequence, bands: [...new Set(message.bands)], ...diagnostic });
      }
      if (message.kind === 'tempo.state' && current.mode === 'capture' && current.clock?.playing
        && typeof message.tempo?.locked === 'boolean' && Number.isFinite(message.tempo.confidence)
        && message.tempo.confidence >= 0 && message.tempo.confidence <= 1
        && (message.tempo.bpm === null || Number.isFinite(message.tempo.bpm) && message.tempo.bpm >= 60 && message.tempo.bpm <= 180)) {
        delivered = true;
        publish(current, { kind: 'tempo.state', captureId: current.captureId, tempo: message.tempo, ...diagnostic });
      }
      if (message.kind === 'melody.state' && message.detector === 'instrument-v1' && current.mode === 'capture' && current.clock?.playing
        && typeof message.melody?.active === 'boolean' && Number.isFinite(message.melody.level)
        && message.melody.level >= 0 && message.melody.level <= 1
        && Number.isSafeInteger(message.melody.note) && message.melody.note >= 0) {
        delivered = true;
        publish(current, { kind: 'melody.state', detector: 'instrument-v1', captureId: current.captureId,
          melody: { active: message.melody.active, level: message.melody.level, note: message.melody.note }, ...diagnostic });
      }
      if (message.kind === 'tempo.tick' && current.mode === 'capture' && current.clock?.playing
        && Number.isInteger(message.tick?.step) && message.tick.step >= 0 && message.tick.step < 8
        && Number.isFinite(message.tick.phase) && message.tick.phase >= 0 && message.tick.phase < 1
        && Number.isFinite(message.tick.beatPosition) && message.tick.beatPosition >= 0
        && message.tick.subdivision === 2) {
        delivered = true;
        const { step, phase, beatPosition, subdivision } = message.tick;
        publish(current, { kind: 'tempo.tick', captureId: current.captureId, tick: { step, phase, beatPosition, subdivision }, ...diagnostic });
      }
      if (!delivered) telemetry.mark('EVENT_DROPPED', trace, { reason: current.mode !== 'capture' ? 'clock' : !current.clock?.playing ? 'not-playing' : 'invalid' });
      if (message.kind === 'stopped') {
        current.retryAt = Date.now() + (message.reason === 'failed' ? 3000 : 0);
        current.fallbackReason = ['expired', 'silent', 'ended', 'failed'].includes(message.reason) ? message.reason : 'stopped';
        cancelCapture(current);
        // Retain the clock subscription; the next active clock or renewal
        // reacquires capture without requiring another toolbar invocation.
        current.recoveryReason = current.fallbackReason;
        void capture(current);
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
