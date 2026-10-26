export interface BeatTrace {
  id: string; source: 'onset' | 'tempo' | 'random' | 'lifecycle';
  type: 'kick' | 'snare' | 'hat' | 'bass' | 'melodic' | 'generic';
  confidence: number | null; detectedAt: number; targetTime: number;
  targetClock: 'epoch-ms' | 'audio-seconds'; captureId?: string;
  active?: boolean; noteSequence?: number;
  targetPlaybackTime?: number;
  eventSource?: 'cache' | 'local' | 'degraded';
  eventId?: string;
  sourceId?: string; sourceGeneration?: number; synchronizationEpoch?: string;
  sourceAudioTime?: number; detectorReadyAt?: number; configuredAudioDelayMs?: number;
  originalClassIndex?: number; percussionLabelMapping?: 'M0' | 'M1';
  detectorModel?:'CNN-B'|'ADTOF-A';
  frontendReadyTime?:number;cnnInferenceStart?:number;cnnInferenceEnd?:number;detectorDecisionReady?:number;workerPostTime?:number;companionReceiveTime?:number;
  origin?: 'event-track-cache' | 'local-detector' | 'capture-engine' | 'native-audio-engine' | 'visual-decoration';
}
export interface BeatTelemetry {
  enable(value?: boolean): void; readonly enabled: boolean; clear(): void;
  subscribe(listener: (record: Record<string, unknown>) => void): () => void;
  snapshot(): { enabled: boolean; evicted: number; counts: Record<string, number>; records: Record<string, unknown>[] };
  record(stage: string, trace?: BeatTrace, details?: Record<string, unknown>): void;
  events(source: BeatTrace['source'], bands: string[], details?: Record<string, unknown>): BeatTrace[] | undefined;
  mark(stage: string, traces?: BeatTrace[], details?: Record<string, unknown>): void;
  at(component: string): BeatTelemetry;
}
export function createBeatTelemetry(options?: { now?: () => number; limit?: number }): BeatTelemetry;
export function parseBeatTraces(value: unknown): BeatTrace[] | undefined;
export const beatTelemetry: BeatTelemetry;
