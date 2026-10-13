const validVersion = (value) => typeof value === 'string' && /^\d{1,5}(\.\d{1,5}){0,3}$/.test(value)
  && value.split('.').every(part => Number(part) <= 65535);

export function validCompanionUpdate(request) {
  return request.action === 'companion.status'
    || request.action === 'companion.reload' && validVersion(request.expectedVersion);
}

export async function companionUpdate(api, request, fetcher = fetch) {
  if (request.action === 'companion.status') {
    return { ok: true, version: api.runtime.getManifest().version };
  }
  if (!validCompanionUpdate(request)) return { ok: false, error: 'unavailable' };
  try {
    const response = await fetcher(api.runtime.getURL('manifest.json'), {
      cache: 'no-store', signal: AbortSignal.timeout(1000),
    });
    if (!response.ok) return { ok: false, error: 'update-files-missing' };
    const manifest = await response.json();
    if (manifest.name !== 'Kora Music Companion' || manifest.manifest_version !== 3
      || manifest.version !== request.expectedVersion) return { ok: false, error: 'update-version-mismatch' };
    return { ok: true, version: manifest.version };
  } catch { return { ok: false, error: 'update-files-missing' }; }
}
