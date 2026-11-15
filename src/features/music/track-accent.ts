/**
 * The music panel's background accent and the contrast helpers shared with the
 * Beat Grid palette (track-palette.ts).
 * Presentation only: nothing here reads or changes beat detection or timing.
 */
export interface TrackAccent { hue: number; saturation: number }
export type AccentAppearance = 'light' | 'dark';

/** The dock surfaces the colours have to stay readable on. */
const DOCK_SURFACE: Record<AccentAppearance, [number, number, number]> = { light: [247, 249, 253], dark: [28, 28, 30] };
const WHITE: [number, number, number] = [255, 255, 255];

export function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const s = saturation / 100, l = lightness / 100, a = s * Math.min(l, 1 - l);
  const channel = (n: number) => { const k = (n + hue / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [channel(0), channel(8), channel(4)];
}
const luminance = ([r, g, b]: [number, number, number]) => {
  const linear = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};
/** WCAG 2 contrast ratio between two sRGB colours. */
export function contrastRatio(a: [number, number, number], b: [number, number, number]) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Lower lightness until white text on the colour reaches the wanted contrast. */
function deepLightness(accent: TrackAccent, minimum: number) {
  let lightness = 30;
  while (lightness > 4 && contrastRatio(hslToRgb(accent.hue, Math.min(accent.saturation, 60), lightness), WHITE) < minimum) lightness -= 2;
  return lightness;
}

/**
 * CSS custom properties for the music panel background, in the hue of the
 * track's dominant colour and dark enough for white text at 7:1.
 */
export function trackAccentVariables(accent: TrackAccent): Record<string, string> {
  const { hue, saturation } = accent, deep = deepLightness(accent, 7), deeper = Math.max(6, deep - 12);
  const hsl = (h: number, s: number, l: number, alpha = 1) => `hsl(${Math.round((h + 360) % 360)} ${s}% ${l}%${alpha < 1 ? ` / ${alpha}` : ''})`;
  return {
    '--track-accent-face': `radial-gradient(120% 90% at 15% 0%,${hsl(hue, saturation, Math.min(deep + 18, 52), 0.7)},transparent 65%),radial-gradient(100% 110% at 100% 100%,${hsl(hue + 28, saturation, Math.min(deep + 8, 42), 0.6)},transparent 65%),linear-gradient(155deg,${hsl(hue, Math.min(saturation, 60), deep)},${hsl(hue - 14, Math.min(saturation, 55), deeper)})`,
  };
}
/** The base colour of the panel background, for contrast checks. */
export const trackAccentDeepRgb = (accent: TrackAccent) => hslToRgb(accent.hue, Math.min(accent.saturation, 60), deepLightness(accent, 7));
export const dockSurfaceRgb = (appearance: AccentAppearance) => DOCK_SURFACE[appearance];
