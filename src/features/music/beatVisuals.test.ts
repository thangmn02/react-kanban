import { expect, it } from 'vitest';
import { activeSteps, channelColors, isShapeCell, nextDifferent, patternAt, pulseDelay, reshuffleEpoch } from './beatVisuals';

it('keeps two to four deterministic active squares per row and changes them after eight locked bars', () => {
  for (let row = 0; row < 4; row++) {
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

it('cycles onset styles without moving icons and keeps channel colors distinct', () => {
  expect([0, 8, 16, 24].map(patternAt)).toEqual(['pop', 'wave', 'splash', 'ripple']);
  expect(pulseDelay('wave', 4, 1)).toBe(160);
  expect(pulseDelay('ripple', 3, 1)).toBe(20);
  const hues = Array.from({ length: 4 }, (_, row) => channelColors('random', 'bloom', 'song', 0, row).hit);
  expect(new Set(hues).size).toBe(4);
  expect(nextDifferent(['heart', 'diamond', 'smile'], 'heart', .1)).not.toBe('heart');
  expect(isShapeCell('heart', 0, 1)).toBe(true);
});
