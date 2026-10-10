// This handler is packaged only into the isolated audio test project.
const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Netlify-CDN-Cache-Control': 'no-store',
  'Vary': 'Authorization',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Kora-Test-Gate': 'edge-auth-v1',
};

function denial(status) {
  return new Response(status === 401 ? 'Authorization required.' : 'Test source unavailable.', {
    status,
    headers: { ...privateHeaders, 'Content-Type': 'text/plain; charset=utf-8',
      ...(status === 401 ? { 'WWW-Authenticate': 'Basic realm="Kora private audio test", charset="UTF-8"' } : {}) },
  });
}

export function createAuthGate(readEnvironment) {
  return async (request, context) => {
    try {
      const { digest, siteId } = readEnvironment();
      if (!/^[a-f0-9]{64}$/.test(digest || '') || !siteId || context.site?.id !== siteId) return denial(503);
      const authorization = request.headers.get('Authorization') || '';
      if (authorization.length > 512 || !/^Basic [A-Za-z0-9+/]+={0,2}$/i.test(authorization)) return denial(401);
      let decoded;
      try { decoded = atob(authorization.slice(6)); } catch { return denial(401); }
      if (!/^kora-test:[A-Za-z0-9_-]{43}$/.test(decoded)) return denial(401);
      const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(decoded)));
      const actual = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      let difference = 0;
      for (let i = 0; i < digest.length; i++) difference |= actual.charCodeAt(i) ^ digest.charCodeAt(i);
      if (difference) return denial(401);
      if (request.method !== 'GET' && request.method !== 'HEAD') return denial(405);
      const response = await context.next();
      const headers = new Headers(response.headers);
      for (const [name, value] of Object.entries(privateHeaders)) headers.set(name, value);
      headers.delete('Set-Cookie');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch {
      // Never fail open, forward diagnostics or log authentication material.
      return denial(503);
    }
  };
}

export default createAuthGate(() => ({
  digest: globalThis.Netlify.env.get('KORA_AUDIO_TEST_CREDENTIAL_SHA256'),
  siteId: globalThis.Netlify.env.get('KORA_AUDIO_TEST_SITE_ID'),
}));

export const config = { path: '/*', onError: 'fail' };
