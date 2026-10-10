import { readBoundedJson, type MediaAsset } from '../src/features/music/event-track';
import { ANALYSIS_VERSION, parseRange, parseSparseManifest, sparseChunk, type SparseManifest } from '../src/features/music/event-track-ranges';
import { handlePlaybackAudioInput, registerPlaybackDemand } from './playback-audio-input';
import { LEAD_ANALYSIS_VERSION } from '../src/features/music/lead-events';

export interface SparseCacheConfig { supabaseUrl?: string; supabaseAnonKey?: string; supabaseServiceKey?: string; analysisUrl?: string; analysisKey?: string; leadEnabled?: boolean }
const supportedVersion=(value:unknown,config:SparseCacheConfig)=>value===ANALYSIS_VERSION || config.leadEnabled && value===LEAD_ANALYSIS_VERSION;

type Database = (route: string, init?: RequestInit) => Promise<unknown>;
interface TrackRow { id: string; duration: number }
interface ClaimedRange { trackId: string; jobs: { jobId: string; start: number; end: number }[] }

const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const reply = (body: object, status = 200) => Response.json(body, { status, headers: {
  'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600',
} });

function serviceUrl(value?: string): URL | undefined {
  if (!value) return;
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password ? url : undefined;
}

function createDatabase(base: URL, serviceKey: string, signal: AbortSignal): Database {
  return async (route, init = {}) => {
    const response = await fetch(new URL(`/rest/v1/${route}`, base), { ...init, signal, headers: {
      apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...init.headers,
    } });
    if (!response.ok) throw new Error('Cache service unavailable');
    return response.status === 204 ? undefined : readBoundedJson(response);
  };
}

async function authenticatedUser(request: Request, base: URL, anonKey: string | undefined,
  signal: AbortSignal): Promise<string | undefined> {
  const token = request.headers.get('authorization');
  if (!token?.startsWith('Bearer ') || !anonKey) return;
  const response = await fetch(new URL('/auth/v1/user', base), {
    signal, headers: { apikey: anonKey, Authorization: token },
  });
  if (!response.ok) return;
  const user = await readBoundedJson(response) as { id?: unknown };
  return uuid(user?.id) ? user.id : undefined;
}

async function readRequestBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > 2048) return;
  try {
    return await readBoundedJson(new Response(request.body), 2048);
  } catch {
    return;
  }
}

async function dispatchJobs(claim: ClaimedRange, service: URL, analysisKey: string,
  signal: AbortSignal, database: Database): Promise<void> {
  // A claim returns only new missing cores. Existing ready/in-flight chunks
  // produce no new Modal invocation, including overlapping users.
  await Promise.all(claim.jobs.map(async ({ jobId }) => {
    try {
      const response = await fetch(service, { method: 'POST', signal, headers: {
        Authorization: `Bearer ${analysisKey}`, 'Content-Type': 'application/json',
      }, body: JSON.stringify({ schemaVersion: 2, jobId }) });
      if (response.status !== 202) throw new Error('Analysis unavailable');
      const result = await readBoundedJson(response) as { callId?: unknown };
      if (typeof result.callId !== 'string' || result.callId.length > 200) throw new Error('Invalid admission');
      await database(`beat_analysis_jobs?id=eq.${jobId}&state=eq.pending`, {
        method: 'PATCH', body: JSON.stringify({ state: 'queued', call_id: result.callId }),
      });
    } catch {
      // Unknown/failed dispatch is not a forever-owned hole. Expiring claims
      // recover only on subsequent live demand; no autonomous queue.
      await database(`beat_analysis_jobs?id=eq.${jobId}&state=eq.pending`, {
        method: 'PATCH', body: JSON.stringify({ failure_code: 'dispatch_unavailable' }),
      }).catch(() => {});
    }
  }));
}

