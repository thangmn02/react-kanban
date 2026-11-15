import { expect, it } from 'vitest';
import { contrastRatio, hslToRgb, trackAccentDeepRgb, trackAccentVariables } from './track-accent';

it('keeps white text readable on the panel background for every hue', () => {
  for (let hue = 0; hue < 360; hue += 10) for (const saturation of [0, 35, 60, 100])
    expect(contrastRatio([255, 255, 255], trackAccentDeepRgb({ hue, saturation })), `${hue}/${saturation}`).toBeGreaterThanOrEqual(7);
});

it('exposes the panel background as a dock custom property', () => {
  expect(Object.keys(trackAccentVariables({ hue: 215, saturation: 70 }))).toEqual(['--track-accent-face']);
  expect(hslToRgb(0, 100, 50)).toEqual([255, 0, 0]);
});
