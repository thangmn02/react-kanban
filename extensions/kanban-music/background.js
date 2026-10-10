import { readMedia, controlMedia } from './media.js';
import { allowedRequest } from './protocol.js';
import { createBeatSync } from './beat-sync.js';
import { createCompanionAction } from './companion-action.js';
import { mediaSites } from './sites.js';
import { diagnoseDiscovery } from './discovery-diagnostics.js';
import { createWidgetBridge } from './widget-bridge.js';
import { beatTelemetry } from './beat-telemetry.js';
import { mediaAssetFromUrl } from './media-asset.js';
import { authorizedLeadAudio } from './lead-audio-authorization.js';
import { hasLearnedPercussion } from './percussion-capability.js';

void chrome.storage.local.get('beatTelemetryEnabled').then((data) => beatTelemetry.enable(data.beatTelemetryEnabled === true)).catch(() => {});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.beatTelemetryEnabled) beatTelemetry.enable(changes.beatTelemetryEnabled.newValue === true);
});

let widget;
const beats = createBeatSync(chrome, (owner, event) => widget?.beat(owner, event));
const companion = createCompanionAction(chrome, beats, () => Boolean(widget?.connected));

let scanInFlight;
let learnedPercussion;

async function scan() {
  if (scanInFlight) return scanInFlight;
  scanInFlight = (async () => {
    const { leadAudioTestScope } = await chrome.storage.local.get('leadAudioTestScope');
    const source = (() => { try { return new URL(leadAudioTestScope?.sourceUrl); } catch { return undefined; } })();
    const developmentOrigin = source?.protocol === 'https:' && !source.username && !source.password
      && leadAudioTestScope?.asset?.provider === 'kora-development'
      && leadAudioTestScope.expiresAt > Date.now() && leadAudioTestScope.expiresAt <= Date.now() + 3600000
      ? `${source.origin}/*` : undefined;
    const tabs = await chrome.tabs.query({ url: developmentOrigin ? [...mediaSites, developmentOrigin] : mediaSites });
    const results = await Promise.all(tabs.map(async (tab) => {
      try {
        // Idempotent; also installs observation in tabs left open during reload.
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', files: ['media-observer.js'] });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: controlMedia, args: [0, '', 'install'] });
        const frames = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: readMedia });
        return frames.flatMap((frame) => (frame.result || []).map((media) => ({
          ...media, asset: mediaAssetFromUrl(media.assetUrl, leadAudioTestScope), tabId: tab.id, tabMuted: Boolean(tab.mutedInfo?.muted), documentId: frame.documentId,
          id: `${tab.id}:${frame.documentId}:${media.index}`,
        })));
      } catch { return []; } // Closed, restricted, or permission-blocked tabs are unavailable.
    }));
    return results.flat();
  })();
  try { return await scanInFlight; } finally { scanInFlight = undefined; }
}

const publicSessions = (items, percussionAvailable = false) => items.map((session) => {
  const { id, title, artist, source, paused, playing, currentTime, playbackRate, sampledAt, selectionToken,
    duration, volume, muted, canSeek, canPrevious, canNext, asset } = session;
  return { id, title, artist, source, paused, playing, currentTime, playbackRate, sampledAt,
    duration, volume, muted, canSeek, canPrevious, canNext, asset,
    canAnalyze: Boolean(chrome.offscreen && chrome.tabCapture?.getMediaStreamId && chrome.runtime.getContexts), learnedPercussion: percussionAvailable, syncState: beats.status(session),
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
  if (message.action === 'sessions.get') {
    learnedPercussion ??= hasLearnedPercussion(chrome);
    return { ok: true, sessions: publicSessions(await companion.prefer(sessions), await learnedPercussion) };
  }
  const session = sessions.find((item) => item.id === message.sessionId);
  if (!session) return { ok: false, error: 'unavailable' };
  if (message.action === 'dock.audio.read') {
    const { leadAudioTestScope } = await chrome.storage.local.get('leadAudioTestScope');
    if (!authorizedLeadAudio(leadAudioTestScope, session, sender)) return { ok: false, error: 'unavailable' };
    const packet = await beats.readAudio(session, owner, message.subscriptionId);
    const refreshed = await chrome.storage.local.get('leadAudioTestScope');
    if (!authorizedLeadAudio(refreshed.leadAudioTestScope, session, sender)) return { ok: false, error: 'unavailable' };
    if (packet) {
      // Check the actual element again after capture; discovery before an await
      // cannot authorize samples from a player whose source changed meanwhile.
      const frames = await chrome.scripting.executeScript({
        target: { tabId: session.tabId, documentIds: [session.documentId] }, world: 'MAIN', func: readMedia,
      });
      const sourceStillMatches = frames.some(frame => (frame.result || []).some(media => media.index === session.index
        && media.src === session.src && media.playing && !media.paused && !media.muted && media.playbackRate === 1
        && authorizedLeadAudio(refreshed.leadAudioTestScope,
          { src: media.src, asset: mediaAssetFromUrl(media.assetUrl, refreshed.leadAudioTestScope) }, sender)));
      if (!sourceStillMatches) return { ok: false, error: 'unavailable' };
    }
    return { ok: true, ...(packet ? { packet } : {}) };
  }
  if (message.action === 'media.focus') {
    await companion.openMusic(session); return { ok: true, sessions: publicSessions(sessions) };
  }
  if (message.action === 'dock.beat.sync.start') {
    if (!owner.native && (!Number.isInteger(owner.tabId) || !owner.documentId)) return { ok: false, error: 'unavailable' };
    await beats.start(session, owner, message.subscriptionId, message.telemetryEnabled === true); return { ok: true };
  }
  try {
    // Install idempotently for tabs left open across a Companion reload.
    await chrome.scripting.executeScript({ target: { tabId: session.tabId, documentIds: [session.documentId] }, files: ['clock.js'] });
    const result = await chrome.tabs.sendMessage(session.tabId, {
      target: 'media-control', index: session.index, src: session.src, action: message.action, value: message.value,
    }, { documentId: session.documentId });
    if (result?.ok !== true) throw new Error('Playback unavailable');
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
