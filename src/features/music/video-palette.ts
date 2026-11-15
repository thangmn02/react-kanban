/**
 * Beat Grid colours from a video or its thumbnail. Only hue is taken from the image: video frames are mostly
 * shadow and skin, so their own lightness and chroma make brown-grey flashes. Lightness and chroma come from fixed
 * OKLCH ramps instead, graded in OKLCH so a yellow track and a blue track flash equally bright.
 * Presentation only: nothing here reads or changes beat detection or timing.
 */
import type { BeatBand } from './mediaBridge';

export type Rgb = [number, number, number];
export type Appearance = 'light' | 'dark';
/** A 36-bin hue histogram (10° per bin), weighted by chroma. The Companion sends the same shape from video frames. */
export type HueBins = number[];
export const HUE_BINS = 36;

const linear = (value: number) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const gamma = (value: number) => Math.round(255 * Math.max(0, Math.min(1, value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055)));
export function rgbToOklab([red, green, blue]: Rgb): [number, number, number] {
  const r = linear(red), g = linear(green), b = linear(blue);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklchToLinear(L: number, C: number, h: number): [number, number, number] {
  const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const inGamut = (rgb: number[]) => rgb.every(channel => channel >= -0.0001 && channel <= 1.0001);
/** The most chroma this hue and lightness can hold inside sRGB. */
export function maxChroma(L: number, h: number) {
  let low = 0, high = 0.4;
  for (let step = 0; step < 18; step++) { const mid = (low + high) / 2; if (inGamut(oklchToLinear(L, mid, h))) low = mid; else high = mid; }
  return low;
}
export interface Oklch { L: number; C: number; h: number }
/** Into sRGB by lowering chroma only; lightness and hue are kept. */
export function clampOklch({ L, C, h }: Oklch): Oklch { return { L, C: Math.min(C, maxChroma(L, h)), h: ((h % 360) + 360) % 360 }; }
export function oklchToRgb(colour: Oklch): Rgb {
  const { L, C, h } = clampOklch(colour), [r, g, b] = oklchToLinear(L, C, h);
  return [gamma(r), gamma(g), gamma(b)];
}
export const rgbCss = ([r, g, b]: Rgb, alpha = 1) => alpha < 1 ? `rgb(${r} ${g} ${b} / ${alpha})` : `rgb(${r} ${g} ${b})`;

/**
 * Chroma-weighted hue histogram of RGBA pixels. Near-black, near-white and near-grey pixels count for little, so a
 * dark video with one neon sign reports the neon. Keep in step with hueBins in extensions/kanban-music/media-observer.js.
 */
export function hueBins(rgba: ArrayLike<number>): HueBins {
  const bins = new Array<number>(HUE_BINS).fill(0);
  for (let index = 0; index + 3 < rgba.length; index += 4) {
    if (rgba[index + 3] < 128) continue;
    const [L, a, b] = rgbToOklab([rgba[index], rgba[index + 1], rgba[index + 2]]), C = Math.hypot(a, b);
    if (C < 0.03 || L < 0.18 || L > 0.95) continue;
    const hue = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
    bins[Math.floor(hue / 10) % HUE_BINS] += C * C * Math.min(1, (L - 0.18) / 0.2);
  }
  return bins;
}
/** Below this mean weight per pixel the image is black and white or grey; the default palette is used. */
const ACHROMATIC = 0.00008;

/** Up to five distinct hues, strongest first; empty when the image has no real colour. */
export function huePeaks(bins: HueBins, pixels = 256, limit = 5): number[] {
  if (bins.length !== HUE_BINS || !bins.every(Number.isFinite)) return [];
  const total = bins.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total / Math.max(1, pixels) < ACHROMATIC) return [];
  const smooth = bins.map((_, index) => bins[(index + HUE_BINS - 1) % HUE_BINS] * 0.5 + bins[index] + bins[(index + 1) % HUE_BINS] * 0.5);
  const order = smooth.map((value, index) => ({ value, index })).sort((x, y) => y.value - x.value);
  const peaks: number[] = [];
  for (const { value, index } of order) {
    if (peaks.length >= limit || value < order[0].value * 0.15) break;
    // The peak's hue is the weighted mean of its bin and neighbours, so 10° bins still give a precise hue.
    const near = [-1, 0, 1].map(offset => ({ hue: (index + offset) * 10 + 5, weight: Math.max(0, bins[(index + offset + HUE_BINS) % HUE_BINS]) }));
    const x = near.reduce((sum, item) => sum + item.weight * Math.cos(item.hue * Math.PI / 180), 0), y = near.reduce((sum, item) => sum + item.weight * Math.sin(item.hue * Math.PI / 180), 0);
    const hue = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    if (peaks.every(other => hueDistance(other, hue) >= 30)) peaks.push(Math.round(hue));
  }
  return peaks;
}
export const hueDistance = (a: number, b: number) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return Math.min(d, 360 - d); };

/** Fixed hue offsets from the anchor, named by instrument (from the "Mỹ Miều" review: rows must not look alike). */
export const rowHueOffsets: Record<BeatBand, number> = { kick: 35, clap: 0, hat: -65, bass: -25, melody: 70 };
const ROW_ORDER: BeatBand[] = ['kick', 'clap', 'hat', 'bass', 'melody'];
export const MIN_ROW_HUE_GAP = 28;

