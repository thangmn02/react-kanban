/** Only internal app destinations may be carried through authentication. */
export function safeReturnTo(value: unknown, fallback = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.includes('\\') || [...decoded].some(character => character.charCodeAt(0) < 32) || decoded.startsWith('//')) return fallback;
    const url = new URL(value, 'https://koraspace.online');
    const decodedUrl = new URL(decoded, 'https://koraspace.online');
    if (url.origin !== 'https://koraspace.online' || decodedUrl.origin !== url.origin
      || /^\/(auth|onboarding)(\/|$)/.test(decodedUrl.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}

export function authDestination(returnTo: string) {
  return `/auth/sign-in?${new URLSearchParams({ returnTo: safeReturnTo(returnTo) })}`;
}

export function readReturnTo(search: string, state?: unknown) {
  const query = new URLSearchParams(search).get('returnTo');
  const previous = state && typeof state === 'object' && 'returnTo' in state ? state.returnTo : undefined;
  return safeReturnTo(query ?? previous);
}
