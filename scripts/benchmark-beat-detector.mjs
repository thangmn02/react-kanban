import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import FFT from 'fft.js';
import { BeatDetector } from '../extensions/kanban-music/beat-detector.js';

// Local recordings stay outside the repository. These excerpts match the saved
// research corpus; event counts measure activity, not perceptual accuracy.
const cases = [['One More Time', 120], ['Voodoo People', 90], ['Levels', 80], ['Redbone', 200],
  ['XO Tour', 50], ['H.S.K.T', 130], ['Hysteria', 60], ['Yellow', 145], ['Brubeck', 60],
  ['Weightless', 60], ['Gymnop', 30], ['Luv(sic)', 60]];
const [directory, output, baseline = '819a627', referenceFile] = process.argv.slice(2);
if (!directory || !output) throw new Error('Usage: node scripts/benchmark-beat-detector.mjs <audio-directory> <report.json> [baseline-ref]');
const original = execFileSync('git', ['show', `${baseline}:extensions/kanban-music/beat-detector.js`], { encoding: 'utf8' });
const { BeatDetector: BaselineDetector } = await import(`data:text/javascript;base64,${Buffer.from(original).toString('base64')}`);
const normalize = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const files = await readdir(directory), rate = 44100, size = 2048;
const corpus = referenceFile ? JSON.parse(await readFile(referenceFile, 'utf8')) : cases.map(([track, start]) => {
  const name = files.find(name => normalize(name).includes(normalize(track)) && /\.mp3$/i.test(name));
  return { track, start, file: name && resolve(directory, name) };
});
const agreement = (detected, reference) => {
  const used = new Set(), errors = [];
  for (const time of detected) {
    let nearest = -1, distance = .080001;
    reference.forEach((expected, index) => {
      if (!used.has(index) && Math.abs(time - expected) < distance) { nearest = index; distance = Math.abs(time - expected); }
    });
    if (nearest >= 0) { used.add(nearest); errors.push((time - reference[nearest]) * 1000); }
  }
  return { detected: detected.length, reference: reference.length, matched: used.size,
    precision: detected.length ? used.size / detected.length : null,
    recall: reference.length ? used.size / reference.length : null,
    medianOffsetMs: errors.length ? errors.sort((a, b) => a - b)[Math.floor(errors.length / 2)] : null };
};
const fft = new FFT(size), input = new Float64Array(size), transformed = fft.createComplexArray();
const window = Float64Array.from({ length: size }, (_, i) => .42 - .5 * Math.cos(2 * Math.PI * i / size) + .08 * Math.cos(4 * Math.PI * i / size));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { baseline, sampleRate: rate, samplingHz: 60, fftSize: size,
  interpretation: referenceFile ? 'Agreement with saved ADTOF model outputs at 80ms tolerance after 400ms warmup; not human ground truth. Bass has no reference.' : 'Activity counts; no manual annotation accuracy claim.', tracks: [] };
try {
  const page = await browser.newPage();
  for (const { track, start, file, reference } of corpus) {
    if (!file) { report.tracks.push({ track, unavailable: true }); continue; }
    const bytes = await readFile(file);
    const decoded = await page.evaluate(async ({ encoded, start }) => {
      const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
      const context = new OfflineAudioContext(1, 1, 44100);
      const audio = await context.decodeAudioData(bytes.buffer);
      const from = Math.floor(start * audio.sampleRate);
      const end = Math.min(audio.length, from + 30 * audio.sampleRate);
      const samples = new Float32Array(end - from);
      for (let channelIndex = 0; channelIndex < audio.numberOfChannels; channelIndex++) {
        const channel = audio.getChannelData(channelIndex);
        for (let index = 0; index < samples.length; index++) samples[index] += channel[from + index] / audio.numberOfChannels;
      }
      return Array.from(samples);
    }, { encoded: bytes.toString('base64'), start });
    const before = new BaselineDetector(rate), after = new BeatDetector(rate);
    const counts = () => ({ kick: 0, clap: 0, hat: 0, bass: 0 });
    const old = counts(), current = counts(), spectrum = new Float32Array(size / 2);
    const oldTimes = { kick: [], clap: [], hat: [] }, newTimes = { kick: [], clap: [], hat: [] };
    const began = performance.now();
    for (let frame = 0; frame < decoded.length; frame += rate / 60) {
      for (let index = 0; index < size; index++) input[index] = (decoded[Math.floor(frame) - size + index] || 0) * window[index];
      fft.realTransform(transformed, input);
      for (let index = 0; index < spectrum.length; index++) {
        spectrum[index] = 20 * Math.log10(Math.hypot(transformed[2 * index], transformed[2 * index + 1]) / size || 1e-12);
      }
      for (const row of before.analyze(spectrum, frame / rate * 1000).hits) { old[row]++; oldTimes[row]?.push(frame / rate); }
      for (const row of after.analyze(spectrum, frame / rate * 1000).hits) { current[row]++; newTimes[row]?.push(frame / rate); }
    }
    const comparison = reference && Object.fromEntries(Object.keys(oldTimes).map(row => {
      const times = reference[row].filter(time => time >= .4 && time < decoded.length / rate);
      return [row, { baseline: agreement(oldTimes[row], times), current: agreement(newTimes[row], times) }];
    }));
    report.tracks.push({ track, start, duration: decoded.length / rate, baseline: old, current, comparison, benchmarkMs: Math.round(performance.now() - began) });
    console.log(`${track}: ${JSON.stringify({ baseline: old, current })}`);
  }
} finally { await browser.close(); }
await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
