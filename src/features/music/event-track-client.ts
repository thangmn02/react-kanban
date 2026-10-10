import { isNativeWidget } from '../native/runtime';
import supabase from '../../lib/supabase';
import { assetKey, parseManifest, parseChunk, readBoundedJson, type MediaAsset, type TrackManifest } from './event-track';
import { ANALYSIS_VERSION, asTrackManifest, parseSparseManifest, sparseChunk, type AnalysisState, type PlaybackRange, type SparseManifest } from './event-track-ranges';
import type { PlaybackAudioSegment } from './playback-audio-segment';
import { LEAD_ANALYSIS_VERSION } from './lead-events';
import { leadPulseEnabled, leadProcessingEnabled } from './lead-feature';
export interface EventTrackClient {
  manifest(range?: PlaybackRange): Promise<TrackManifest | undefined>;
  chunk(manifest: TrackManifest, index: number, signal?: AbortSignal): Promise<import('./event-track').TrackChunk | undefined>;
  requestAnalysis(range?: PlaybackRange, demandId?: string, capturedInput?: boolean): Promise<'pending' | 'unavailable'>;
  uploadSegment?(segment: PlaybackAudioSegment, demandId: string): Promise<boolean>;
  endDemand?(demandId: string): Promise<void>;
  analysisStatus?(): AnalysisState | undefined;
}
export class InvalidEventTrack extends Error {}
export class EventTrackServiceError extends Error {
  readonly status: number;
  constructor(status: number) { super('EventTrack service unavailable'); this.status = status; }
  get permanent() { return [400, 401, 403, 410, 422].includes(this.status); }
}
export function createEventTrackClient(asset: MediaAsset, signal: AbortSignal, duration?: number,
  endpoint = isNativeWidget() && !(import.meta.env.DEV && leadPulseEnabled()) ? 'https://koraspace.online/api/beat-events' : '/api/beat-events',
  version = leadPulseEnabled() ? LEAD_ANALYSIS_VERSION : ANALYSIS_VERSION): EventTrackClient {
  const query = new URLSearchParams({ provider: asset.provider, id: asset.id });
  let sparse: SparseManifest | undefined;
  const request = async (suffix = '', init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (version === LEAD_ANALYSIS_VERSION && !headers.has('Authorization')) {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(`${endpoint}?${query}${suffix}`, {
      ...init, headers, signal: AbortSignal.any([signal, ...(init.signal ? [init.signal] : []), AbortSignal.timeout(init.body instanceof Blob ? 15000 : 4000)]), credentials: 'omit' });
  };
  return {
    analysisStatus: () => sparse?.analysisState,
    async manifest(range) {
      const response = await request(range ? `&start=${range.start}&end=${range.end}&analysisVersion=${version}` : '');
      if (response.status === 404) { sparse = undefined; return; }
      if (!response.ok) throw new EventTrackServiceError(response.status);
      const raw = await readBoundedJson(response);
      sparse = (raw as { schemaVersion?: number })?.schemaVersion === 2 ? parseSparseManifest(raw, asset, duration) : undefined;
      const manifest = sparse ? asTrackManifest(sparse) : parseManifest(raw, asset, duration);
      if (!manifest) throw new Error(`Invalid EventTrack for ${assetKey(asset).split(':')[0]}`);
      if (version===LEAD_ANALYSIS_VERSION && manifest.analysisVersion!==version) throw new InvalidEventTrack('Lead analysis version mismatch');
      return manifest;
    },
    async chunk(manifest, index, chunkSignal) {
      const view = sparse;
      const descriptor = view?.chunks.find(chunk => chunk.index === index);
      if (view && !descriptor) return;
      const response = await request(`&chunk=${index}&analysisVersion=${manifest.analysisVersion}${descriptor ? `&revision=${descriptor.revision}` : ''}`, { signal: chunkSignal });
      if (response.status === 404) return;
      if (response.status === 502) throw new InvalidEventTrack('Invalid EventTrack chunk');
      if (!response.ok) throw new EventTrackServiceError(response.status);
      const raw = await readBoundedJson(response);
      const chunk = view ? sparseChunk(raw, view, index) : parseChunk(raw, manifest, index);
      if (!chunk) throw new InvalidEventTrack('Invalid EventTrack chunk');
      return chunk;
    },
    async requestAnalysis(range, demandId, capturedInput = false) {
      if (version === LEAD_ANALYSIS_VERSION && !leadProcessingEnabled()) return 'unavailable';
      // Heavy analysis is a server capability, never a client model download.
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token || !range || !demandId || !duration) return 'unavailable';
      const response = await request('', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemaVersion: 2, analysisVersion: version, operation: 'demand', demandId, duration, requestedRange: range,
          ...(capturedInput ? { inputMode: 'captured-segment' } : {}) }) });
      if (response.status !== 202) {
        if ([400,401,403,410,422].includes(response.status)) throw new EventTrackServiceError(response.status);
        return 'unavailable';
      }
      const job = await readBoundedJson(response) as { status?: unknown; jobId?: unknown; trackId?: unknown; inputState?: unknown };
      return job?.status === 'pending' && (typeof job.jobId === 'string'
        || capturedInput && typeof job.trackId === 'string' && job.inputState === 'awaiting-segment') ? 'pending' : 'unavailable';
    },
    async uploadSegment(segment, demandId) {
      if (version === LEAD_ANALYSIS_VERSION && !leadProcessingEnabled()) return false;
      if (sparse && Array.from({ length: (segment.end - segment.start) / 30 }, (_, index) => segment.start / 30 + index)
        .every(index => sparse!.chunks.some(chunk => chunk.index === index))) return true;
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token || !duration || signal.aborted) return false;
      const metadata = new URLSearchParams({ operation: 'segment', analysisVersion: version, demandId,
        duration: String(duration), start: String(segment.start), end: String(segment.end), inputStart: String(segment.inputStart) });
      const response = await request(`&${metadata}`, { method: 'POST',
        // Never send provider credentials, browser cookies or a remote audio URL.
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'audio/wav' }, body: new Blob([segment.audio as Uint8Array<ArrayBuffer>], { type: 'audio/wav' }),
        signal: AbortSignal.timeout(15000) });
      return response.status === 202 || response.status === 200;
    },
    async endDemand(demandId) {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) return;
      // The lifetime may already be aborted on source change/pagehide. Expiry
      // remains authoritative if this best-effort release cannot be delivered.
      await fetch(`${endpoint}?${query}`, { method: 'POST', credentials: 'omit', keepalive: true, signal: AbortSignal.timeout(4000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemaVersion: 2, analysisVersion: version, operation: 'end', demandId }) });
    },
  };
}
