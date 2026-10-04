import { expect, it } from 'vitest';
import { MelodyDetector } from './melody-detector.js';

const tone = (rate, hz) => {
  const spectrum = new Float32Array(1024).fill(-100);
  for (const multiple of [1, 2, 3]) spectrum[Math.round(hz * multiple * 2048 / rate)] = -25 - multiple * 5;
  return spectrum;
};
it.each([44100, 48000])('holds a drumless harmonic note at %i Hz, tracks a new note, and clears on silence', (rate) => {
  const detector = new MelodyDetector(rate);
  let state;
  for (let t = 0; t <= 5000; t += 20) state = detector.analyze(tone(rate, 440), t);
  expect(state).toMatchObject({ active: true, note: 1 });
  expect(state.level).toBeGreaterThan(.15);
  for (let t = 5020; t <= 5500; t += 20) state = detector.analyze(tone(rate, 660), t);
  expect(state).toMatchObject({ active: true, note: 2 });
  for (let t = 5520; t <= 5900; t += 20) state = detector.analyze(new Float32Array(1024).fill(-Infinity), t);
  expect(state).toMatchObject({ active: false, level: 0 });
});
it('rejects silence, broadband noise, bass-only audio, and a short clap-like transient', () => {
  for (const sample of [new Float32Array(1024).fill(-Infinity), new Float32Array(1024).fill(-30), tone(48000, 60)]) {
    const detector = new MelodyDetector(48000);
    for (let t = 0; t <= 1000; t += 20) expect(detector.analyze(sample, t).active).toBe(false);
  }
  const detector = new MelodyDetector(48000);
  detector.analyze(tone(48000, 1500), 0);
  expect(detector.analyze(tone(48000, 1500), 80).active).toBe(false);
  expect(detector.analyze(new Float32Array(1024).fill(-Infinity), 160).active).toBe(false);
});
