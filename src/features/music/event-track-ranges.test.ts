import { expect, it } from 'vitest';
import { parseRange, playbackRange, parseSparseManifest, sparseChunk } from './event-track-ranges';
const asset = { provider: 'youtube' as const, id: 'abcdefghijk' };
const revision = 'a'.repeat(64);
const view = { schemaVersion: 2, asset, analysisVersion: 'server-colab-range-v1', timelineId: 'vod', duration: 7200,
  chunkSeconds: 30, melodyPolicy: 'dominant-monophonic', requestedRange: { start: 2040, end: 2340 },
  chunks: [{ index: 68, revision }] };
it('targets a direct long-media seek without materializing skipped ranges', () => {
  expect(playbackRange(2060, 7200)).toEqual({ start: 2040, end: 2340 });
  expect(playbackRange(4980, 7200)).toEqual({ start: 4980, end: 5280 });
  expect(parseRange({ start: 0, end: 7200 })).toBeUndefined();
  expect(playbackRange(Infinity, 7200)).toBeUndefined();
});
it('distinguishes ready silence from uncached sparse coverage and validates chunk revisions', () => {
  const manifest = parseSparseManifest(view, asset)!;
  expect(manifest.chunks).toHaveLength(1);
  expect(sparseChunk({ schemaVersion: 2, revision, index: 68, events: [] }, manifest, 68)?.events).toEqual([]);
  expect(sparseChunk({ schemaVersion: 2, revision, index: 69, events: [] }, manifest, 69)).toBeUndefined();
  expect(parseSparseManifest({ ...view, chunks: [view.chunks[0], view.chunks[0]] }, asset)).toBeUndefined();
});
it('preserves real event timing, duration and provenance through the existing scheduler adapter', () => {
  const manifest = parseSparseManifest(view, asset)!;
  const event = { eventId: 'lead', type: 'melody', playbackTime: 2040.3, duration: .5, confidence: .8, source: 'server-cache' };
  expect(sparseChunk({ schemaVersion: 2, revision, index: 68, events: [event] }, manifest, 68)?.events[0])
    .toEqual({ id: 'lead', row: 'melody', time: 2040.3, duration: .5, confidence: .8 });
  expect(sparseChunk({ schemaVersion: 2, revision, index: 68, events: [{ ...event, playbackTime: 2039.9 }] }, manifest, 68)).toBeUndefined();
  expect(sparseChunk({ schemaVersion: 2, revision, index: 68, events: [event, { ...event, eventId: 'overlap', playbackTime: 2040.4 }] }, manifest, 68)).toBeUndefined();
});
it('exposes bounded input availability without accepting arbitrary backend diagnostics', () => {
  expect(parseSparseManifest({ ...view, analysisState: 'input_unavailable' }, asset)?.analysisState).toBe('input_unavailable');
  expect(parseSparseManifest({ ...view, analysisState: 'private upstream URL' }, asset)).toBeUndefined();
});
