import { afterEach, expect, it, vi } from 'vitest';
import { companionLeadInputEnabled, decodeCompanionAudio, startCompanionLeadAudio } from './companion-lead-audio';
import { LEAD_ANALYSIS_VERSION } from './lead-events';
import { LEAD_AUDIO_VERSION } from '../../../extensions/kanban-music/lead-audio-tap.js';
import { createPlaybackAudioBuffer } from './playback-audio-segment';
import { validatePlaybackWav } from '../../../server/playback-audio-input';
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
const asset = { provider: 'kora-development' as const, id: 'a'.repeat(64) };
function raw(time = .2, sequence = 1) {
  const bytes = new Uint8Array(17640), view = new DataView(bytes.buffer);
  for (let index = 0; index < 8820; index++) view.setInt16(index * 2, 8000, true);
  return { captureId: 'owner', sequence, asset, pcm: btoa(String.fromCharCode(...bytes)),
    clock: { currentTime: time, sampledAt: Date.now(), playbackRate: 1, playing: true, paused: false } };
}
it('keeps the frozen analysis identity and defaults raw Web input to disabled', () => {
  expect(LEAD_AUDIO_VERSION).toBe(LEAD_ANALYSIS_VERSION);
  expect(companionLeadInputEnabled(asset)).toBe(false);
  vi.stubEnv('VITE_LEAD_PULSE_PROCESSING_ENABLED', 'true');
  vi.stubEnv('VITE_LEAD_AUDIO_TEST_ASSET', `kora-development:${asset.id}`);
  expect(companionLeadInputEnabled(asset)).toBe(true);
  expect(companionLeadInputEnabled({ ...asset, id: 'xxxxxxxxxxx' })).toBe(false);
  vi.stubEnv('VITE_LEAD_AUDIO_TEST_ASSET', 'youtube:abcdefghijk');
  expect(companionLeadInputEnabled({ provider: 'youtube', id: 'abcdefghijk' })).toBe(false);
});
it('rejects wrong identities, invalid samples and stale or paused capture clocks', () => {
  const value = raw();
  expect(decodeCompanionAudio(value, asset)?.samples[0]).toBeCloseTo(8000 / 32768);
  for (const invalid of [{ ...value, asset: { ...asset, id: 'xxxxxxxxxxx' } }, { ...value, pcm: 'a' },
    { ...value, pcm: '!'.repeat(23520) }, { ...value, sequence: -1 },
    { ...value, clock: { ...value.clock, sampledAt: Date.now() - 1000 } },
    { ...value, clock: { ...value.clock, paused: true } },
    { ...value, clock: { ...value.clock, seeking: true } },
    { ...value, clock: { ...value.clock, buffering: true } },
    { ...value, clock: { ...value.clock, playbackRate: 2 } }]) expect(decodeCompanionAudio(invalid, asset)).toBeUndefined();
});
it('feeds the existing native WAV contract with thirty seconds of bounded Web packets', () => {
  const segments: Parameters<Parameters<typeof createPlaybackAudioBuffer>[0]>[0][] = [];
  const buffer = createPlaybackAudioBuffer(segment => segments.push(segment));
  for (let index = 0; index < 151; index++) {
    const packet = decodeCompanionAudio(raw((index + 1) * .2, index + 1), asset)!;
    buffer.push(packet.samples, packet.clock, packet.clock.sampledAt);
  }
  expect(segments).toHaveLength(1);
  expect([segments[0].start, segments[0].end]).toEqual([0, 30]);
  expect(validatePlaybackWav(segments[0].audio, segments[0].end - segments[0].inputStart)).toBe(true);
  expect(buffer.stats().capacitySeconds).toBe(35);
});
it('allows one request in flight, discards stopped results and stops pulling on cache readiness', async () => {
  vi.useFakeTimers();
  let finish!: (value: unknown) => void, needed = true;
  const read = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const receive = vi.fn(), reset = vi.fn();
  const stop = startCompanionLeadAudio('session', 'sub', asset, receive, reset, () => needed, read);
  await vi.advanceTimersByTimeAsync(1000);
  expect(read).toHaveBeenCalledOnce();
  finish(raw()); await vi.advanceTimersByTimeAsync(100);
  expect(receive).toHaveBeenCalledOnce();
  expect(receive.mock.calls[0][0].every((value: number) => value === 0)).toBe(true);
  needed = false; finish(raw(.4, 2)); await vi.advanceTimersByTimeAsync(500);
  expect(receive).toHaveBeenCalledOnce();
  expect(read).toHaveBeenCalledTimes(2);
  stop();
  await vi.advanceTimersByTimeAsync(1000);
  expect(read).toHaveBeenCalledTimes(2);
});
