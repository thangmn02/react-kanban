import { expect, it } from 'vitest';
import { BeatDetector } from './beat-detector.js';

function spectrum(sampleRate, frequency, db = -20) {
  const array = new Float32Array(1024).fill(-100);
  if (frequency) array[Math.round(frequency * 2048 / sampleRate)] = db;
  return array;
}
it.each([44100, 48000])('detects transients across all bands at %i Hz with a 120ms refractory', (rate) => {
  for (const [hz, band] of [[90, 'kick'], [3000, 'clap'], [9000, 'hat'], [200, 'bass']]) {
    const detector = new BeatDetector(rate);
    for (let time = 0; time < 700; time += 1000 / 60) detector.analyze(spectrum(rate), time);
    expect(detector.analyze(spectrum(rate, hz), 700).hits).toContain(band);
    detector.analyze(spectrum(rate), 730);
    expect(detector.analyze(spectrum(rate, hz), 760).hits).not.toContain(band);
    detector.analyze(spectrum(rate), 790);
    expect(detector.analyze(spectrum(rate, hz), 820).hits).toContain(band);
  }
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
