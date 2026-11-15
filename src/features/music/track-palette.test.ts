import { expect, it } from 'vitest';
import { contrastRatio, dockSurfaceRgb } from './track-accent';
import { deltaE, flashColour, paletteFromPixels, paletteRows, rgbToHueSaturation, rgbToOklab, trackPaletteVariables, type Rgb } from './track-palette';

/** A 16×16 image from colour shares, e.g. [[blue, 0.6], [pink, 0.2]]. */
const image = (...parts: [Rgb, number][]) => parts.flatMap(([colour, share]) => Array.from({ length: Math.round(256 * share) }, () => [...colour, 255])).flat();
const hue = (colour: Rgb) => rgbToHueSaturation(colour).hue;
const near = (value: number, target: number, tolerance = 25) => Math.abs(((value - target + 540) % 360) - 180) <= tolerance;
const NIGHT_SKY: Rgb = [22, 40, 120], NEON_PINK: Rgb = [255, 45, 160], CITY_YELLOW: Rgb = [250, 215, 40], BLACK: Rgb = [4, 4, 6];

it('extracts the colours that are in the image, not shifts of one average', () => {
  const palette = paletteFromPixels(image([NIGHT_SKY, 0.6], [NEON_PINK, 0.15], [CITY_YELLOW, 0.1], [BLACK, 0.15]))!;
  const hues = paletteRows.map(row => hue(palette[row]));
  expect(near(hue(palette.kick), hue(NIGHT_SKY))).toBe(true);           // the dominant colour
  expect(hues.some(value => near(value, hue(NEON_PINK)))).toBe(true);   // a small accent still gets a row
  expect(hues.some(value => near(value, hue(CITY_YELLOW)))).toBe(true);
  expect(palette.monochrome).toBe(false);
  // The sampled colours themselves are used: each of the three sits within a small ΔE of a row.
  for (const source of [NIGHT_SKY, NEON_PINK, CITY_YELLOW])
    expect(Math.min(...paletteRows.map(row => deltaE(rgbToOklab(palette[row]), rgbToOklab(source))))).toBeLessThan(0.03);
});

it('gives the lightest sampled colour to the hi-hat and a deeper one to the bass', () => {
  const palette = paletteFromPixels(image([[30, 60, 160], 0.3], [[240, 235, 120], 0.2], [[200, 40, 60], 0.2], [[40, 120, 70], 0.15], [[120, 60, 150], 0.15]))!;
  const lightness = (row: typeof paletteRows[number]) => rgbToOklab(palette[row])[0];
  expect(lightness('hat')).toBeGreaterThan(lightness('bass'));
  expect(lightness('hat')).toBeGreaterThan(lightness('melody'));
});

it('varies lightness and chroma of the one sampled hue for a single-colour image', () => {
  const palette = paletteFromPixels(image([[200, 30, 40], 1]))!;
  expect(palette.monochrome).toBe(true);
  for (const row of paletteRows) expect(near(hue(palette[row]), hue([200, 30, 40]), 12), row).toBe(true);
  expect(new Set(paletteRows.map(row => palette[row].join())).size).toBe(paletteRows.length);
});

it('keeps a greyscale image grey', () => {
  const palette = paletteFromPixels(image([[30, 30, 30], 0.5], [[128, 128, 128], 0.3], [[230, 230, 230], 0.2]))!;
  expect(palette.monochrome).toBe(true);
  for (const row of paletteRows) expect(rgbToHueSaturation(palette[row]).saturation, row).toBeLessThan(12);
});

it('returns null without opaque pixels', () => {
  expect(paletteFromPixels([])).toBeNull();
  expect(paletteFromPixels([255, 0, 0, 0, 0, 255, 0, 10])).toBeNull();
});

it('keeps every row visible on the dock in light and dark, changing lightness only', () => {
  const palettes = [image([NIGHT_SKY, 0.6], [NEON_PINK, 0.15], [CITY_YELLOW, 0.1], [BLACK, 0.15]), image([[200, 30, 40], 1]), image([[250, 250, 245], 0.7], [[20, 20, 25], 0.3])].map(data => paletteFromPixels(data)!);
  for (const palette of palettes) for (const appearance of ['light', 'dark'] as const) {
    for (const row of paletteRows) expect(contrastRatio(flashColour(palette, row, appearance), dockSurfaceRgb(appearance)), `${row}/${appearance}`).toBeGreaterThanOrEqual(3);
    expect(Object.keys(trackPaletteVariables(palette, appearance))).toEqual(paletteRows.flatMap(row => ['', '-deep', '-bright', '-hot', '-glow'].map(shade => `--track-flash-${row}${shade}`)));
  }
  // The pink accent is still pink after the contrast pass.
  const pinkRow = paletteRows.find(row => near(hue(palettes[0][row]), hue(NEON_PINK)))!;
  expect(near(hue(flashColour(palettes[0], pinkRow, 'light')), hue(NEON_PINK))).toBe(true);
});
