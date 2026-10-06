export interface OutputTiming {
  targetOutputTime: number;
}

export interface PlaybackClock {
  playing: boolean;
  paused: boolean;
  currentTime: number;
  playbackRate: number;
  sampledAt: number;
  seeking?: boolean;
  buffering?: boolean;
  generation?: number;
}

export interface PlaybackTiming {
  targetPlaybackTime: number;
  playbackClock: PlaybackClock;
}

export function outputTiming(context: AudioContext, targetAudioTime: number, monitorOnly?: boolean): OutputTiming | undefined;
export function audibleClock(clock: PlaybackClock, delaySeconds?: number): PlaybackClock | undefined;
export function playbackTiming(clock: PlaybackClock, timing?: OutputTiming, delaySeconds?: number): PlaybackTiming | undefined;
export function playbackTraces(traces: import('./beat-telemetry.js').BeatTrace[] | undefined, timing?: PlaybackTiming, targetOutputTime?: number): import('./beat-telemetry.js').BeatTrace[] | undefined;
export function parsePlaybackTiming(value: unknown): PlaybackTiming | undefined;
export function playbackDeadline(timing: PlaybackTiming): number;
export function parsePlaybackClock(value: unknown): PlaybackClock | undefined;
export function clockAdvancing(clock?: PlaybackClock): boolean;
export function playbackPosition(clock: PlaybackClock, now?: number): number;
export function clockDiscontinuity(previous: PlaybackClock | undefined, next: PlaybackClock): boolean;