async function handleDemand(request: Request, asset: MediaAsset, config: SparseCacheConfig,
  base: URL, signal: AbortSignal, database: Database): Promise<Response> {
  const userId = await authenticatedUser(request, base, config.supabaseAnonKey, signal);
  if (!userId) return reply({ error: 'unauthorized' }, 401);

  if (new URL(request.url).searchParams.get('operation') === 'segment') {
    const service = serviceUrl(config.analysisUrl);
    if (!service || !config.analysisKey) return reply({ status: 'unavailable' }, 503);
    const result = await handlePlaybackAudioInput(request, asset, userId, base, config.supabaseServiceKey!, signal, database,
      claim => dispatchJobs(claim, service, config.analysisKey!, signal, database), config.leadEnabled);
    return reply(result.body, result.status);
  }

  const rawBody = await readRequestBody(request);
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) return reply({ error: 'invalid_request' }, 400);
  const body = rawBody as Record<string, unknown>;
  if (JSON.stringify(body).length > 2048 || body.schemaVersion !== 2
    || !supportedVersion(body.analysisVersion,config) || !uuid(body.demandId)) {
    return reply({ error: 'invalid_request' }, 400);
  }
  if (body.operation === 'end') {
    await database(`beat_analysis_demands?id=eq.${body.demandId}&user_id=eq.${userId}`, { method: 'DELETE' });
    return reply({ status: 'ended' });
  }

  const range = parseRange(body.requestedRange, 300);
  const duration = Number(body.duration);
  if (body.operation !== 'demand' || !range || typeof body.duration !== 'number' || !Number.isFinite(duration)
    || duration <= 0 || duration > 864000 || range.end > duration) return reply({ error: 'invalid_range' }, 400);

  const service = serviceUrl(config.analysisUrl);
  if (!service || !config.analysisKey) return reply({ status: 'unavailable' }, 503);
  if (body.inputMode === 'captured-segment') {
    const trackId = await registerPlaybackDemand(database, userId, asset, body.demandId, duration, range.start, range.end, String(body.analysisVersion));
    return reply({ status: 'pending', trackId, inputState: 'awaiting-segment', retryAfter: 15 }, 202);
  }
  const claim = await database('rpc/claim_beat_range', { method: 'POST', body: JSON.stringify({
    p_user: userId, p_demand: body.demandId, p_provider: asset.provider, p_asset: asset.id,
    p_version: body.analysisVersion, p_duration: duration, p_start: range.start, p_end: range.end,
  }) }) as ClaimedRange;
  if (!uuid(claim?.trackId) || !Array.isArray(claim.jobs) || claim.jobs.length > 10
    || claim.jobs.some(job => !uuid(job.jobId))) throw new Error('Invalid admission');

  await dispatchJobs(claim, service, config.analysisKey, signal, database);
  return reply({ status: 'pending', jobId: claim.trackId, retryAfter: 15 }, 202);
}

async function loadTrack(asset: MediaAsset, version: string, database: Database): Promise<TrackRow | undefined> {
  const identity = new URLSearchParams({
    provider: `eq.${asset.provider}`, media_asset_id: `eq.${asset.id}`, analysis_version: `eq.${version}`,
    timeline_id: 'eq.vod', select: 'id,duration', limit: '1',
  });
  const tracks = await database(`beat_event_tracks?${identity}`) as TrackRow[];
  return tracks[0];
}

