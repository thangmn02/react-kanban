import { appOrigins } from './protocol.js';
import { isMusicUrl } from './sites.js';
import { mediaAssetFromUrl } from './media-asset.js';

const appPatterns = ['https://kanthangboard.netlify.app/*', 'http://localhost/*', 'http://127.0.0.1/*'];
const defaultApp = 'https://kanthangboard.netlify.app';
function appOrigin(url) {
  try { const origin = new URL(url).origin; return appOrigins.has(origin) ? origin : undefined; }
  catch { return undefined; }
}
export function isMusicTab(tab) {
  if (!Number.isInteger(tab?.id)) return false;
  return isMusicUrl(tab.url);
}

export function createCompanionAction(api, beats, widgetConnected = () => false) {
  let opening;
  const read = () => api.storage.session.get(['lastApp', 'preferredMusicTab', 'musicSelectionToken']).catch(() => ({}));
  async function focus(tab) {
    const updated = await api.tabs.update(tab.id, { active: true });
    if (Number.isInteger(updated?.windowId ?? tab.windowId)) await api.windows.update(updated?.windowId ?? tab.windowId, { focused: true });
  }
  return {
    async rememberApp(sender) {
      const origin = appOrigin(sender.url);
      if (origin && Number.isInteger(sender.tab?.id)) await api.storage.session.set({ lastApp: { origin, tabId: sender.tab.id } });
    },
    async prefer(sessions) {
      const { preferredMusicTab, musicSelectionToken } = await read();
      return [...sessions].sort((a, b) => Number(b.tabId === preferredMusicTab) - Number(a.tabId === preferredMusicTab))
        .map(item => item.tabId === preferredMusicTab && typeof musicSelectionToken === 'string'
          ? { ...item, selectionToken: musicSelectionToken } : item);
    },
    async openMusic(session) { await focus({ id: session.tabId }); },
    async invoke(tab) {
      if (!isMusicTab(tab)) {
        const { leadAudioTestScope } = await api.storage.local.get('leadAudioTestScope').catch(() => ({}));
        const source = mediaAssetFromUrl(leadAudioTestScope?.sourceUrl, leadAudioTestScope);
        let sameOrigin = false;
        try { sameOrigin = new URL(tab.url).origin === new URL(leadAudioTestScope?.sourceUrl).origin; } catch { /* Invalid URL. */ }
        if (!Number.isInteger(tab?.id) || source?.provider !== 'kora-development' || !sameOrigin) {
          await api.runtime.openOptionsPage(); return;
        }
      }
      // The toolbar invocation grants browser access even if Floating Focus is
      // not mounted yet. Never manufacture our own permission flag.
      beats.invoke(tab.id);
      await api.storage.session.set({ preferredMusicTab: tab.id, musicSelectionToken: crypto.randomUUID() });
      if (widgetConnected()) return;
      if (opening) return opening;
      opening = (async () => {
        const { lastApp } = await read();
        const tabs = (await api.tabs.query({ url: appPatterns })).filter(item => appOrigin(item.url));
        const app = tabs.find(item => item.id === lastApp?.tabId)
          || tabs.find(item => appOrigin(item.url) === lastApp?.origin) || tabs[0];
        if (app) await focus(app);
        else await api.tabs.create({ url: appOrigins.has(lastApp?.origin) ? lastApp.origin : defaultApp });
      })();
      try { await opening; } finally { opening = undefined; }
    },
  };
}
