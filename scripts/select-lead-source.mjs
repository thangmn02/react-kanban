import { readFile, writeFile } from 'node:fs/promises';
import { primaryMelodyTracker } from '../server/primary-melody-tracker.ts';
import { phraseMelodyTracker, PHRASE_MELODY_VERSION } from '../server/phrase-melody-tracker.ts';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error('Usage: node scripts/select-lead-source.mjs <candidates.json> <analysis.json>');
}

const value = JSON.parse(await readFile(input, 'utf8'));
const experimental = process.argv.slice(4).includes('--phrases');
const selected = (experimental ? phraseMelodyTracker : primaryMelodyTracker).track(value.candidates, value.duration);

await writeFile(output, JSON.stringify({
  asset: value.asset,
  duration: value.duration,
  analysisVersion: experimental ? PHRASE_MELODY_VERSION : 'server-primary-melody-v1',
  onsets: value.onsets,
  leadSource: 'primary',
  notes: selected.notes,
  primaryMelody: true,
  leadDecision: { ...selected, notes: undefined },
}));
