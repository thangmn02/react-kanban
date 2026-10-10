import { parseManifest, parseChunk, CHUNK_SECONDS, type MediaAsset, type TrackManifest, type TrackChunk } from './event-track';
import type { LeadProvenance } from './lead-events';

export const ANALYSIS_WINDOW_SECONDS = 300;
export const ANALYSIS_VERSION = 'server-primary-melody-range-v1';
export interface PlaybackRange { start: number; end: number }
export interface ReadyChunk { index: number; revision: string }
export const analysisStates = ['pending', 'queued', 'running', 'completed', 'failed', 'input_unavailable', 'cancelled'] as const;
export type AnalysisState = typeof analysisStates[number];
export interface SparseManifest {
  schemaVersion: 2; asset: MediaAsset; analysisVersion: string; timelineId: 'vod';
  duration: number; chunkSeconds: 30; melodyPolicy: 'dominant-monophonic';
  requestedRange: PlaybackRange; chunks: ReadyChunk[];
  analysisState?: AnalysisState;
}
export interface MusicEvent {
  eventId: string; type: 'kick' | 'snare' | 'hat' | 'bass' | 'melody';
  playbackTime: number; duration: number; confidence: number;
  source: 'server-cache';
  lead?: LeadProvenance;
}
export interface SparseChunk { schemaVersion: 2; revision: string; index: number; events: MusicEvent[] }

export function parseRange(value: unknown, maximum = 600): PlaybackRange | undefined {
  if (!value || typeof value !== 'object') return;
  const { start, end } = value as PlaybackRange;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > 864000
    || end - start > maximum || start % CHUNK_SECONDS !== 0) return;
  return { start, end };
}
export function playbackRange(position: number, duration: number): PlaybackRange | undefined {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0 || position < 0 || position >= duration) return;
  const start = Math.floor(position / CHUNK_SECONDS) * CHUNK_SECONDS;
  return parseRange({ start, end: Math.min(duration, start + ANALYSIS_WINDOW_SECONDS) });
}
export function parseSparseManifest(value: unknown, asset: MediaAsset, duration?: number): SparseManifest | undefined {
  if (!value || typeof value !== 'object') return;
  const view = value as SparseManifest;
  const range = parseRange(view.requestedRange);
  const base = parseManifest({ ...view, version: 1, revision: view.analysisVersion }, asset, duration);
  if (!base || view.schemaVersion !== 2 || view.timelineId !== 'vod' || !range || range.end > base.duration
    || !Array.isArray(view.chunks) || view.chunks.length > 20
    || view.analysisState !== undefined && !analysisStates.includes(view.analysisState)) return;
  const seen = new Set<number>();
  for (const chunk of view.chunks) {
    if (!chunk || !Number.isSafeInteger(chunk.index) || chunk.index < range.start / CHUNK_SECONDS
      || chunk.index * CHUNK_SECONDS >= range.end || seen.has(chunk.index)
      || typeof chunk.revision !== 'string' || !/^[a-f0-9]{64}$/.test(chunk.revision)) return;
    seen.add(chunk.index);
  }
  return { schemaVersion: 2, asset, analysisVersion: base.analysisVersion, timelineId: 'vod', duration: base.duration,
    chunkSeconds: 30, melodyPolicy: 'dominant-monophonic', requestedRange: range,
    chunks: view.chunks.map(chunk => ({ index: chunk.index, revision: chunk.revision })),
    ...(view.analysisState ? { analysisState: view.analysisState } : {}) };
}
// The scheduler consumes the established event shape; sparse transport is an
// explicit adapter, not a second renderer or inferred whole-track coverage.
export function sparseChunk(value: unknown, manifest: SparseManifest, index: number): TrackChunk | undefined {
  if (!value || typeof value !== 'object') return;
  const chunk = value as SparseChunk, descriptor = manifest.chunks.find(item => item.index === index);
  if (!descriptor || chunk.schemaVersion !== 2 || chunk.revision !== descriptor.revision || chunk.index !== index
    || !Array.isArray(chunk.events) || chunk.events.length > 4096) return;
  for (const event of chunk.events) if (!event || event.source !== 'server-cache' || !Number.isFinite(event.duration)) return;
  return parseChunk({ version: 1, revision: chunk.revision, index, events: chunk.events.map(event => ({
    id: event.eventId, row: event.type, time: event.playbackTime, duration: event.duration, confidence: event.confidence, lead: event.lead,
  })) }, asTrackManifest(manifest, chunk.revision), index);
}
export function asTrackManifest(manifest: SparseManifest, revision = manifest.analysisVersion): TrackManifest {
  return { version: 1, asset: manifest.asset, revision, analysisVersion: manifest.analysisVersion,
    duration: manifest.duration, chunkSeconds: 30, melodyPolicy: 'dominant-monophonic' };
}
