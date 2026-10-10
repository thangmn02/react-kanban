// Validate actual generated private files with the unchanged EventTrack parser.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseManifest, parseChunk } from '../src/features/music/event-track.ts';

const directory = 'src-tauri/target/generalized-melody';
const report = JSON.parse(await readFile(`${directory}/melodia-report.json`, 'utf8'));
const results = [];
for (const id of report.selected) {
  const caseData = report.cases.find(c => c.id === id);
  const analysis = JSON.parse(await readFile(`${directory}/${id}/melodia/analysis.json`, 'utf8'));
  const exported = JSON.parse(await readFile(`${directory}/${id}/melodia/event-track.json`, 'utf8'));
  const audioHash = createHash('sha256').update(await readFile(`${directory}/${id}/original.wav`)).digest('hex');
  if (audioHash !== analysis.audioSha256 || audioHash !== caseData.audioSha256) throw new Error(`${id}: wrong audio`);
  const manifest = parseManifest(exported.manifest, exported.manifest.asset, analysis.duration);
  if (!manifest) throw new Error(`${id}: invalid manifest`);
  const chunks = exported.chunks.map((chunk, index) => parseChunk(chunk, manifest, index));
  if (chunks.some(chunk => !chunk)) throw new Error(`${id}: invalid chunk`);
  const events = chunks.flatMap(chunk => chunk.events);
  if (events.length !== analysis.notes.length || events.some((e, i) => e.row !== 'melody' || e.time !== analysis.notes[i].start)) throw new Error(`${id}: onset conversion`);
  for (const note of analysis.notes) {
    const frames = analysis.frames.slice(Math.round(note.start/analysis.frameStepSeconds), Math.round(note.end/analysis.frameStepSeconds));
    if (!frames.length || frames.some(f => !f.voiced || f.hz <= 0 || f.pitchConfidence <= 0)) throw new Error(`${id}: note crosses rest`);
  }
  results.push({ id, notes: events.length, rawSegments: analysis.rawSegmentation.length, omissions: analysis.omittedSegments.length,
    rests: analysis.rests.length, restSeconds: analysis.rests.reduce((s, r) => s+r.end-r.start, 0),
    shortestNote: Math.min(...analysis.notes.map(n => n.end-n.start)),
    shortNotesBelow100ms: analysis.notes.filter(n => n.end-n.start < .1).length,
    runtime: analysis.runtime, audioSha256: audioHash });
}
await writeFile(`${directory}/melodia-contract-check.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
