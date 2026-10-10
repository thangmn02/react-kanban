import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const directory = join(root, 'src-tauri/target/learned-percussion');
const read = async path => JSON.parse(await readFile(join(root, path)));
const learned = await read('src-tauri/target/learned-percussion/evaluation/results.json');
const raw = await read('src-tauri/target/local-dsp/raw-controls.json');
const corpus = await read('src-tauri/target/local-dsp/corpus.json');
const current = await read('src-tauri/target/local-dsp/second-candidate-evaluation.json');
const types = ['kick', 'snare', 'hat'], band = type => type === 'snare' ? 'clap' : type;
function match(reference, predicted, tolerance = .05) {
  const used = new Set(); let matched = 0;
  for (const time of reference) {
    let index = -1, distance = Infinity;
    predicted.forEach((candidate, i) => {
      if (!used.has(i) && Math.abs(candidate-time) <= tolerance && Math.abs(candidate-time) < distance) {
        index = i; distance = Math.abs(candidate-time);
      }
    });
    if (index >= 0) { used.add(index); matched++; }
  }
  return { reference: reference.length, predicted: predicted.length, matched,
    recall: reference.length ? matched/reference.length : null,
    precision: predicted.length ? matched/predicted.length : null };
}
const cases = learned.map(c => {
  const prior = raw.find(r => r.input === c.input && r.version === 'candidate');
  const old = current.find(r => r.track === c.input);
  const before = Object.fromEntries(types.map(type => [type, prior?.rows[type]?.length ?? old?.counts[band(type)] ?? null]));
  const reference = corpus.find(r => r.track === c.input);
  const confidence = Object.fromEntries(types.map(type => {
    const values = c.events.filter(e => e.type === type).map(e => e.confidence).sort((a,b) => a-b);
    return [type, values.length ? { min: values[0], median: values[Math.floor(values.length/2)], max: values.at(-1) } : null];
  }));
  const references = reference?.reference ? Object.fromEntries(types.map(type => [type,
    match(reference.reference[band(type)] || [], c.events.filter(e => e.type === type).map(e => e.time))])) : null;
  return { input: c.input, role: c.role, duration: c.duration, before, after: c.counts, confidence, references };
});
const negative = cases.filter(c => ['A','B','C','F'].includes(c.role)
  || ['mono-drum-free-intro','reported-drum-free-intro','gymnopedie','nujabes-guitar-only','hskt-other-only'].includes(c.input));
const total = (items, field) => items.reduce((sum,c) => sum + types.reduce((n,t) => n+(c[field][t] || 0),0),0);
const pairs = cases.filter(c => c.role === 'D').map(stem => {
  const mix = learned.find(c => c.input === stem.input.replace(/-D$/, '-E'));
  const drum = learned.find(c => c.input === stem.input);
  return { input: stem.input, matchedLearnedStemPeaks: Object.fromEntries(types.map(type => [type,
    match(drum.events.filter(e => e.type === type).map(e => e.time), mix.events.filter(e => e.type === type).map(e => e.time))])) };
});
const result = { cases, negative: { inputs: negative.length, before: total(negative,'before'), after: total(negative,'after'),
  reduction: 1-total(negative,'after')/total(negative,'before') }, pairs,
  referenceCaveat: 'Existing transcription references and learned stem-vs-mix agreement are not independent human ground truth. User-annotated drum-free excerpts are negative controls. Listening acceptance remains open.' };
await writeFile(join(directory, 'comparison.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ negative: result.negative, pairs }));
