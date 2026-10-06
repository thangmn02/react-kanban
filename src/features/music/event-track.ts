import { parseMediaAsset, type MediaAsset } from '../../../extensions/kanban-music/media-asset.js';
export type { MediaAsset };
export const EVENT_TRACK_VERSION = 1;
export const CHUNK_SECONDS = 30;
export const MAX_CHUNK_EVENTS = 4096;
export const MAX_RESPONSE_BYTES = 524288;
export type EventRow = 'kick' | 'snare' | 'hat' | 'bass' | 'melody';
export interface TrackManifest {
  version: 1; asset: MediaAsset; revision: string; analysisVersion: string;
  duration: number; chunkSeconds: 30; melodyPolicy: 'dominant-monophonic';
}
export interface TrackOnset { id: string; time: number; row: EventRow; confidence: number; duration?: number }
export interface TrackChunk { version: 1; revision: string; index: number; events: TrackOnset[] }
const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const identifier = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9:_-]{1,100}$/.test(v);
export const assetKey = (asset: MediaAsset) => `${asset.provider}:${asset.id}`;

export function parseManifest(value: unknown, asset: MediaAsset, duration?: number): TrackManifest | undefined {
  if (!object(value)) return;
  const parsed = parseMediaAsset(value.asset);
  if (value.version !== EVENT_TRACK_VERSION || !parsed || assetKey(parsed) !== assetKey(asset)
    || !identifier(value.revision) || !identifier(value.analysisVersion) || value.chunkSeconds !== CHUNK_SECONDS
    || value.melodyPolicy !== 'dominant-monophonic' || !finite(value.duration) || value.duration <= 0 || value.duration > 864000
    || duration && Math.abs(duration - value.duration) > Math.max(2, duration * .02)) return;
  return { version: 1, asset: parsed, revision: value.revision, analysisVersion: value.analysisVersion,
    duration: value.duration, chunkSeconds: CHUNK_SECONDS, melodyPolicy: 'dominant-monophonic' };
}

export function parseChunk(value: unknown, manifest: TrackManifest, index: number): TrackChunk | undefined {
  if (!object(value) || value.version !== 1 || value.revision !== manifest.revision || value.index !== index
    || !Number.isSafeInteger(index) || index < 0 || index * CHUNK_SECONDS >= manifest.duration
    || !Array.isArray(value.events) || value.events.length > MAX_CHUNK_EVENTS) return;
  const events: TrackOnset[] = [], ids = new Set<string>();
  let lastTime = -1, melodyEnd = -1, melodyTime = -1;
  for (const event of value.events) {
    if (!object(event) || !identifier(event.id) || ids.has(event.id) || !finite(event.time) || event.time < lastTime
      || event.time < index * CHUNK_SECONDS || event.time >= Math.min((index + 1) * CHUNK_SECONDS, manifest.duration)
      || !['kick', 'snare', 'hat', 'bass', 'melody'].includes(String(event.row))
      || !finite(event.confidence) || event.confidence < 0 || event.confidence > 1
      || event.duration !== undefined && (!finite(event.duration) || event.duration < 0 || event.duration > 30)) return;
    // A cache cannot represent simultaneous independent lead notes as one lead.
    if (event.row === 'melody') {
      if (event.time < melodyEnd || event.time === melodyTime) return;
      melodyTime = event.time;
      melodyEnd = event.time + Number(event.duration || 0);
    }
    ids.add(event.id); lastTime = event.time;
    events.push({ id: event.id, time: event.time, row: event.row as EventRow, confidence: event.confidence,
      ...(event.duration !== undefined ? { duration: event.duration as number } : {}) });
  }
  return { version: 1, revision: manifest.revision, index, events };
}

export async function readBoundedJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) throw new Error('Oversized EventTrack');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing EventTrack body');
  const decoder = new TextDecoder(); let text = '', bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.length; if (bytes > MAX_RESPONSE_BYTES) throw new Error('Oversized EventTrack');
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { await reader.cancel().catch(() => {}); }
}
