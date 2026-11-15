/**
 * Beat flash colours sampled from a track's cover art or video thumbnail.
 * Every row colour is a cluster of pixels actually present in the image; only
 * an image with too few distinct colours is filled out with lightness and
 * chroma variations of its own sampled colours.
 * Presentation only: nothing here reads or changes beat detection or timing.
 */
import { contrastRatio, dockSurfaceRgb, type AccentAppearance } from './track-accent';

export type Rgb = [number, number, number];
type Lab = [number, number, number];
export const paletteRows = ['kick', 'clap', 'hat', 'bass', 'melody'] as const;
export type PaletteRow = typeof paletteRows[number];
/** Raw sampled colours per instrument row, before any contrast adjustment. */
export type TrackPalette = Record<PaletteRow, Rgb> & { /** True when the image held a single hue (or none) and rows are variations of it. */ monochrome: boolean };

const linear = (value: number) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const gamma = (value: number) => Math.round(255 * Math.max(0, Math.min(1, value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055)));
export function rgbToOklab([red, green, blue]: Rgb): Lab {
  const r = linear(red), g = linear(green), b = linear(blue);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklabToLinear([L, a, b]: Lab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
/** Back to sRGB, lowering chroma (never hue) until the colour fits the gamut. */
export function oklabToRgb(lab: Lab): Rgb {
  let [L, a, b] = lab;
  for (let step = 0; step < 24; step++) {
    const rgb = oklabToLinear([L, a, b]);
    if (rgb.every(channel => channel >= -0.0005 && channel <= 1.0005)) break;
    a *= 0.92; b *= 0.92;
  }
  L = Math.max(0, Math.min(1, L));
  const [r, g, bl] = oklabToLinear([L, a, b]);
  return [gamma(r), gamma(g), gamma(bl)];
}
const chroma = (lab: Lab) => Math.hypot(lab[1], lab[2]);
/** Perceptual distance (ΔE in OKLab). */
export const deltaE = (x: Lab, y: Lab) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);

interface Cluster { lab: Lab; weight: number }
const MERGE = 0.07, DISTINCT = 0.09;
function cluster(pixels: Lab[]): Cluster[] {
  // Coarse bins first, then merge neighbouring bins, most populated first.
  const bins = new Map<string, { sum: Lab; weight: number }>();
  for (const lab of pixels) {
    const key = `${Math.round(lab[0] / 0.08)},${Math.round(lab[1] / 0.04)},${Math.round(lab[2] / 0.04)}`, bin = bins.get(key);
    if (bin) { bin.sum[0] += lab[0]; bin.sum[1] += lab[1]; bin.sum[2] += lab[2]; bin.weight++; }
    else bins.set(key, { sum: [lab[0], lab[1], lab[2]], weight: 1 });
  }
  const clusters: { sum: Lab; weight: number }[] = [];
  for (const bin of [...bins.values()].sort((x, y) => y.weight - x.weight)) {
    const mean: Lab = [bin.sum[0] / bin.weight, bin.sum[1] / bin.weight, bin.sum[2] / bin.weight];
    const near = clusters.find(candidate => deltaE([candidate.sum[0] / candidate.weight, candidate.sum[1] / candidate.weight, candidate.sum[2] / candidate.weight], mean) < MERGE);
    if (near) { near.sum[0] += bin.sum[0]; near.sum[1] += bin.sum[1]; near.sum[2] += bin.sum[2]; near.weight += bin.weight; }
    else clusters.push({ sum: [...bin.sum] as Lab, weight: bin.weight });
  }
  return clusters.map(entry => ({ lab: [entry.sum[0] / entry.weight, entry.sum[1] / entry.weight, entry.sum[2] / entry.weight] as Lab, weight: entry.weight })).sort((x, y) => y.weight - x.weight);
}

/**
 * Five row colours from RGBA pixel data (a 16×16 sample is enough), or null
 * when the image has no opaque pixels.
 */
export function paletteFromPixels(data: ArrayLike<number>): TrackPalette | null {
  const opaque: Lab[] = [];
  for (let index = 0; index + 3 < data.length; index += 4) if (data[index + 3] >= 128) opaque.push(rgbToOklab([data[index], data[index + 1], data[index + 2]]));
  if (!opaque.length) return null;
  // Near-black and muddy grey say nothing about the artwork, unless that is all there is.
  const vivid = opaque.filter(lab => lab[0] >= 0.15 && chroma(lab) >= 0.04);
  const colourless = vivid.length < opaque.length * 0.05;
  const pool = colourless ? opaque : vivid, floor = Math.max(2, pool.length * 0.01);
  // The most common colour first; then, each time, the cluster that is both well populated and far (ΔE) from
  // every colour already chosen, so shades of one gradient do not crowd out a smaller, different accent.
  const clusters = cluster(pool), candidates = clusters.filter(entry => entry.weight >= floor), picked: Cluster[] = [clusters[0]];
  while (picked.length < paletteRows.length) {
    let best: Cluster | undefined, bestScore = 0;
    for (const candidate of candidates) {
      const distance = Math.min(...picked.map(chosen => deltaE(chosen.lab, candidate.lab)));
      if (distance < DISTINCT) continue;
      const score = Math.sqrt(candidate.weight) * distance;
      if (score > bestScore) { best = candidate; bestScore = score; }
    }
    if (!best) break;
    picked.push(best);
  }
  const sampled = picked.length;
  // Too few distinct colours: vary lightness and chroma of the colours that were sampled, keeping their hue.
  for (let round = 1; picked.length < paletteRows.length && round <= 12; round++) {
    const source = picked[(picked.length - sampled) % sampled].lab, direction = round % 2 ? 1 : -1, amount = 0.13 * Math.ceil(round / 2);
    const lightness = Math.max(0.2, Math.min(0.92, source[0] + direction * amount)), scale = direction > 0 ? 0.8 : 1;
    const variant: Lab = [lightness, source[1] * scale, source[2] * scale];
    if (picked.every(chosen => deltaE(chosen.lab, variant) >= DISTINCT * 0.6)) picked.push({ lab: variant, weight: 0 });
  }
  while (picked.length < paletteRows.length) picked.push({ lab: [0.3 + 0.12 * picked.length, picked[0].lab[1], picked[0].lab[2]], weight: 0 });

  const rest = [...picked], take = (score: (entry: Cluster) => number) => rest.splice(rest.reduce((best, entry, index) => score(entry) > score(rest[best]) ? index : best, 0), 1)[0].lab;
  const mean = picked.reduce((sum, entry) => sum + entry.lab[0], 0) / picked.length;
  const kick = take(entry => entry.weight);                                          // the dominant colour of the image
  const clap = take(entry => chroma(entry.lab) * 2 + Math.abs(entry.lab[0] - mean)); // its strongest accent
  const hat = take(entry => entry.lab[0]);                                           // the lightest
  const bass = take(entry => -entry.lab[0]);                                         // the deepest that is left
  const melody = rest[0].lab;                                                        // the remaining mid-tone
  const hues = picked.slice(0, sampled).filter(entry => chroma(entry.lab) >= 0.04).map(entry => Math.atan2(entry.lab[2], entry.lab[1]));
  const spread = hues.length ? Math.max(...hues.map(hue => Math.abs(Math.atan2(Math.sin(hue - hues[0]), Math.cos(hue - hues[0]))))) : 0;
  return { kick: oklabToRgb(kick), clap: oklabToRgb(clap), hat: oklabToRgb(hat), bass: oklabToRgb(bass), melody: oklabToRgb(melody), monochrome: colourless || spread < 0.35 };
}

/** The row's flash colour: the sampled colour, moved in lightness only as far as needed to stay visible on the dock. */
export function flashColour(palette: TrackPalette, row: PaletteRow, appearance: AccentAppearance): Rgb {
  const surface = dockSurfaceRgb(appearance), lab = rgbToOklab(palette[row]), step = appearance === 'dark' ? 0.02 : -0.02;
  // Hi-hats need a crisp, light flash; on the light dock that is limited by contrast with the surface.
  if (row === 'hat' && appearance === 'dark') lab[0] = Math.max(lab[0], 0.82);
  let colour = oklabToRgb(lab);
  for (let guard = 0; guard < 50 && contrastRatio(colour, surface) < 3; guard++) { lab[0] += step; colour = oklabToRgb(lab); }
  return colour;
}

/** The shades one row's flash is drawn with, all in the hue of its sampled colour. */
export function flashShades(palette: TrackPalette, row: PaletteRow, appearance: AccentAppearance) {
  const mid = flashColour(palette, row, appearance), [L, a, b] = rgbToOklab(mid);
  return { mid, deep: oklabToRgb([Math.max(0.16, L - 0.24), a * 0.9, b * 0.9]), bright: oklabToRgb([Math.min(0.93, L + 0.17), a * 0.7, b * 0.7]), hot: oklabToRgb([0.975, a * 0.12, b * 0.12]) };
}
/**
 * CSS custom properties for the Beat Grid rows. Set on the dock; each row maps
 * its own set onto the grid's flash variables (--c-deep, --c-mid, --c-bright, --c-hot, --c-glow).
 */
export function trackPaletteVariables(palette: TrackPalette, appearance: AccentAppearance): Record<string, string> {
  const rgb = (colour: Rgb) => `rgb(${colour.join(' ')})`;
  return Object.fromEntries(paletteRows.flatMap(row => {
    const shades = flashShades(palette, row, appearance);
    return [[`--track-flash-${row}`, rgb(shades.mid)], [`--track-flash-${row}-deep`, rgb(shades.deep)], [`--track-flash-${row}-bright`, rgb(shades.bright)],
      [`--track-flash-${row}-hot`, rgb(shades.hot)], [`--track-flash-${row}-glow`, `rgb(${shades.mid.join(' ')} / .75)`]];
  }));
}

/** Hue and saturation of an sRGB colour, for the music panel background. */
export function rgbToHueSaturation([red, green, blue]: Rgb): { hue: number; saturation: number } {
  const r = red / 255, g = green / 255, b = blue / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min, lightness = (max + min) / 2;
  if (!delta) return { hue: 0, saturation: 0 };
  const hue = (max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60;
  return { hue: Math.round((hue + 360) % 360), saturation: Math.round(delta / (1 - Math.abs(2 * lightness - 1)) * 100) };
}
