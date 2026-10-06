import { isNativeWidget } from '../native/runtime';
import supabase from '../../lib/supabase';
import { assetKey, parseManifest, parseChunk, readBoundedJson, type MediaAsset, type TrackManifest } from './event-track';
export interface EventTrackClient {
  manifest(): Promise<TrackManifest | undefined>;
  chunk(manifest: TrackManifest, index: number, signal?: AbortSignal): Promise<import('./event-track').TrackChunk | undefined>;
  requestAnalysis(): Promise<'pending' | 'unavailable'>;
}
export class InvalidEventTrack extends Error {}
export function createEventTrackClient(asset: MediaAsset, signal: AbortSignal, duration?: number,
  endpoint = isNativeWidget() ? 'https://koraspace.online/api/beat-events' : '/api/beat-events'): EventTrackClient {
  const query = new URLSearchParams({ provider: asset.provider, id: asset.id });
  const request = async (suffix = '', init: RequestInit = {}) => fetch(`${endpoint}?${query}${suffix}`, {
    ...init, signal: AbortSignal.any([signal, ...(init.signal ? [init.signal] : []), AbortSignal.timeout(4000)]), credentials: 'omit' });
  return {
    async manifest() {
      const response = await request();
      if (response.status === 404) return;
      if (!response.ok) throw new Error('EventTrack unavailable');
      const manifest = parseManifest(await readBoundedJson(response), asset, duration);
      if (!manifest) throw new Error(`Invalid EventTrack for ${assetKey(asset).split(':')[0]}`);
      return manifest;
    },
    async chunk(manifest, index, chunkSignal) {
      const response = await request(`&chunk=${index}`, { signal: chunkSignal });
      if (response.status === 404) return;
      if (response.status === 502) throw new InvalidEventTrack('Invalid EventTrack chunk');
      if (!response.ok) throw new Error('EventTrack chunk unavailable');
      const chunk = parseChunk(await readBoundedJson(response), manifest, index);
      if (!chunk) throw new InvalidEventTrack('Invalid EventTrack chunk');
      return chunk;
    },
    async requestAnalysis() {
      // Heavy analysis is a server capability, never a client model download.
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) return 'unavailable';
      const response = await request('', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (response.status !== 202) return 'unavailable';
      const job = await readBoundedJson(response) as { status?: unknown; jobId?: unknown };
      return job?.status === 'pending' && typeof job.jobId === 'string' ? 'pending' : 'unavailable';
    },
  };
}
