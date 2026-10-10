// Private offline comparison only; no EventTrack publication or client imports.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deterministicLeadSelector, selectLeadNotes } from '../server/lead-note-selection.ts';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Expected private analyzed candidates and output path');
const value = JSON.parse(await readFile(input, 'utf8'));
// Freeze A to the previously accepted instrumental-only baseline, even when
// newer analysis exports include additional vocal candidates.
const candidates = value.candidates.filter(candidate => ['piano', 'guitar', 'other'].includes(candidate.source));
const decision = deterministicLeadSelector.select(candidates);
const selected = candidates.find(candidate => candidate.source === decision.source);
const notes = selected ? selectLeadNotes(selected.notes, .28, selected.source === 'other') : [];
const events = notes.map((note, index) => ({
  eventId: createHash('sha256').update(`accepted-lead:${value.asset.provider}:${value.asset.id}:${index}:${note.start}`).digest('hex'),
  type: 'melody', playbackTime: note.start, duration: note.end - note.start,
  confidence: note.amp, source: 'server-cache',
}));
await writeFile(output, JSON.stringify({ decision, events }));
