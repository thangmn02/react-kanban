import type { MediaAsset } from '../src/features/music/event-track';
import { ANALYSIS_VERSION, parseRange } from '../src/features/music/event-track-ranges';
import { LEAD_ANALYSIS_VERSION } from '../src/features/music/lead-events';

type Database = (route: string, init?: RequestInit) => Promise<unknown>;
const bucket = 'beat-audio-inputs';
export const MAX_PLAYBACK_AUDIO_BYTES = 44 + 65 * 16000 * 2;
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
interface InputAdmission { trackId: string; jobs: { jobId: string; start: number; end: number }[] }

export function validatePlaybackWav(bytes: Uint8Array, seconds: number): boolean {
  if (bytes.length < 44 || bytes.length > MAX_PLAYBACK_AUDIO_BYTES || !Number.isFinite(seconds) || seconds <= 0 || seconds > 65) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, length: number) => String.fromCharCode(...bytes.slice(offset, offset + length));
  return text(0, 4) === 'RIFF' && text(8, 4) === 'WAVE' && text(12, 4) === 'fmt ' && text(36, 4) === 'data'
    && view.getUint32(4, true) === bytes.length - 8 && view.getUint32(16, true) === 16
    && view.getUint16(20, true) === 1 && view.getUint16(22, true) === 1 && view.getUint32(24, true) === 16000
    && view.getUint32(28, true) === 32000 && view.getUint16(32, true) === 2 && view.getUint16(34, true) === 16
    && view.getUint32(40, true) === bytes.length - 44 && Math.abs((bytes.length - 44) / 32000 - seconds) <= .01;
}

async function readAudio(request: Request, signal: AbortSignal) {
  if (!request.body || Number(request.headers.get('content-length')) > MAX_PLAYBACK_AUDIO_BYTES) return;
  const reader = request.body.getReader(), parts: Uint8Array[] = [];
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.length;
      if (size > MAX_PLAYBACK_AUDIO_BYTES) { await reader.cancel(); return; }
      parts.push(value);
    }
  } finally { signal.removeEventListener('abort', cancel); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return bytes;
}

