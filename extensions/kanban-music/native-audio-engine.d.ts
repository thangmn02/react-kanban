export interface NativeAudioEngine {
  start(id: string): Promise<boolean>;
  push(samples: Float32Array): boolean;
  renew(id: string): boolean;
  stop(): void;
}
export interface NativeAudioCallbacks {
  onBeat(id: string, bands: string[]): void;
  onStop(id: string, reason: string): void;
  onAudible(id: string): void;
  onTempo(id: string, tempo: { locked: boolean; bpm: number | null; confidence: number }): void;
  onTempoTick(id: string, tick: { step: number; bands: string[] }): void;
  onMelody(id: string, melody: { active: boolean; level: number; note: number }): void;
}
export function createNativeAudioEngine(options: NativeAudioCallbacks): NativeAudioEngine;
