import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { selectLeadNotes } from '../server/lead-note-selection.ts';
import { parseManifest, parseChunk } from '../src/features/music/event-track.ts';

// Reference examples validate preservation, not universal musical accuracy.
// Selection options are explicit inputs; titles never choose a stem or rule.
const [referenceFile, optionsFile, reportFile] = process.argv.slice(2);
if (!referenceFile || !optionsFile || !reportFile) {
  throw new Error('Usage: node scripts/verify-lead-reference.mjs <reference.json> <selection-options.json> <report.json>');
}
const reference = JSON.parse(await readFile(referenceFile, 'utf8'));
const options = JSON.parse(await readFile(optionsFile, 'utf8'));
if (reference.version !== 1 || !Array.isArray(options.cases) || !options.cases.length) {
  throw new Error('Expected version-one reference and explicit selection cases');
}
const report = { interpretation: 'Saved selector agreement, not perceptual ground truth or global tuning.', cases: [] };
const temporaryRoot = join(tmpdir(), 'kora-lead-verification-');
const temporary = await mkdtemp(temporaryRoot);
try {
  for (const { id, leadSource, minEventGap = .28 } of options.cases) {
    const example = reference[id];
    if (!example || !Array.isArray(example.raw) || !Array.isArray(example.selected)
      || !['piano', 'guitar', 'other'].includes(leadSource)) throw new Error('Invalid reference case');
    const actual = selectLeadNotes(example.raw, minEventGap, leadSource === 'other');
    const expected = example.selected;
    const mismatches = actual.filter((note, index) => {
      const wanted = expected[index];
      return !wanted || note.pitch !== wanted.pitch || Math.abs(note.start - wanted.start) > 1e-6
        || Math.abs(note.amp - wanted.amp) > 1e-6;
    }).length + Math.max(0, expected.length - actual.length);
    const overlapping = actual.filter((note, index) => index && note.start < actual[index - 1].end).length;
    const clippedHolds = actual.filter((note, index) => expected[index] && note.end < expected[index].end - 1e-6).length;
    const asset = { provider: 'youtube', id: 'abcdefghijk' };
    const duration = Math.max(1, ...example.raw.map(note => note.end)) + 1;
    const input = join(temporary, 'analysis.json'), output = join(temporary, 'cache');
    await writeFile(input, JSON.stringify({ asset, duration, leadSource, minEventGap, notes: example.raw, onsets: [] }));
    execFileSync(process.execPath, [resolve('scripts/import-beat-analysis.mjs'), input, output], { stdio: 'pipe' });
    const key = createHash('sha256').update(`1:${asset.provider}:${asset.id}`).digest('hex');
    const directory = join(output, key);
    const manifest = parseManifest(JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')), asset);
    if (!manifest) throw new Error('Invalid imported manifest');
    const exported = [];
    for (let index = 0; index * 30 < duration; index++) {
      const chunk = parseChunk(JSON.parse(await readFile(join(directory, `${index}.json`), 'utf8')), manifest, index);
      if (!chunk) throw new Error('Invalid imported chunk');
      exported.push(...chunk.events);
    }
    const cacheMatches = exported.length === actual.length && exported.every((event, index) =>
      event.row === 'melody' && event.time === actual[index].start && event.confidence === actual[index].amp
      && Math.abs(event.duration - Math.min(30, actual[index].end - actual[index].start)) < 1e-6);
    report.cases.push({ id, rawNotes: example.raw.length, referenceAttacks: expected.length,
      selectedAttacks: actual.length, mismatches, overlapping, clippedHolds, cacheMatches });
  }
} finally {
  if (!temporary.startsWith(temporaryRoot)) throw new Error('Unexpected temporary directory');
  await rm(temporary, { recursive: true, force: true });
}
await mkdir(dirname(resolve(reportFile)), { recursive: true });
await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.cases.some(item => item.mismatches || item.overlapping || !item.cacheMatches)) process.exitCode = 1;
