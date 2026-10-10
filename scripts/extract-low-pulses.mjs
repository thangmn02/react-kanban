import { readFile, writeFile } from 'node:fs/promises';
import { BeatDetector } from '../extensions/kanban-music/beat-detector.js';

const [input, output, offset = '0'] = process.argv.slice(2);
if (!input || !output || !Number.isFinite(Number(offset))) throw new Error('Expected spectrum file, output and offset');
const bytes = await readFile(input);
if (bytes.length % (1024 * 4)) throw new Error('Invalid spectrum frames');
const detector = new BeatDetector(44100);
const events = [];
const spectrum = new Float32Array(1024);
let sustained;
for (let index = 0; index < bytes.length / 4096; index++) {
  for (let bin = 0; bin < 1024; bin++) spectrum[bin] = bytes.readFloatLE(index * 4096 + bin * 4);
  const result = detector.analyze(spectrum, index * 1000 / 60);
  const low = detector.bands.find(band => band.name === 'bass');
  if (sustained && (low.previous <= sustained.baseline || index / 60 - sustained.start >= 2 || result.hits.includes('bass'))) {
    sustained.event.duration = Math.max(1 / 60, index / 60 - sustained.start);
    sustained = undefined;
  }
  if (result.hits.includes('bass')) {
    const event = { row: 'bass', time: Number(offset) + index / 60, confidence: .5, duration: 1 / 60 };
    events.push(event);
    sustained = { event, start: index / 60, baseline: Math.max(detector.floor, low.average) };
  }
}
if (sustained) sustained.event.duration = Math.min(2, bytes.length / 4096 / 60 - sustained.start);
await writeFile(output, JSON.stringify(events));
