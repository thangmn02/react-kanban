// Finished video colours per video ("provider:id"), kept on this device so a video seen before is never sampled again.
// Holds only the 36-number hue histogram; never frames or pixels. Least recently used entries go past the limit.
export const VIDEO_PALETTE_KEY = 'videoPalettes.v1';
export const VIDEO_PALETTE_LIMIT = 500;
const validBins = value => Array.isArray(value?.bins) && value.bins.length === 36 && value.bins.every(Number.isFinite)
  && Number.isFinite(value.pixels) && value.pixels > 0;

export function createVideoPaletteCache(storage, { limit = VIDEO_PALETTE_LIMIT, now = Date.now } = {}) {
  let entries, loading, saving;
  const load = () => loading ??= Promise.resolve(storage.get(VIDEO_PALETTE_KEY)).then(data => {
    const stored = data?.[VIDEO_PALETTE_KEY];
    entries = new Map(Object.entries(stored && typeof stored === 'object' ? stored : {}).filter(([, value]) => validBins(value)));
  }).catch(() => { entries = new Map(); });
  const save = () => {
    saving ??= Promise.resolve().then(() => {
      saving = undefined;
      return storage.set({ [VIDEO_PALETTE_KEY]: Object.fromEntries(entries) });
    }).catch(() => { /* Kept in memory; written again with the next palette. */ });
    return saving;
  };
  const key = asset => asset?.provider && asset?.id ? `${asset.provider}:${asset.id}` : undefined;
  return {
    load,
    /** Synchronous after load(); undefined when unknown. */
    get(asset) {
      const name = key(asset), value = name && entries?.get(name);
      if (!value) return undefined;
      return { bins: value.bins, pixels: value.pixels };
    },
    has(asset) { const name = key(asset); return Boolean(name && entries?.has(name)); },
    set(asset, palette) {
      const name = key(asset);
      if (!name || !entries || !validBins(palette) || entries.has(name)) return false;
      entries.set(name, { bins: palette.bins, pixels: palette.pixels, at: now() });
      while (entries.size > limit) entries.delete(entries.keys().next().value);
      void save();
      return true;
    },
    /** Marks a cached video as used, so it is the last to be dropped. */
    touch(asset) {
      const name = key(asset), value = name && entries?.get(name);
      if (!value) return;
      entries.delete(name); entries.set(name, value);
    },
  };
}
