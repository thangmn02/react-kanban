import { readMedia, controlMedia } from './media.js';
import { allowedRequest } from './protocol.js';
import { createBeatSync } from './beat-sync.js';
import { createCompanionAction } from './companion-action.js';
import { mediaSites } from './sites.js';
import { diagnoseDiscovery } from './discovery-diagnostics.js';
import { createWidgetBridge } from './widget-bridge.js';
import { beatTelemetry } from './beat-telemetry.js';

void chrome.storage.local.get('beatTelemetryEnabled').then((data) => beatTelemetry.enable(data.beatTelemetryEnabled === true)).catch(() => {});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.beatTelemetryEnabled) beatTelemetry.enable(changes.beatTelemetryEnabled.newValue === true);
});

let widget;
const beats = createBeatSync(chrome, (owner, event) => widget?.beat(owner, event));
const companion = createCompanionAction(chrome, beats, () => Boolean(widget?.connected));

let scanInFlight;

async function scan() {
  if (scanInFlight) return scanInFlight;
  scanInFlight = (async () => {
    const tabs = await chrome.tabs.query({ url: mediaSites });
    const results = await Promise.all(tabs.map(async (tab) => {
      try {
        // Idempotent; also installs observation in tabs left open during reload.
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', files: ['media-observer.js'] });
        const frames = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: readMedia });
        return frames.flatMap((frame) => (frame.result || []).map((media) => ({
          ...media, tabId: tab.id, tabMuted: Boolean(tab.mutedInfo?.muted), documentId: frame.documentId,
          id: `${tab.id}:${frame.documentId}:${media.index}`,
        })));
      } catch { return []; } // Closed, restricted, or permission-blocked tabs are unavailable.
    }));
    return results.flat();
  })();
  try { return await scanInFlight; } finally { scanInFlight = undefined; }
}

const publicSessions = (items) => items.map((session) => {
  const { id, title, artist, source, paused, playing, currentTime, playbackRate, sampledAt, selectionToken } = session;
  return { id, title, artist, source, paused, playing, currentTime, playbackRate, sampledAt, syncState: beats.status(session),
  ...(selectionToken ? { selectionToken } : {}),
  };
});

async function handle(message, sender) {
  if (!sender.native) await companion.rememberApp(sender).catch(() => {});
  const owner = { tabId: sender.tab?.id, documentId: sender.documentId, native: sender.native,
    nativeAudio: Boolean(sender.native && message.nativeAudio === true) };
  if (message.action === 'dock.beat.sync.stop') {
    await beats.stop(owner, message.subscriptionId); return { ok: true };
  }
  const sessions = await scan();
  if (message.action === 'sessions.get') return { ok: true, sessions: publicSessions(await companion.prefer(sessions)) };
  const session = sessions.find((item) => item.id === message.sessionId);
  if (!session) return { ok: false, error: 'unavailable' };
  if (message.action === 'instrument.setup') { await chrome.runtime.openOptionsPage(); return { ok: true }; }
  if (message.action === 'media.focus') {
    await companion.openMusic(session); return { ok: true, sessions: publicSessions(sessions) };
  }
  if (message.action === 'dock.beat.sync.start') {
    if (!owner.native && (!Number.isInteger(owner.tabId) || !owner.documentId)) return { ok: false, error: 'unavailable' };
    await beats.start(session, owner, message.subscriptionId); return { ok: true };
  }
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: session.tabId, documentIds: [session.documentId] }, world: 'MAIN',
      func: controlMedia, args: [session.index, session.src, message.action],
    });
    if (!result.some((frame) => frame.result === true)) throw new Error('Playback unavailable');
    return { ok: true, sessions: publicSessions(await scan()) };
  } catch {
    return { ok: false, error: 'playback' };
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.protocol === 'kanban-music-v1' && message.action === 'diagnostics.get') {
    if (sender.id !== chrome.runtime.id || (sender.url !== chrome.runtime.getURL('setup.html') && !allowedRequest(message, sender))) {
      respond({ ok: false, error: 'unavailable' }); return false;
    }
    void diagnoseDiscovery(chrome, mediaSites).then((tabs) => respond({ ok: true, tabs }), () => respond({ ok: false, error: 'unavailable' }));
    return true;
  }
  if (message?.target === 'beat-offscreen') return false;
  if (sender.id === chrome.runtime.id && message?.target === 'beat-worker') {
    if (message.kind === 'clock') beats.clock(message, sender);
    else beats.offscreen(message, sender);
    respond({ ok: true });
    return false;
  }
  if (sender.id !== chrome.runtime.id || !allowedRequest(message, sender)) { respond({ ok: false, error: 'unavailable' }); return false; }
  void handle(message, sender).then(respond, () => respond({ ok: false, error: 'unavailable' }));
  return true;
});

chrome.action.onClicked.addListener((tab) => {
  void companion.invoke(tab).catch(() => {});
});
chrome.tabs.onRemoved.addListener((tabId) => beats.tabClosed(tabId));
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'loading') beats.tabClosed(tabId);
  if (change.mutedInfo) beats.tabMuted(tabId, change.mutedInfo.muted);
});

if (chrome.alarms && typeof WebSocket !== 'undefined') {
  widget = createWidgetBridge({ api: chrome, handle,
    disconnected: (native) => beats.stop({ native }, undefined),
  });
  widget.connect();
}
