import type { BeatTrace } from './beat-telemetry.js';
import type { OutputTiming } from './beat-timing.js';
export interface NativeAudioEngine {
  start(id: string): Promise<boolean>;
  push(samples: Float32Array, diagnostic?: { sequence: number }): boolean;
  renew(id: string): boolean;
  stop(): void;
}
export interface NativeAudioCallbacks {
  onBeat(id: string, bands: string[], telemetry?: BeatTrace[], timing?: OutputTiming): void;
  onStop(id: string, reason: string): void;
  onAudible(id: string): void;
  onTempo(id: string, tempo: { locked: boolean; bpm: number | null; confidence: number }, telemetry?: BeatTrace[], timing?: OutputTiming): void;
  onTempoTick(id: string, tick: { step: number; phase: number; beatPosition: number; subdivision: 2 }, telemetry?: BeatTrace[], timing?: OutputTiming): void;
}
export function createNativeAudioEngine(options: NativeAudioCallbacks): NativeAudioEngine;
