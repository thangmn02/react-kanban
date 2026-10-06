export interface BeatTrace {
  id: string; source: 'onset' | 'tempo' | 'random' | 'lifecycle';
  type: 'kick' | 'snare' | 'hat' | 'bass' | 'melodic' | 'generic';
  confidence: number | null; detectedAt: number; targetTime: number;
  targetClock: 'epoch-ms' | 'audio-seconds'; captureId?: string;
  active?: boolean; noteSequence?: number;
  targetPlaybackTime?: number;
  eventSource?: 'cache' | 'local' | 'degraded';
}
export interface BeatTelemetry {
  enable(value?: boolean): void; readonly enabled: boolean; clear(): void;
  snapshot(): { enabled: boolean; evicted: number; counts: Record<string, number>; records: Record<string, unknown>[] };
  record(stage: string, trace?: BeatTrace, details?: Record<string, unknown>): void;
  events(source: BeatTrace['source'], bands: string[], details?: Record<string, unknown>): BeatTrace[] | undefined;
  mark(stage: string, traces?: BeatTrace[], details?: Record<string, unknown>): void;
  at(component: string): BeatTelemetry;
}
export function createBeatTelemetry(options?: { now?: () => number; limit?: number }): BeatTelemetry;
export function parseBeatTraces(value: unknown): BeatTrace[] | undefined;
export const beatTelemetry: BeatTelemetry;
