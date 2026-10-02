import { readMedia, controlMedia } from './media.js';
import { allowedRequest } from './protocol.js';
import { createBeatSync } from './beat-sync.js';

const beats = createBeatSync(chrome);

const mediaSites = ['https://*.youtube.com/*', 'https://*.soundcloud.com/*', 'https://open.spotify.com/*', 'http://localhost/*', 'http://127.0.0.1/*'];
let scanInFlight;

async function scan() {
  if (scanInFlight) return scanInFlight;
  scanInFlight = (async () => {
    const tabs = await chrome.tabs.query({ url: mediaSites });
    const results = await Promise.all(tabs.map(async (tab) => {
      try {
        const frames = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: readMedia });
        return frames.flatMap((frame) => (frame.result || []).map((media) => ({
          ...media, tabId: tab.id, tabMuted: Boolean(tab.mutedInfo?.muted), documentId: frame.documentId,
          id: `${tab.id}:${frame.documentId}:${media.index}`,
        })));
      } catch { return []; } // Closed, restricted, or permission-blocked tabs are unavailable.
    }));
    return results.flat().slice(0, 30);
  })();
  try { return await scanInFlight; } finally { scanInFlight = undefined; }
}

const publicSessions = (items) => items.map(({ id, title, artist, source, paused, playing, currentTime, playbackRate, sampledAt }) => ({ id, title, artist, source, paused, playing, currentTime, playbackRate, sampledAt }));

async function handle(message, sender) {
  const owner = { tabId: sender.tab?.id, documentId: sender.documentId };
  if (message.action === 'dock.beat.sync.stop') {
    await beats.stop(owner, message.subscriptionId); return { ok: true };
  }
  const sessions = await scan();
  if (message.action === 'sessions.get') return { ok: true, sessions: publicSessions(sessions) };
  const session = sessions.find((item) => item.id === message.sessionId);
  if (!session) return { ok: false, error: 'unavailable' };
  if (message.action === 'dock.beat.sync.start') {
    if (!Number.isInteger(owner.tabId) || !owner.documentId) return { ok: false, error: 'unavailable' };
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
  // The browser grants capture access only after this extension invocation.
  if (Number.isInteger(tab.id) && /^https:\/\/(?:[^/]+\.)?(?:youtube\.com|soundcloud\.com)\//.test(tab.url || '')
    || Number.isInteger(tab.id) && /^https:\/\/open\.spotify\.com\//.test(tab.url || '')
    || Number.isInteger(tab.id) && /^http:\/\/(?:localhost|127\.0\.0\.1):517[34]\//.test(tab.url || '')) beats.invoke(tab.id);
  else void chrome.runtime.openOptionsPage();
});
chrome.tabs.onRemoved.addListener((tabId) => beats.tabClosed(tabId));
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'loading') beats.tabClosed(tabId);
  if (change.mutedInfo) beats.tabMuted(tabId, change.mutedInfo.muted);
});