/** One hue per row. A row too close to an earlier one moves further along its own direction from the anchor. */
export function rowHues(anchor: number, second?: number, rows: BeatBand[] = ROW_ORDER): Record<BeatBand, number> {
  const hues = {} as Record<BeatBand, number>, placed: number[] = [];
  for (const band of ROW_ORDER) {
    const offset = rowHueOffsets[band], direction = offset < 0 ? -1 : 1;
    let hue = anchor + offset;
    // A second strong colour in the video may colour the hi-hat when it keeps clear of the other rows.
    if (band === 'hat' && second !== undefined && placed.every(other => hueDistance(other, second) >= MIN_ROW_HUE_GAP)) hue = second;
    for (let guard = 0; guard < 36 && rows.includes(band) && placed.some(other => hueDistance(other, hue) < MIN_ROW_HUE_GAP); guard++) hue += direction * 4;
    hues[band] = ((hue % 360) + 360) % 360;
    if (rows.includes(band)) placed.push(hues[band]);
  }
  return hues;
}

/**
 * Ramp steps. Light: the Bloom grid on a near-white Dock; --c-mid (the hit) stays at 3:1 or more against it.
 * Dark: the Ultraviolet grid on a near-black Dock. Bright never passes L .82 and keeps chroma; only --c-hot, the hit
 * core, is near white.
 */
const RAMPS: Record<Appearance, Record<'idle' | 'deep' | 'mid' | 'bright' | 'hot', [number, number]>> = {
  light: { idle: [0.91, 0.055], deep: [0.44, 0.15], mid: [0.62, 0.2], bright: [0.78, 0.16], hot: [0.97, 0.03] },
  dark: { idle: [0.34, 0.075], deep: [0.4, 0.16], mid: [0.7, 0.21], bright: [0.8, 0.17], hot: [0.97, 0.03] },
};
const MIN_VIVID_CHROMA = 0.12;
/**
 * A vivid step: the table lightness when this hue holds enough chroma there; otherwise the nearest lightness inside
 * `range` that does (cyan needs lighter, blue darker), or the one with the most chroma. Chroma is then clamped.
 */
function vivid(L: number, C: number, h: number, [low, high]: [number, number]): Oklch {
  const wanted = Math.min(C, MIN_VIVID_CHROMA);
  let best = L, bestChroma = maxChroma(L, h);
  if (bestChroma < wanted) {
    for (let delta = 0.01; delta <= 0.4; delta += 0.01) for (const candidate of [L - delta, L + delta]) {
      if (candidate < low || candidate > high) continue;
      const chroma = maxChroma(candidate, h);
      if (bestChroma < wanted && chroma > bestChroma) { best = candidate; bestChroma = chroma; }
    }
  }
  return clampOklch({ L: best, C, h });
}
/** Where a vivid step may move: the light hit stays dark enough for 3:1 on the Dock, the dark hit light enough. */
const VIVID_RANGE: Record<Appearance, { mid: [number, number]; bright: [number, number] }> = {
  light: { mid: [0.5, 0.63], bright: [0.62, 0.82] },
  dark: { mid: [0.62, 0.82], bright: [0.66, 0.82] },
};
export interface RowColours { hit: string; idle: string; deep: string; mid: string; bright: string; hot: string; glow: string }
export function rampFromHue(hue: number, appearance: Appearance): RowColours {
  const ramp = RAMPS[appearance], range = VIVID_RANGE[appearance], mid = oklchToRgb(vivid(ramp.mid[0], ramp.mid[1], hue, range.mid));
  return { hit: rgbCss(mid), mid: rgbCss(mid), idle: rgbCss(oklchToRgb({ L: ramp.idle[0], C: ramp.idle[1], h: hue })),
    deep: rgbCss(oklchToRgb({ L: ramp.deep[0], C: ramp.deep[1], h: hue })), bright: rgbCss(oklchToRgb(vivid(ramp.bright[0], ramp.bright[1], hue, range.bright))),
    hot: rgbCss(oklchToRgb({ L: ramp.hot[0], C: ramp.hot[1], h: hue })), glow: rgbCss(mid, 0.62) };
}
export const rampLightness = (appearance: Appearance) => RAMPS[appearance];

/** Every row's colours for one anchor hue; `second` is the video's next strongest hue, if any. */
export function videoRowColours(anchor: number, appearance: Appearance, second?: number, rows?: BeatBand[]): Record<BeatBand, RowColours> {
  const hues = rowHues(anchor, second, rows);
  return Object.fromEntries(ROW_ORDER.map(band => [band, rampFromHue(hues[band], appearance)])) as Record<BeatBand, RowColours>;
}

/** WCAG 2 contrast ratio. */
export function contrastRatio(a: Rgb, b: Rgb) {
  const luminance = ([r, g, bl]: Rgb) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(bl);
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
export const dockSurface: Record<Appearance, Rgb> = { light: [247, 249, 253], dark: [28, 28, 30] };

/**
 * Song-section rotation: the anchor for a phrase. A phrase is 16 bars, or 8 at a slow tempo; `epoch` counts 8-bar
 * units (reshuffleEpoch). Colour therefore changes only on phrase boundaries, never on a camera cut.
 */
export function phraseIndex(epoch: number, bpm: number | null | undefined) {
  return bpm && bpm < 90 ? epoch : Math.floor(epoch / 2);
}
export function phraseAnchor(peaks: number[], phrase: number) {
  return peaks.length ? peaks[((phrase % peaks.length) + peaks.length) % peaks.length] : undefined;
}
