import { expect, it } from 'vitest';
import { BeatDetector } from './beat-detector.js';

function spectrum(sampleRate, frequency, db = -20) {
  const array = new Float32Array(1024).fill(-100);
  if (frequency) array[Math.round(frequency * 2048 / sampleRate)] = db;
  return array;
}
function transient(rate, hz) {
  const data = spectrum(rate, hz);
  if (hz >= 1500) {
    const from = hz < 6000 ? 1500 : 6000, to = hz < 6000 ? 5000 : 12000;
    for (let bin = Math.ceil(from * 2048 / rate); bin <= Math.floor(to * 2048 / rate); bin++) data[bin] = -30;
  }
  return data;
}
it('does not label harmonic bass plucks or tonal mid/high attacks as percussion', () => {
  const detector = new BeatDetector(44100), drums = [];
  for (let frame = 0; frame < 240; frame++) {
    const data = spectrum(44100), age = frame % 60;
    if (frame >= 60 && age < 36) {
      for (const [hz, db] of [[90, -20], [180, -24], [270, -27], [360, -30], [3000, -35], [9000, -38]]) {
        data[Math.round(hz * 2048 / 44100)] = db - age * .3;
      }
    }
    drums.push(...detector.analyze(data, frame * 1000 / 60).hits.filter(h => h !== 'bass'));
  }
  expect(drums).toEqual([]);
});
it.each([44100, 48000])('detects transients across all bands at %i Hz with a 120ms refractory', (rate) => {
  for (const [hz, band] of [[90, 'kick'], [3000, 'clap'], [9000, 'hat'], [200, 'bass']]) {
    const detector = new BeatDetector(rate);
    for (let time = 0; time < 700; time += 1000 / 60) detector.analyze(spectrum(rate), time);
    expect(detector.analyze(transient(rate, hz), 700).hits).toContain(band);
    detector.analyze(spectrum(rate), 730);
    expect(detector.analyze(transient(rate, hz), 760).hits).not.toContain(band);
    detector.analyze(spectrum(rate), 790);
    expect(detector.analyze(transient(rate, hz), 820).hits).toContain(band);
  }
});
it('allows independent simultaneous kick and bass evidence without sharing FFT bins', () => {
  const detector = new BeatDetector(44100), kick = detector.bands.find(b => b.name === 'kick'), bass = detector.bands.find(b => b.name === 'bass');
  expect(kick.last).toBeLessThan(bass.first);
  for (let time = 0; time < 700; time += 1000 / 60) detector.analyze(spectrum(44100), time);
  const data = spectrum(44100, 200, -25);
  for (let bin = kick.first; bin <= kick.last; bin++) data[bin] = -20;
  expect(detector.analyze(data, 700).hits).toEqual(['kick', 'bass']);
});
it('does not create a kick from broadband high-frequency noise or keep percussion context through silence', () => {
  const detector = new BeatDetector(44100);
  for (let time = 0; time < 700; time += 1000 / 60) detector.analyze(spectrum(44100), time);
  const noise = transient(44100, 9000);
  expect(detector.analyze(noise, 700).hits).toEqual(['hat']);
  for (let time = 720; time < 1100; time += 1000 / 60) detector.analyze(spectrum(44100), time);
  const tone = spectrum(44100, 90);
  for (const [hz, db] of [[180, -24], [270, -27], [360, -30]]) tone[Math.round(hz * 2048 / 44100)] = db;
  expect(detector.analyze(tone, 1100).hits).toEqual(['bass']);
});
it('rejects narrow-band tremolo and neighbouring-bin vibrato without disabling audibility', () => {
  const detector = new BeatDetector(48000), drums = [];
  for (let frame = 0; frame < 300; frame++) {
    const data = spectrum(48000, frame % 4 < 2 ? 3000 : 3023.4375, -30 + 10 * Math.sin(frame / 2));
    const result = detector.analyze(data, frame * 1000 / 60);
    drums.push(...result.hits); expect(result.audible).toBe(true);
  }
  expect(drums).toEqual([]);
});
it('raises only a busy band threshold and returns to baseline after two quiet seconds', () => {
  const rate = 48000;
  const detector = new BeatDetector(rate);
  for (let time = 0; time < 700; time += 1000 / 60) detector.analyze(spectrum(rate), time);
  for (let time = 700; time <= 2200; time += 200) {
    detector.analyze(spectrum(rate), time - 16);
    detector.analyze(spectrum(rate, 90), time);
  }
  const kick = detector.bands.find((band) => band.name === 'kick');
  const clap = detector.bands.find((band) => band.name === 'clap');
  expect(kick.onsetRate).toBeGreaterThan(3);
  expect(kick.threshold).toBeGreaterThan(detector.ratio);
  expect(clap.threshold).toBe(detector.ratio);
  for (let time = 2400; time <= 4600; time += 100) detector.analyze(spectrum(rate), time);
  expect(kick.onsetRate).toBe(0);
  expect(kick.threshold).toBe(detector.ratio);
});
it('does not invent onsets from silence or sustained tones', () => {
  for (const hz of [0, 100, 700, 3000, 9000]) {
    const detector = new BeatDetector(48000);
    const hits = [];
    for (let time = 0; time < 5000; time += 1000 / 60) hits.push(...detector.analyze(spectrum(48000, hz), time).hits);
    expect(hits).toEqual([]);
  }
});
