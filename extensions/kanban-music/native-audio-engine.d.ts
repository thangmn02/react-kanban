import type { BeatTrace } from './beat-telemetry.js';
export interface NativeAudioEngine {
  start(id: string): Promise<boolean>;
  push(samples: Float32Array, diagnostic?: { sequence: number }): boolean;
  renew(id: string): boolean;
  stop(): void;
}
export interface NativeAudioCallbacks {
  onBeat(id: string, bands: string[], telemetry?: BeatTrace[]): void;
  onStop(id: string, reason: string): void;
  onAudible(id: string): void;
  onTempo(id: string, tempo: { locked: boolean; bpm: number | null; confidence: number }, telemetry?: BeatTrace[]): void;
  onTempoTick(id: string, tick: { step: number; phase: number; beatPosition: number; subdivision: 2 }, telemetry?: BeatTrace[]): void;
  onMelody(id: string, melody: { active: boolean; level: number; note: number }, telemetry?: BeatTrace[]): void;
}
export function createNativeAudioEngine(options: NativeAudioCallbacks): NativeAudioEngine;
