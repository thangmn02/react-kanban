// Read-only, self-contained MAIN-world probe. Never returns titles, URLs,
// media sources, account details or audio; only bounded detection facts.
export function inspectDiscovery() {
  const dom = Array.from(document.querySelectorAll('audio,video'));
  const observed = globalThis.__kanbanMusicMedia?.entries?.() || dom.map((media) => ({ media }));
  const media = observed.map((entry) => entry.media);
  const ready = media.filter((item) => Boolean(item.currentSrc || item.srcObject?.id) && item.readyState > 0 && !item.ended);
  const playbackState = navigator.mediaSession?.playbackState;
  return { domElements: dom.length, observedElements: media.length, readyElements: ready.length,
    playingElements: ready.filter((item) => !item.paused && !item.seeking && item.readyState >= 3).length,
    metadataPresent: Boolean(navigator.mediaSession?.metadata),
    playbackState: ['playing', 'paused', 'none'].includes(playbackState) ? playbackState : 'unavailable',
    observerInstalled: globalThis.__kanbanMusicMedia?.version === 1 };
}

export async function diagnoseDiscovery(api, mediaSites) {
  const tabs = await api.tabs.query({ url: mediaSites });
  return Promise.all(tabs.map(async (tab) => {
    const host = new URL(tab.url).hostname;
    const base = { host, audible: Boolean(tab.audible), muted: Boolean(tab.mutedInfo?.muted) };
    try {
      const frames = await api.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: inspectDiscovery });
      return { ...base, status: 'inspected', frames: frames.map((frame) => frame.result) };
    } catch (error) {
      // Raw Chrome errors may contain a media URL. Keep diagnostics nonprivate.
      return { ...base, status: 'inspection-failed', errorType: ['Error', 'TypeError', 'SecurityError'].includes(error?.name) ? error.name : 'Error' };
    }
  }));
}
