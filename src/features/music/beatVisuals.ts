import type { BeatBand } from './mediaBridge';

export type BeatPatternName = 'pop' | 'wave' | 'splash' | 'ripple';
export type BeatColorMode = 'pastel' | 'flow' | 'random';
export type BeatPalette = 'bloom' | 'ultraviolet';
export type MomentShape = 'heart' | 'diamond' | 'smile';
export type MomentEffect = 'cascade' | 'wave' | 'rain';

export const beatBands: BeatBand[] = ['kick', 'clap', 'hat', 'bass', 'melody'];
// Presentation only: event contracts retain all five semantic types.
export const productBeatBands: BeatBand[] = ['kick', 'clap', 'hat', 'bass'];
export type BeatRowCount = 4 | 5;
export const trackNames: Record<BeatBand, string> = { kick: 'Kick', clap: 'Snare / Clap', hat: 'Hi-hat / Cymbal', bass: 'Bass / Low pulse', melody: 'Lead' };
export const momentFlashMs = 8000;
export const patternNames: BeatPatternName[] = ['pop', 'wave', 'splash', 'ripple'];
export const shapeNames: MomentShape[] = ['heart', 'diamond', 'smile'];
export const effectNames: MomentEffect[] = ['cascade', 'wave', 'rain'];
export const barSeconds = 8 * 8 * 0.3;

export const fixedColors: Record<BeatPalette, { hit: string; idle: string }[]> = {
  bloom: [
    { idle: '#fecdd3', hit: '#fb7185' },
    { idle: '#bae6fd', hit: '#38bdf8' },
    { idle: '#fde68a', hit: '#fbbf24' },
    { idle: '#ddd6fe', hit: '#a78bfa' },
    { idle: '#a7f3d0', hit: '#34d399' },
  ],
  ultraviolet: [
    { idle: '#56273e', hit: '#ff2e88' },
    { idle: '#164953', hit: '#00e5ff' },
    { idle: '#544d16', hit: '#ffe600' },
    { idle: '#412358', hit: '#9d4edd' },
    { idle: '#15493b', hit: '#00ffb3' },
  ],
};

const shapes: Record<MomentShape, string[]> = {
  heart: ['01100110', '11111111', '11111111', '01111110', '00011000'],
  diamond: ['00011000', '00111100', '01111110', '00111100', '00011000'],
  smile: ['01111110', '01011010', '01000010', '01011010', '00111100'],
};
const fourRowShapes: Record<MomentShape, string[]> = {
  heart: ['01100110', '11111111', '01111110', '00011000'],
  diamond: ['00011000', '01111110', '01111110', '00011000'],
  smile: ['01111110', '01011010', '01000010', '00111100'],
};

export function hashText(value: string): number {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function randomUnit(seed: number): number {
  let value = seed >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967296;
}

export function patternAt(songSeconds: number): BeatPatternName {
  return patternNames[Math.floor(Math.max(0, songSeconds) / 8) % patternNames.length];
}

export function reshuffleEpoch(songSeconds: number, bpm: number | null = null): number {
  const eightBars = bpm && bpm >= 60 && bpm <= 180 ? 8 * 4 * 60 / bpm : barSeconds;
  return Math.floor(Math.max(0, songSeconds) / eightBars);
}

export function activeSteps(sessionId: string, epoch: number, row: number): boolean[] {
  const seed = hashText(`${sessionId}:${epoch}:${row}`);
  const count = 2 + Math.floor(randomUnit(seed) * 3);
  const ranked = Array.from({ length: 8 }, (_, step) => ({ step, rank: randomUnit(seed + step * 7919) }));
  ranked.sort((a, b) => a.rank - b.rank);
  const chosen = new Set(ranked.slice(0, count).map(({ step }) => step));
  return Array.from({ length: 8 }, (_, step) => chosen.has(step));
}

export function channelColors(mode: BeatColorMode, palette: BeatPalette, sessionId: string, epoch: number, row: number, rowCount: BeatRowCount = 5) {
  if (mode !== 'random') return fixedColors[palette][row];
  const seed = hashText(`${sessionId}:${epoch}:hue`);
  const base = Math.floor(randomUnit(seed) * 360);
  const jitter = Math.floor(randomUnit(seed + row * 997) * 25) - 12;
  const hue = (base + row * (360 / rowCount) + jitter + 360) % 360;
  return { hit: `hsl(${hue} 80% 62%)`, idle: `hsl(${hue} 85% 90%)` };
}

export function pulseDelay(pattern: BeatPatternName, step: number, seed: number): number | null {
  if (pattern === 'pop') return 0;
  if (pattern === 'wave') return step * 40;
  if (pattern === 'ripple') return Math.round(Math.abs(step - 3.5) * 40);
  return randomUnit(seed + step * 431) < 0.6 ? Math.floor(randomUnit(seed + step * 271) * 71) : null;
}

export function isShapeCell(shape: MomentShape, row: number, step: number, rowCount: BeatRowCount = 5): boolean {
  return (rowCount === 4 ? fourRowShapes : shapes)[shape][row]?.[step] === '1';
}

export function momentDelay(effect: MomentEffect, row: number, step: number, seed: number): number {
  if (effect === 'cascade') return row * 110;
  if (effect === 'wave') return step * 65;
  return step * 75 + Math.floor(randomUnit(seed + row * 79 + step * 17) * 65);
}

export function momentDuration(effect: MomentEffect, seed: number, rowCount: BeatRowCount = 5): number {
  const delays = Array.from({ length: rowCount }, (_, row) => Array.from({ length: 8 }, (_, step) => momentDelay(effect, row, step, seed))).flat();
  // Keep the whole shape mounted through the last square's hold and fade.
  return momentFlashMs + Math.max(...delays) + 50;
}

export function nextDifferent<T>(items: readonly T[], previous: T | undefined, random: number): T {
  const choices = items.filter((item) => item !== previous);
  return choices[Math.floor(random * choices.length) % choices.length];
}
