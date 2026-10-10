import { expect, it } from 'vitest';
import { activeSteps, beatBands, channelColors, effectNames, isShapeCell, momentDelay, momentDuration, momentFlashMs, nextDifferent, patternAt, pulseDelay, reshuffleEpoch, shapeNames } from './beatVisuals';

it('keeps two to four deterministic active squares per row and changes them after eight locked bars', () => {
  for (let row = 0; row < 5; row++) {
    const first = activeSteps('song', 0, row);
    expect(first).toHaveLength(8);
    expect(first.filter(Boolean).length).toBeGreaterThanOrEqual(2);
    expect(first.filter(Boolean).length).toBeLessThanOrEqual(4);
    expect(activeSteps('song', 0, row)).toEqual(first);
  }
  expect(reshuffleEpoch(15.9, 120)).toBe(0);
  expect(reshuffleEpoch(16, 120)).toBe(1);
  expect(reshuffleEpoch(19.1)).toBe(0);
  expect(reshuffleEpoch(19.2)).toBe(1);
});

it('supplies colors and shape squares for all five rows, with a long hold and complete fade', () => {
  for (const palette of ['bloom', 'ultraviolet'] as const) {
    beatBands.forEach((_, row) => expect(channelColors('pastel', palette, 'song', 0, row).hit).toBeTruthy());
  }
  for (const shape of shapeNames) expect(Array.from({ length: 8 }, (_, step) => isShapeCell(shape, 4, step)).some(Boolean)).toBe(true);
  for (const effect of effectNames) {
    const lastDelay = Math.max(...beatBands.flatMap((_, row) => Array.from({ length: 8 }, (_, step) => momentDelay(effect, row, step, 1))));
    expect(momentDuration(effect, 1)).toBeGreaterThanOrEqual(lastDelay + momentFlashMs);
  }
  expect(momentFlashMs).toBe(8000);
});

it('cycles onset styles without moving icons and keeps channel colors distinct', () => {
  expect([0, 8, 16, 24].map(patternAt)).toEqual(['pop', 'wave', 'splash', 'ripple']);
  expect(pulseDelay('wave', 4, 1)).toBe(160);
  expect(pulseDelay('ripple', 3, 1)).toBe(20);
  const hues = Array.from({ length: 5 }, (_, row) => channelColors('random', 'bloom', 'song', 0, row).hit);
  expect(new Set(hues).size).toBe(5);
  expect(nextDifferent(['heart', 'diamond', 'smile'], 'heart', .1)).not.toBe('heart');
  expect(isShapeCell('heart', 0, 1)).toBe(true);
});

it('fits symmetric heart, diamond and smile masks within four rows and eight columns', () => {
  const expected = {
    heart: ['01100110', '11111111', '01111110', '00011000'],
    diamond: ['00011000', '01111110', '01111110', '00011000'],
    smile: ['01111110', '01011010', '01000010', '00111100'],
  };
  for (const shape of shapeNames) {
    const mask = Array.from({ length: 4 }, (_, row) => Array.from({ length: 8 }, (_, step) => isShapeCell(shape, row, step, 4) ? '1' : '0').join(''));
    expect(mask).toEqual(expected[shape]);
    mask.forEach(row => expect(row).toBe([...row].reverse().join('')));
    expect(isShapeCell(shape, 4, 3, 4)).toBe(false);
    expect(isShapeCell(shape, 0, 8, 4)).toBe(false);
  }
  for (const effect of effectNames) {
    const delays = Array.from({ length: 4 }, (_, row) => Array.from({ length: 8 }, (_, step) => momentDelay(effect, row, step, 1))).flat();
    expect(momentDuration(effect, 1, 4)).toBe(momentFlashMs + Math.max(...delays) + 50);
  }
  expect(new Set(Array.from({ length: 4 }, (_, row) => channelColors('random', 'bloom', 'song', 0, row, 4).hit)).size).toBe(4);
});
