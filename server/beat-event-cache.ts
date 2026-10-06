import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseMediaAsset } from '../extensions/kanban-music/media-asset.js';
import { assetKey, parseManifest, parseChunk, readBoundedJson, MAX_RESPONSE_BYTES, type MediaAsset } from '../src/features/music/event-track';

export interface BeatCacheConfig {
  cacheDirectory?: string; cacheOrigin?: string; analysisUrl?: string; analysisKey?: string;
  supabaseUrl?: string; supabaseAnonKey?: string;
}
export const cacheKey = (asset: MediaAsset) => createHash('sha256').update(`1:${assetKey(asset)}`).digest('hex');
// Public cached events contain no account data. Bearer-authenticated analysis
// also supports the desktop origin; cookies are never used by this endpoint.
const reply = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization', 'Access-Control-Max-Age': '600' } });
const submissions = new Map<string, number>();
const httpsUrl = (value?: string) => { if (!value) return; const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid service'); return url; };

export async function handleBeatEventCache(request: Request, config: BeatCacheConfig): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return reply({}, 200);
    const asset = parseMediaAsset({ provider: url.searchParams.get('provider'), id: url.searchParams.get('id') });
    if (!asset) return reply({ error: 'invalid_asset' }, 400);
    const key = cacheKey(asset), signal = AbortSignal.any([request.signal, AbortSignal.timeout(4000)]);
    if (request.method === 'POST') {
      const service = httpsUrl(config.analysisUrl);
      if (!service || !config.analysisKey || !config.supabaseUrl || !config.supabaseAnonKey) return reply({ status: 'unavailable' }, 503);
      const token = request.headers.get('authorization');
      if (!token?.startsWith('Bearer ')) return reply({ error: 'unauthorized' }, 401);
      const userResponse = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
        headers: { apikey: config.supabaseAnonKey, Authorization: token }, signal });
      if (!userResponse.ok) return reply({ error: 'unauthorized' }, 401);
      const user = await readBoundedJson(userResponse) as { id?: unknown };
      if (!user || typeof user.id !== 'string') return reply({ error: 'unauthorized' }, 401);
      for (const [id, until] of submissions) if (until <= Date.now()) submissions.delete(id);
      const identity = `${user.id}:${key}`;
      const userCount = [...submissions.keys()].filter(id => id.startsWith(`${user.id}:`)).length;
      if (submissions.has(identity) || userCount >= 5 || submissions.size >= 1000) return reply({ status: 'limited', retryAfter: 60 }, 429);
      submissions.set(identity, Date.now() + 60000);
      const result = await fetch(service, { method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.analysisKey}`, 'Idempotency-Key': key },
        body: JSON.stringify({ version: 1, asset, cacheKey: key, chunkSeconds: 30, melodyPolicy: 'dominant-monophonic' }) });
      if (result.status !== 202) return reply({ status: 'unavailable' }, 503);
      const job = await readBoundedJson(result) as { jobId?: unknown };
      if (!job || typeof job.jobId !== 'string' || !/^[\w-]{1,100}$/.test(job.jobId)) return reply({ status: 'unavailable' }, 503);
      return reply({ status: 'pending', jobId: job.jobId, retryAfter: 15 }, 202);
    }
    if (request.method !== 'GET') return reply({ error: 'method_not_allowed' }, 405);
    const indexValue = url.searchParams.get('chunk');
    const index = indexValue === null ? undefined : Number(indexValue);
    if (index !== undefined && (!/^\d{1,5}$/.test(indexValue!) || !Number.isSafeInteger(index) || index > 28799)) return reply({ error: 'invalid_chunk' }, 400);
    const origin = httpsUrl(config.cacheOrigin);
    const load = async (filename: string) => {
      if (origin) {
        const response = await fetch(new URL(`${key}/${filename}`, origin.href.endsWith('/') ? origin : new URL(`${origin.href}/`)), { signal });
        if (response.status === 404) return undefined;
        if (!response.ok) throw new Error('Cache unavailable');
        return readBoundedJson(response);
      }
      const path = resolve(config.cacheDirectory || 'public/beat-tracks', key, filename);
      try {
        if ((await stat(path)).size > MAX_RESPONSE_BYTES) throw new Error('Oversized cache');
        return JSON.parse(await readFile(path, 'utf8'));
      } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
    };
    const raw = await load('manifest.json');
    if (!raw) return reply({ status: 'miss' }, 404);
    const manifest = parseManifest(raw, asset);
    if (!manifest) return reply({ error: 'invalid_cache' }, 502);
    if (index === undefined) return reply(manifest);
    const rawChunk = await load(`${index}.json`);
    if (!rawChunk) return reply({ status: 'miss' }, 404);
    const chunk = parseChunk(rawChunk, manifest, index);
    return chunk ? reply(chunk) : reply({ error: 'invalid_cache' }, 502);
  } catch { return reply({ status: 'unavailable' }, 503); }
}