async function handleChunk(url: URL, asset: MediaAsset, track: TrackRow, version: string,
  base: URL, serviceKey: string, signal: AbortSignal, database: Database): Promise<Response> {
  const chunkIndex = url.searchParams.get('chunk')!;
  const index = Number(chunkIndex);
  const revision = url.searchParams.get('revision');
  if (!/^\d{1,5}$/.test(chunkIndex) || index > 28799 || !revision || !/^[a-f0-9]{64}$/.test(revision)) {
    return reply({ error: 'invalid_chunk' }, 400);
  }
  const rows = await database(`beat_event_chunks?track_id=eq.${track.id}&chunk_index=eq.${index}&state=eq.ready&revision=eq.${revision}&select=object_path&limit=1`) as { object_path: string }[];
  if (!rows[0]) return reply({ status: 'miss' }, 404);

  const payload = await fetch(new URL(`/storage/v1/object/authenticated/beat-event-tracks/${rows[0].object_path}`, base), {
    signal, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!payload.ok) throw new Error('Cache unavailable');
  const raw = await readBoundedJson(payload);
  const view: SparseManifest = {
    schemaVersion: 2, asset, analysisVersion: version, timelineId: 'vod', duration: track.duration,
    chunkSeconds: 30, melodyPolicy: 'dominant-monophonic',
    requestedRange: { start: index * 30, end: Math.min(track.duration, (index + 1) * 30) },
    chunks: [{ index, revision }],
  };
  return sparseChunk(raw, view, index) ? reply(raw as object) : reply({ error: 'invalid_cache' }, 502);
}

async function handleManifest(url: URL, asset: MediaAsset, track: TrackRow, version: string,
  database: Database): Promise<Response> {
  const range = parseRange({ start: Number(url.searchParams.get('start')), end: Number(url.searchParams.get('end')) });
  if (!range || range.end > track.duration) return reply({ error: 'invalid_range' }, 400);
  const rows = await database(`beat_event_chunks?track_id=eq.${track.id}&chunk_index=gte.${range.start / 30}&chunk_index=lt.${Math.ceil(range.end / 30)}&state=eq.ready&select=chunk_index,revision&order=chunk_index&limit=20`) as { chunk_index: number; revision: string }[];
  const jobs = await database(`beat_analysis_jobs?track_id=eq.${track.id}&range_start=lt.${range.end}&range_end=gt.${range.start}&select=state&order=created_at.desc&limit=1`) as { state: string }[];
  const manifest = parseSparseManifest({
    schemaVersion: 2, asset, analysisVersion: version, timelineId: 'vod', duration: track.duration,
    chunkSeconds: 30, melodyPolicy: 'dominant-monophonic', requestedRange: range,
    chunks: rows.map(row => ({ index: row.chunk_index, revision: row.revision })),
    ...(jobs[0] ? { analysisState: jobs[0].state } : {}),
  }, asset);
  return manifest ? reply(manifest) : reply({ error: 'invalid_cache' }, 502);
}

// Thin authenticated orchestration only. Model execution stays behind the
// analysis-service endpoint; private payloads and credentials never reach UI.
export async function handleSparseBeatCache(request: Request, asset: MediaAsset, config: SparseCacheConfig): Promise<Response> {
  if (!config.supabaseUrl || !config.supabaseServiceKey) return reply({ status: 'unavailable' }, 503);
  const base = new URL(config.supabaseUrl);
  if (base.protocol !== 'https:' || base.username || base.password) return reply({ status: 'unavailable' }, 503);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(new URL(request.url).searchParams.get('operation') === 'segment' ? 15000 : 4000)]);
  const database = createDatabase(base, config.supabaseServiceKey, signal);
  try {
    const url = new URL(request.url);
    const version = url.searchParams.get('analysisVersion') || ANALYSIS_VERSION;
    if (!supportedVersion(version,config)) return reply({ error: 'unsupported_analysis' }, 400);
    if (request.method === 'POST') return await handleDemand(request, asset, config, base, signal, database);
    if (request.method !== 'GET') return reply({ error: 'method_not_allowed' }, 405);

    const track = await loadTrack(asset, version, database);
    if (!track) return reply({ status: 'miss' }, 404);
    return url.searchParams.has('chunk')
      ? await handleChunk(url, asset, track, version, base, config.supabaseServiceKey, signal, database)
      : await handleManifest(url, asset, track, version, database);
  } catch {
    return reply({ status: 'unavailable' }, 503);
  }
}
