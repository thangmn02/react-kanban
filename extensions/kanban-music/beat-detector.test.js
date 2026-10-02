import { expect, it } from 'vitest';
import { BeatDetector } from './beat-detector.js';

function spectrum(sampleRate, frequency, db = -20) {
  const array = new Float32Array(1024).fill(-100);
  if (frequency) array[Math.round(frequency * 2048 / sampleRate)] = db;
  return array;
}
it.each([44100, 48000])('detects transients across all bands at %i Hz with a 90ms debounce', (rate) => {
  for (const [hz, band] of [[90, 'kick'], [200, 'bass'], [3000, 'snare'], [9000, 'hat']]) {
    const detector = new BeatDetector(rate);
    for (let time = 0; time < 700; time += 1000 / 60) detector.analyze(spectrum(rate), time);
    expect(detector.analyze(spectrum(rate, hz), 700).hits).toContain(band);
    detector.analyze(spectrum(rate), 730);
    expect(detector.analyze(spectrum(rate, hz), 760).hits).not.toContain(band);
    detector.analyze(spectrum(rate), 790);
    expect(detector.analyze(spectrum(rate, hz), 820).hits).toContain(band);
  }
});
it('does not invent onsets from silence or sustained tones', () => {
  for (const hz of [0, 100, 3000, 9000]) {
    const detector = new BeatDetector(48000);
    const hits = [];
    for (let time = 0; time < 5000; time += 1000 / 60) hits.push(...detector.analyze(spectrum(48000, hz), time).hits);
    expect(hits).toEqual([]);
  }
});
