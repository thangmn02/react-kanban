export type BeatCapabilityTier = 'native-monitor' | 'tab-capture' | 'clock-only';
export interface BeatCapabilities {
  tier: BeatCapabilityTier;
  captureClock: 'estimated' | 'output-clock-capable' | 'unavailable';
}
export function beatCapabilities(native: boolean, tabCapture: boolean): BeatCapabilities {
  return native ? { tier: 'native-monitor', captureClock: 'estimated' }
    : tabCapture ? { tier: 'tab-capture', captureClock: 'output-clock-capable' }
      : { tier: 'clock-only', captureClock: 'unavailable' };
}
