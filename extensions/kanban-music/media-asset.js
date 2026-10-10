// Only content-specific provider routes are identities. Never send signed media
// URLs, playlist IDs, tab IDs or titles to an analysis/cache service.
export function parseMediaAsset(value) {
  if (!value || typeof value.id !== 'string' || value.id.length > 200) return undefined;
  const rules = { youtube: /^[\w-]{11}$/, spotify: /^[a-zA-Z0-9]{22}$/,
    soundcloud: /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/, deezer: /^\d+$/, tidal: /^\d+$/, apple: /^\d+$/,
    'kora-development': /^[a-f0-9]{64}$/ };
  if (typeof value.provider !== 'string' || !Object.hasOwn(rules, value.provider) || !rules[value.provider].test(value.id)) return undefined;
  if (value.provider === 'soundcloud' && /^(search|discover|stream|you|charts)\//.test(value.id)) return undefined;
  return { provider: value.provider, id: value.id };
}

export function mediaAssetFromUrl(value, developmentScope) {
  try {
    const url = new URL(value), path = url.pathname.split('/').filter(Boolean);
    if (url.protocol !== 'https:') return undefined;
    let asset;
    // A first-party test identity is opt-in, bound to the actual HTTPS media
    // resource and its content hash. Ordinary URLs never acquire this identity.
    const developmentAsset = parseMediaAsset(developmentScope?.asset);
    if (developmentAsset?.provider === 'kora-development'
      && developmentScope.expiresAt > Date.now() && developmentScope.expiresAt <= Date.now() + 3600000
      && developmentScope.sourceUrl === url.href && !url.username && !url.password && !url.search && !url.hash
      && url.pathname === `/kora-lead-test/${developmentAsset.id}.wav`) return developmentAsset;
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) {
      const id = url.pathname === '/watch' ? url.searchParams.get('v') : ['shorts', 'embed'].includes(path[0]) ? path[1] : undefined;
      asset = { provider: 'youtube', id };
    } else if (url.hostname === 'open.spotify.com' && path[0] === 'track') asset = { provider: 'spotify', id: path[1] };
    else if (['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com'].includes(url.hostname) && path.length === 2) asset = { provider: 'soundcloud', id: path.join('/') };
    else if (['deezer.com', 'www.deezer.com'].includes(url.hostname) && path.at(-2) === 'track') asset = { provider: 'deezer', id: path.at(-1) };
    else if (['tidal.com', 'www.tidal.com', 'listen.tidal.com'].includes(url.hostname) && path.at(-2) === 'track') asset = { provider: 'tidal', id: path.at(-1) };
    else if (url.hostname === 'music.apple.com' && url.searchParams.has('i')) asset = { provider: 'apple', id: url.searchParams.get('i') };
    return parseMediaAsset(asset);
  } catch { return undefined; }
}
