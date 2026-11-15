import { describe, expect, it } from 'vitest';
import {
  clampOklch, contrastRatio, dockSurface, hueBins, hueDistance, huePeaks, maxChroma, MIN_ROW_HUE_GAP, oklchToRgb, phraseAnchor,
  phraseIndex, rampFromHue, rgbToOklab, rowHues, videoRowColours, type Rgb,
} from './video-palette';

const parse = (css: string): Rgb => css.match(/\d+/g)!.slice(0, 3).map(Number) as Rgb;
const lch = (rgb: Rgb) => { const [L, a, b] = rgbToOklab(rgb); return { L, C: Math.hypot(a, b), h: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 }; };
const image = (colours: Array<[Rgb, number]>) => colours.flatMap(([rgb, count]) => Array.from({ length: count }, () => [...rgb, 255])).flat();

describe('hue from images', () => {
  it('finds the vivid colour in a dark video frame instead of the shadows', () => {
    const frame = image([[[20, 18, 22], 180], [[150, 120, 100], 50], [[255, 40, 150], 26]]);
    const peaks = huePeaks(hueBins(frame));
    expect(peaks.length).toBeGreaterThan(0);
    expect(hueDistance(peaks[0], lch([255, 40, 150]).h)).toBeLessThan(10);
  });
  it('returns no hue for black and white or grey images, so the default palette is used', () => {
    expect(huePeaks(hueBins(image([[[0, 0, 0], 128], [[255, 255, 255], 64], [[128, 128, 128], 64]])))).toEqual([]);
    expect(huePeaks(new Array(36).fill(0))).toEqual([]);
    expect(huePeaks([1, 2])).toEqual([]);
  });
  it('keeps distinct hues apart and strongest first', () => {
    const peaks = huePeaks(hueBins(image([[[30, 90, 255], 150], [[255, 140, 0], 80], [[30, 100, 250], 26]])));
    expect(peaks).toHaveLength(2);
    expect(hueDistance(peaks[0], lch([30, 90, 255]).h)).toBeLessThan(10);
  });
});

describe('ramps', () => {
  it('clamps into sRGB by lowering chroma only', () => {
    const clamped = clampOklch({ L: 0.8, C: 0.4, h: 265 });
    expect(clamped.L).toBe(0.8);
    expect(clamped.C).toBeLessThan(0.4);
    expect(clamped.C).toBeCloseTo(maxChroma(0.8, 265), 5);
  });
  it('gives the same colours for the same hue', () => {
    expect(rampFromHue(330, 'light')).toEqual(rampFromHue(330, 'light'));
    expect(rampFromHue(330, 'light')).not.toEqual(rampFromHue(330, 'dark'));
  });
  it.each(['light', 'dark'] as const)('is vivid, never white, and the hit reads at 3:1 on the %s Dock for every hue', appearance => {
    for (let hue = 0; hue < 360; hue += 5) {
      const ramp = rampFromHue(hue, appearance), mid = parse(ramp.mid), bright = lch(parse(ramp.bright));
      expect(contrastRatio(mid, dockSurface[appearance])).toBeGreaterThanOrEqual(3);
      // Cyan cannot hold .12 chroma at a lightness that keeps 3:1 on the light Dock; it stays clearly coloured.
      expect(lch(mid).C).toBeGreaterThanOrEqual(0.1);
      expect(bright.L).toBeLessThanOrEqual(0.825);
      expect(bright.C).toBeGreaterThanOrEqual(0.115);
    }
  });
});

describe('rows', () => {
  it('keeps every pair of rows at least 28 degrees apart for any anchor', () => {
    for (let anchor = 0; anchor < 360; anchor += 7) {
      const hues = Object.values(rowHues(anchor));
      for (let i = 0; i < hues.length; i++) for (let j = i + 1; j < hues.length; j++) expect(hueDistance(hues[i], hues[j])).toBeGreaterThanOrEqual(MIN_ROW_HUE_GAP);
    }
  });
  it('colours the hi-hat with a second video hue only when it stays clear of the other rows', () => {
    expect(rowHues(200, 40).hat).toBe(40);
    expect(rowHues(200, 205).hat).not.toBe(205);
  });
  it('makes four visibly different, coloured rows for a lavender video (the "Mỹ Miều" case)', () => {
    const rows = videoRowColours(lch([190, 170, 235]).h, 'light');
    const mids = (['kick', 'clap', 'hat', 'bass'] as const).map(band => lch(parse(rows[band].mid)));
    for (let i = 0; i < mids.length; i++) for (let j = i + 1; j < mids.length; j++) expect(hueDistance(mids[i].h, mids[j].h)).toBeGreaterThanOrEqual(MIN_ROW_HUE_GAP - 3);
    expect(lch(parse(rows.hat.mid)).C).toBeGreaterThan(0.12);
  });
  it('converts back to the requested hue', () => {
    expect(hueDistance(lch(oklchToRgb({ L: 0.62, C: 0.15, h: 140 })).h, 140)).toBeLessThan(2);
  });
});

describe('phrases', () => {
  it('changes the anchor only every 16 bars, or 8 at a slow tempo', () => {
    expect([0, 1, 2, 3].map(epoch => phraseIndex(epoch, 120))).toEqual([0, 0, 1, 1]);
    expect([0, 1, 2].map(epoch => phraseIndex(epoch, 80))).toEqual([0, 1, 2]);
    expect(phraseAnchor([10, 200], 3)).toBe(200);
    expect(phraseAnchor([], 3)).toBeUndefined();
  });
});