export async function handlePlaybackAudioInput(request: Request, asset: MediaAsset, userId: string,
  base: URL, serviceKey: string, signal: AbortSignal, database: Database,
  dispatch: (claim: InputAdmission) => Promise<void>, leadEnabled=false): Promise<{ status: number; body: object }> {
  const query = new URL(request.url).searchParams;
  const demandId = query.get('demandId'), duration = Number(query.get('duration')), inputStart = Number(query.get('inputStart'));
  const range = parseRange({ start: Number(query.get('start')), end: Number(query.get('end')) }, 60);
  const version=query.get('analysisVersion');
  if (request.headers.get('content-type') !== 'audio/wav' || !uuid(demandId) || !range
    || !(version===ANALYSIS_VERSION || leadEnabled && version===LEAD_ANALYSIS_VERSION) || !Number.isFinite(duration) || duration <= 0 || duration > 864000
    || range.end > duration || !Number.isFinite(inputStart) || inputStart < 0 || inputStart > range.start
    || range.start - inputStart > 5 || ![30, 60].includes(range.end - range.start)) {
    return { status: 400, body: { error: 'invalid_segment' } };
  }
  const demands = await database(`beat_analysis_demands?id=eq.${demandId}&user_id=eq.${userId}&expires_at=gt.${new Date().toISOString()}&select=track_id,range_start,range_end&limit=1`) as { track_id: string; range_start: number; range_end: number }[];
  const demand = demands[0];
  if (!demand || !uuid(demand.track_id) || range.start < demand.range_start || range.end > demand.range_end) {
    return { status: 409, body: { error: 'demand_inactive' } };
  }
  const tracks = await database(`beat_event_tracks?id=eq.${demand.track_id}&select=provider,media_asset_id,analysis_version,duration&limit=1`) as { provider: string; media_asset_id: string; analysis_version: string; duration: number }[];
  const track = tracks[0];
  if (!track || track.provider !== asset.provider || track.media_asset_id !== asset.id || track.analysis_version !== version
    || Math.abs(track.duration - duration) > 2) return { status: 409, body: { error: 'source_changed' } };
  const ready = await database(`beat_event_chunks?track_id=eq.${demand.track_id}&chunk_index=gte.${range.start / 30}&chunk_index=lt.${range.end / 30}&state=eq.ready&select=chunk_index`) as unknown[];
  if (ready.length === (range.end - range.start) / 30) return { status: 200, body: { status: 'cached' } };
  const active = await database(`beat_analysis_jobs?track_id=eq.${demand.track_id}&range_start=lt.${range.end}&range_end=gt.${range.start}&state=in.(pending,queued,running)&lease_until=gt.${new Date().toISOString()}&select=id&limit=1`) as unknown[];
  if (active.length) return { status: 202, body: { status: 'pending' } };
  const audio = await readAudio(request, signal);
  if (!audio || !validatePlaybackWav(audio, range.end - inputStart)) return { status: 400, body: { error: 'invalid_audio' } };
  // Recheck live demand atomically after reading the body. This claim cannot
  // recreate an ended demand, and overlapping uploads cannot share input files.
  const claim = await database('rpc/claim_captured_beat_range', { method: 'POST', body: JSON.stringify({
    p_user: userId, p_demand: demandId, p_provider: asset.provider, p_asset: asset.id,
    p_version: version, p_duration: duration, p_start: range.start, p_end: range.end,
  }) }) as InputAdmission | null;
  if (!claim) return { status: 409, body: { error: 'demand_inactive' } };
  if (!uuid(claim.trackId) || !Array.isArray(claim.jobs) || claim.jobs.length > 2
    || claim.jobs.some(job => !uuid(job.jobId) || job.start < range.start || job.end > range.end || job.end <= job.start)) {
    throw new Error('Invalid segment admission');
  }
  if (!claim.jobs.length) return { status: 202, body: { status: 'pending' } };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${asset.provider}:${asset.id}`));
  const key = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  const paths: string[] = [];
  const storage = async (route: string, init: RequestInit) => {
    const response = await fetch(new URL(`/storage/v1/${route}`, base), { ...init, signal,
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...init.headers } });
    if (!response.ok) throw new Error('Private audio storage unavailable');
    return response;
  };
  let retain = false;
  try {
    for (const job of claim.jobs) {
      // A split range gets independent objects so one job's cleanup cannot
      // remove audio still needed by another worker.
      const rawPath = `${key}/${Date.now()}-${crypto.randomUUID()}.wav`, manifestPath = `${key}/${job.jobId}.json`;
      paths.push(rawPath, manifestPath);
      await storage(`object/${bucket}/${rawPath}`, { method: 'POST', headers: { 'Content-Type': 'audio/wav', 'x-upsert': 'false' }, body: new Blob([audio as Uint8Array<ArrayBuffer>]) });
      const manifest = { schemaVersion: 1, inputPath: rawPath, start: inputStart, end: range.end,
        jobId: job.jobId, requestedRange: { start: job.start, end: job.end }, expiresAt: new Date(Date.now() + 3600000).toISOString(), captureKind: 'browser-process', playbackRate: 1 };
      await storage(`object/${bucket}/${manifestPath}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-upsert': 'false' }, body: JSON.stringify(manifest) });
    }
    await dispatch(claim);
    retain = claim.jobs.length > 0;
    return { status: 202, body: { status: 'pending' } };
  } finally {
    if (!retain) {
      await Promise.all(claim.jobs.map(job => database(`beat_analysis_jobs?id=eq.${job.jobId}&state=eq.pending`, {
        method: 'PATCH', body: JSON.stringify({ state: 'failed', failure_code: 'input_upload_failed', retry_after: new Date().toISOString() }),
      }).catch(() => {})));
      await storage(`object/${bucket}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: paths }) }).catch(() => {});
    }
  }
}

export async function registerPlaybackDemand(database: Database, userId: string, asset: MediaAsset,
  demandId: string, duration: number, start: number, end: number, version=ANALYSIS_VERSION) {
  const value = await database('rpc/register_beat_demand', { method: 'POST', body: JSON.stringify({
    p_user: userId, p_demand: demandId, p_provider: asset.provider, p_asset: asset.id,
    p_version: version, p_duration: duration, p_start: start, p_end: end,
  }) });
  if (typeof value !== 'string' || !uuid(value)) throw new Error('Invalid capture demand');
  return value;
}
