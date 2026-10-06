import { expect, it } from 'vitest';
import { parseManifest, parseChunk, readBoundedJson, MAX_RESPONSE_BYTES, type TrackManifest } from './event-track';
const asset = { provider: 'youtube' as const, id: 'abcdefghijk' };
const manifest: TrackManifest = { version: 1, asset, revision: 'revision', analysisVersion: 'offline-v1', duration: 100,
  chunkSeconds: 30, melodyPolicy: 'dominant-monophonic' };
it('rejects mismatched assets, versions and media durations without trusting names', () => {
  expect(parseManifest(manifest, asset, 100)).toEqual(manifest);
  expect(parseManifest({ ...manifest, version: 2 }, asset)).toBeUndefined();
  expect(parseManifest(manifest, { ...asset, id: 'other-video' })).toBeUndefined();
  expect(parseManifest(manifest, asset, 30)).toBeUndefined();
});
it('bounds chunks and rejects unsorted, duplicate, out-of-range and overlapping lead events', () => {
  const note = { id: 'n', time: 30.25, row: 'melody', confidence: .8, duration: .2 };
  const chunk = { version: 1, revision: 'revision', index: 1, events: [note] };
  expect(parseChunk(chunk, manifest, 1)?.events).toEqual([note]);
  expect(parseChunk({ ...chunk, events: [note, { ...note, id: 'n2', time: 30.3 }] }, manifest, 1)).toBeUndefined();
  expect(parseChunk({ ...chunk, events: [note, note] }, manifest, 1)).toBeUndefined();
  expect(parseChunk({ ...chunk, events: [{ ...note, time: 60 }] }, manifest, 1)).toBeUndefined();
  expect(parseChunk({ ...chunk, events: Array(4097).fill(note) }, manifest, 1)).toBeUndefined();
  expect(parseChunk({ ...chunk, revision: 'old' }, manifest, 1)).toBeUndefined();
  expect(parseChunk({ ...chunk, events: [{ ...note, duration: 0 }, { ...note, id: 'another', duration: 0 }] }, manifest, 1)).toBeUndefined();
});
it('stops oversized streaming responses before JSON parsing', async () => {
  await expect(readBoundedJson(new Response(' '.repeat(MAX_RESPONSE_BYTES + 1)))).rejects.toThrow('Oversized');
  await expect(readBoundedJson(Response.json(manifest))).resolves.toEqual(manifest);
});
