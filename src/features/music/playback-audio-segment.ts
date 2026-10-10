import { clockAdvancing, clockDiscontinuity, playbackPosition, type PlaybackClock } from '../../../extensions/kanban-music/beat-timing.js';

export interface PlaybackAudioSegment {
  start: number; end: number; inputStart: number; sampleRate: 16000; audio: Uint8Array;
}
export const SEGMENT_SECONDS = 30;
export const SEGMENT_CONTEXT_SECONDS = 5;
export const MAX_SEGMENT_BYTES = 44 + (SEGMENT_SECONDS + SEGMENT_CONTEXT_SECONDS) * 16000 * 2;

// Fixed-rate private PCM input, independent of event detection and scheduling.
// Clock discontinuities discard partial data rather than mislabeling a seek.
export function createPlaybackAudioBuffer(deliver: (segment: PlaybackAudioSegment) => void,
  options: { segmentSeconds?: number; contextSeconds?: number } = {}) {
  const seconds = options.segmentSeconds ?? SEGMENT_SECONDS, context = options.contextSeconds ?? SEGMENT_CONTEXT_SECONDS;
  if (![30, 60].includes(seconds) || !Number.isFinite(context) || context < 0 || context > 5) throw new Error('Invalid audio segment bounds');
  const rate = 16000;
  const samples = new Int16Array((seconds + context) * rate);
  let previous: PlaybackClock | undefined, count = 0, inputStart = 0, coreStart: number | undefined;
  let remainder = 0, sum = 0, sourceFrames = 0;
  const reset = () => { count = 0; coreStart = undefined; remainder = sum = sourceFrames = 0; };
  return {
    reset,
    clock(clock: PlaybackClock) {
      if (!clockAdvancing(clock) || clock.playbackRate !== 1 || clockDiscontinuity(previous, clock)) reset();
      previous = clock;
    },
    push(stereo: Float32Array, clock: PlaybackClock, sampledAt = Date.now()) {
      if (!clockAdvancing(clock) || clock.playbackRate !== 1 || sampledAt - clock.sampledAt > 1500
        || stereo.length % 2 || !stereo.length || stereo.length > 88200
        || stereo.some(sample => !Number.isFinite(sample) || Math.abs(sample) > 1)) { reset(); previous = clock; return; }
      if (clockDiscontinuity(previous, clock)) reset();
      previous = clock;
      const packetSeconds = stereo.length / 2 / 44100;
      const packetStart = Math.max(0, playbackPosition(clock, sampledAt) - packetSeconds);
      if (coreStart === undefined) {
        // Wait for an aligned core that we can capture completely. Historical
        // context may be shorter at startup; no missing audio is zero-padded.
        coreStart = Math.ceil(packetStart / seconds) * seconds;
        inputStart = packetStart;
      }
      const expected = inputStart + count / rate;
      if (count && Math.abs(packetStart - expected) > .15) { reset(); return; }
      for (let frame = 0; frame < stereo.length; frame += 2) {
        sum += (stereo[frame] + stereo[frame + 1]) / 2; sourceFrames++; remainder += rate;
        if (remainder < 44100) continue;
        remainder -= 44100;
        if (count < samples.length) samples[count++] = Math.round(Math.max(-1, Math.min(1, sum / sourceFrames)) * 32767);
        sum = sourceFrames = 0;
        const finish = inputStart + count / rate;
        if (finish >= coreStart + seconds) {
          const wantedStart = Math.max(inputStart, coreStart - context);
          const from = Math.round((wantedStart - inputStart) * rate);
          const pcm = samples.slice(from, count);
          const audio = new Uint8Array(44 + pcm.length * 2), view = new DataView(audio.buffer);
          const text = (offset: number, value: string) => { [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0))); };
          text(0, 'RIFF'); view.setUint32(4, audio.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
          view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
          view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
          text(36, 'data'); view.setUint32(40, pcm.length * 2, true);
          pcm.forEach((sample, index) => view.setInt16(44 + index * 2, sample, true));
          deliver({ start: coreStart, end: coreStart + seconds, inputStart: wantedStart, sampleRate: rate, audio });
          const keep = Math.min(context * rate, count);
          samples.copyWithin(0, count - keep, count); count = keep;
          inputStart = finish - keep / rate; coreStart += seconds;
        } else if (count === samples.length) {
          // Starting between chunk boundaries needs only the latest context,
          // not a growing buffer while waiting for the next complete core.
          const keep = Math.min(count - rate, Math.ceil((finish - Math.max(inputStart, coreStart - context)) * rate));
          samples.copyWithin(0, count - keep, count); inputStart += (count - keep) / rate; count = keep;
        }
      }
    },
    stats: () => ({ bufferedSeconds: count / rate, capacitySeconds: samples.length / rate }),
  };
}
