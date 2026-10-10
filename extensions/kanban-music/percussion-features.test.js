import { expect, it } from 'vitest';
import FFT from 'fft.js';
import { PercussionFeatures } from './percussion-features.js';
const config = { fftSize: 2048, sampleRate: 44100, hopSize: 441, stepFrames: 10, bins: 1,
  filterbank: [{ first: 80, weights: [1] }] };
it('matches an independent FFT on a full causal window without magnitude/gain normalization', () => {
  const f = new PercussionFeatures(config), input = Float32Array.from({ length: 2048 }, (_, i) =>
    .2 * Math.sin(2 * Math.PI * 80 * i / 2048) + .1 * Math.cos(2 * Math.PI * 23 * i / 2048));
  f.samples.set(input); f.spectrum();
  const fft = new FFT(2048), spectrum = fft.createComplexArray();
  fft.realTransform(spectrum, Float32Array.from(input, (v,i) => v*f.window[i]));
  const expected = Math.log10(1 + Math.hypot(spectrum[160], spectrum[161]));
  expect(f.data[0]).toBeCloseTo(expected, 6);
});
it('retains exact media-relative feature timestamps across variable worklet block sizes and bounds storage', () => {
  const f = new PercussionFeatures(config), blocks = [];
  for (let at = 0; at < 44100; at += 128) f.push([new Float32Array(Math.min(128,44100-at))], 5 + at/44100, b => blocks.push(b));
  const times = blocks.flatMap(b => b.times);
  times.forEach((time,i) => expect(time).toBeCloseTo(5+i/100, 10));
  expect(blocks).toHaveLength(9); expect(blocks.every(b => b.data.every(v => v === 0))).toBe(true);
  expect(f.samples.length).toBe(2048); expect(f.times.length).toBeLessThan(10);
});
it('halves batching delay without shifting feature timestamps or changing the trained features', () => {
  const collect = stepFrames => {
    const f = new PercussionFeatures({ ...config, stepFrames, diagnostics: true }), blocks = [];
    for (let at = 0; at < 44100; at += 128) f.push([new Float32Array(Math.min(128, 44100-at))], 5+at/44100, b => blocks.push(b));
    return blocks;
  };
  const before = collect(10), after = collect(5);
  expect(after.flatMap(b => b.times).slice(0, 90)).toEqual(before.flatMap(b => b.times));
  expect(after.flatMap(b => [...b.data]).slice(0, 90)).toEqual(before.flatMap(b => [...b.data]));
  expect(before[0].availableAudioTime - after[0].availableAudioTime).toBeCloseTo(.05, 10);
});
