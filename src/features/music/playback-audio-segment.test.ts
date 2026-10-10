import { describe, expect, it } from 'vitest';
import { createPlaybackAudioBuffer } from './playback-audio-segment';
import { validatePlaybackWav } from '../../../server/playback-audio-input';
import type { PlaybackClock } from '../../../extensions/kanban-music/beat-timing.js';
const clock = (currentTime: number, sampledAt = 10000): PlaybackClock => ({ currentTime, sampledAt, playbackRate: 1, playing: true, paused: false });
const pcm = new Float32Array(8820).fill(.1);

describe('bounded private playback segments', () => {
  it('publishes aligned real PCM cores with historical context and bounded memory', () => {
    const segments: Parameters<Parameters<typeof createPlaybackAudioBuffer>[0]>[0][] = [];
    const buffer = createPlaybackAudioBuffer(segment => segments.push(segment));
    for (let index = 0; index < 650; index++) buffer.push(pcm, clock((index + 1) / 10), 10000);
    expect(segments.map(segment => [segment.start, segment.end])).toEqual([[0, 30], [30, 60]]);
    expect(segments[1].inputStart).toBeCloseTo(25, 4);
    expect(segments.every(segment => validatePlaybackWav(segment.audio, segment.end - segment.inputStart))).toBe(true);
    expect(new DataView(segments[0].audio.buffer).getInt16(44, true)).toBeGreaterThan(0);
    expect(buffer.stats().bufferedSeconds).toBeLessThanOrEqual(35);
  });
  it('waits for a complete aligned region after starting in the middle of a chunk', () => {
    const segments: { start: number; inputStart: number; audio: Uint8Array; end: number }[] = [];
    const buffer = createPlaybackAudioBuffer(segment => segments.push(segment));
    for (let index = 0; index < 600; index++) buffer.push(pcm, clock(.05 + (index + 1) / 10), 10000);
    expect(segments).toHaveLength(1);
    expect(segments[0].start).toBe(30);
    expect(segments[0].inputStart).toBeCloseTo(25, 3);
    expect(validatePlaybackWav(segments[0].audio, segments[0].end - segments[0].inputStart)).toBe(true);
  });
  it('flushes partial capture on pause, seek, stale clock and rate changes', () => {
    const segments: unknown[] = [];
    const buffer = createPlaybackAudioBuffer(segment => segments.push(segment));
    for (let index = 0; index < 100; index++) buffer.push(pcm, clock((index + 1) / 10), 10000);
    buffer.clock({ ...clock(10), playing: false, paused: true });
    expect(buffer.stats().bufferedSeconds).toBe(0);
    buffer.push(pcm, clock(10.1), 10000);
    buffer.clock(clock(100));
    expect(buffer.stats().bufferedSeconds).toBe(0);
    buffer.push(pcm, { ...clock(100.1), playbackRate: 2 }, 10000);
    expect(buffer.stats().bufferedSeconds).toBe(0);
    buffer.push(pcm, clock(100.1), 14000);
    expect(buffer.stats().bufferedSeconds).toBe(0);
    expect(segments).toEqual([]);
  });
  it('rejects unsafe capture and configuration instead of uploading malformed audio', () => {
    expect(() => createPlaybackAudioBuffer(() => {}, { segmentSeconds: 300 })).toThrow();
    const buffer = createPlaybackAudioBuffer(() => { throw new Error('Unexpected upload'); });
    buffer.push(new Float32Array([NaN, 0]), clock(0), 10000);
    expect(buffer.stats().bufferedSeconds).toBe(0);
    expect(validatePlaybackWav(new Uint8Array(45), 30)).toBe(false);
  });
});
