import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { selectLeadNotes } from '../server/lead-note-selection.ts';
import { parseMediaAsset } from '../extensions/kanban-music/media-asset.js';
import { parseManifest, parseChunk, MAX_RESPONSE_BYTES } from '../src/features/music/event-track.ts';

const [inputFile, outputDirectory] = process.argv.slice(2);
if (!inputFile || !outputDirectory) throw new Error('Usage: node scripts/import-beat-analysis.mjs <analysis.json> <cache-directory>');
const input = JSON.parse(await readFile(inputFile, 'utf8'));
const asset = parseMediaAsset(input.asset);
if (!asset || !['piano', 'guitar', 'other', 'vocals', 'primary'].includes(input.leadSource)
  || !Array.isArray(input.onsets) || input.onsets.length > 200000) {
  throw new Error('Expected asset, selected instrumental leadSource, notes and percussion onsets');
}
// Tracked output already owns one measured stream; do not apply a second pitch
// quantile across source handoffs. Validate the same note data without filtering.
let lead;
if (input.primaryMelody === true && input.leadSource === 'primary') {
  selectLeadNotes(input.notes, input.minEventGap ?? .28, true);
  lead = input.notes;
  if (lead.some((note, index) => index && note.start < lead[index - 1].end)) throw new Error('Overlapping primary melody');
} else lead = selectLeadNotes(input.notes, input.minEventGap ?? .28, input.leadSource === 'other');
const offset = input.offset ?? 0;
if (!Number.isFinite(offset) || offset < 0) throw new Error('Invalid analysis offset');
const percussion = input.onsets.map((event) => {
  if (!['kick', 'snare', 'hat', 'bass'].includes(event.row)) throw new Error('Percussion export cannot contain a second Melody line');
  return { time: event.time + offset, row: event.row, confidence: event.confidence };
});
const melody = lead.map((note) => ({
  time: note.start + offset,
  row: 'melody',
  confidence: note.amp,
  duration: Math.min(30, note.end - note.start),
}));
const events = [...percussion, ...melody]
  .sort((a, b) => a.time - b.time)
  .map((event, index) => ({ ...event, id: `attack-${index}` }));
const revision = createHash('sha256').update(JSON.stringify(events)).digest('hex');
const manifest = parseManifest({ version: 1, asset, duration: input.duration, revision, analysisVersion: input.analysisVersion ?? 'lead-selector-v2',
  chunkSeconds: 30, melodyPolicy: 'dominant-monophonic' }, asset);
if (!manifest || events.some((event) => !Number.isFinite(event.time) || event.time < 0 || event.time >= manifest.duration)) {
  throw new Error('Invalid media duration or event timestamp');
}
const chunks = Array.from({ length: Math.ceil(manifest.duration / 30) }, (_, index) => ({ version: 1, revision, index, events: [] }));
for (const event of events) chunks[Math.floor(event.time / 30)].events.push(event);
// Validate everything before publishing any file. This also prevents exporting
// oversized chunks or overlapping lead holds into the production cache.
for (const chunk of chunks) {
  if (!parseChunk(chunk, manifest, chunk.index) || Buffer.byteLength(JSON.stringify(chunk)) > MAX_RESPONSE_BYTES) {
    throw new Error(`Invalid chunk ${chunk.index}`);
  }
}
const key = createHash('sha256').update(`1:${asset.provider}:${asset.id}`).digest('hex');
const directory = join(resolve(outputDirectory), key);
await mkdir(directory, { recursive: true });
for (const chunk of chunks) await writeFile(join(directory, `${chunk.index}.json`), `${JSON.stringify(chunk)}\n`);
await writeFile(join(directory, 'manifest.json'), `${JSON.stringify(manifest)}\n`);
console.log(`Exported ${events.length} events, ${lead.length} lead attacks, ${chunks.length} chunks.`);
