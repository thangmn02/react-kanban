import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createNativeAudioFeed, decodeNativeAudio } from './nativeAudio';
import { createNativeAudioEngine } from '../../../extensions/kanban-music/native-audio-engine.js';
import { beatTelemetry } from '../../../extensions/kanban-music/beat-telemetry.js';
const transport = vi.hoisted(() => ({ invoke: vi.fn().mockResolvedValue(undefined),
  channels: [] as { onmessage: (data: ArrayBuffer) => void }[] }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: transport.invoke,
  Channel: class { onmessage: (data: ArrayBuffer) => void = () => {}; constructor() { transport.channels.push(this); } } }));
vi.mock('../../../extensions/kanban-music/native-audio-engine.js', () => ({ createNativeAudioEngine: vi.fn() }));
const engine = { start: vi.fn().mockResolvedValue(true), push: vi.fn().mockReturnValue(true), renew: vi.fn().mockReturnValue(true), stop: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); transport.channels.length = 0; vi.mocked(createNativeAudioEngine).mockReturnValue(engine); });
afterEach(() => { beatTelemetry.enable(false); beatTelemetry.clear(); vi.useRealTimers(); });
function packet(sequence = 1) {
  const data = new ArrayBuffer(32), view = new DataView(data);
  view.setBigUint64(0, BigInt(sequence), true); view.setUint32(8, 2, true); view.setUint32(12, 44100, true);
  new Float32Array(data,16).set([.1,.2,.3,.4]); return data;
}
function clock(sessionId = 'browser:song', currentTime = 1, playing = true) {
  return { sessionId, subscriptionId:'subscription', kind:'clock', emittedAt:Date.now(),
    clock:{playing,paused:!playing,currentTime,playbackRate:1,sampledAt:Date.now()} };
}
it('opts into native diagnostics and preserves event IDs and PCM sequence without changing the binary header', async () => {
  beatTelemetry.enable();
  const publish = vi.fn(), feed = createNativeAudioFeed(publish);
  feed.companion(clock()); feed.activate('browser:song', 'subscription');
  await vi.waitFor(() => expect(transport.channels).toHaveLength(1));
  expect(transport.invoke).toHaveBeenCalledWith('native_audio_start', expect.objectContaining({ telemetryEnabled: true }));
  const id = engine.start.mock.calls[0][0];
  const traces = beatTelemetry.events('onset', ['kick']);
  vi.mocked(createNativeAudioEngine).mock.calls[0][0].onBeat(id, ['kick'], traces);
  expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ telemetry: traces?.map((t) => ({ ...t, captureId: id })) }));
  transport.channels[0].onmessage(packet());
  expect(engine.push).toHaveBeenCalledWith(expect.any(Float32Array), { sequence: 1 });
  transport.channels[0].onmessage(packet(3));
  expect(beatTelemetry.snapshot().records.some((r) => r.stage === 'EVENT_DROPPED' && r.reason === 'audio-backlog')).toBe(true);
  expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'sync.state', mode: 'clock', reason: 'audio-backlog' }));
  feed.stop('browser:song', 'subscription');
});
it('validates bounded PCM frames, sample rate, sequence and finite samples', () => {
  expect(decodeNativeAudio(packet())?.sequence).toBe(1);
  expect(decodeNativeAudio(packet())?.samples.length).toBe(4);
  const invalid = packet(); new Float32Array(invalid,16)[0] = NaN;
  expect(decodeNativeAudio(invalid)).toBeUndefined();
  expect(decodeNativeAudio(packet(0))).toBeUndefined();
  expect(decodeNativeAudio(new ArrayBuffer(1))).toBeUndefined();
  const wrongRate = packet(); new DataView(wrongRate).setUint32(12,48000,true);
  expect(decodeNativeAudio(wrongRate)).toBeUndefined();
});
it('starts from a fresh Companion clock, suppresses its fallback and stops on pause', async () => {
  const publish = vi.fn(), feed = createNativeAudioFeed(publish);
  feed.companion(clock()); feed.activate('browser:song','subscription');
  await vi.waitFor(() => expect(transport.invoke).toHaveBeenCalledWith('native_audio_start',expect.objectContaining({sessionId:'browser:song'})));
  const callbacks = vi.mocked(createNativeAudioEngine).mock.calls[0][0];
  const id = engine.start.mock.calls[0][0]; callbacks.onAudible(id);
  expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({mode:'capture',captureId:id}));
  expect(feed.companion({...clock(),kind:'sync.state',mode:'clock',reason:'native-audio'})).toBe(false);
  transport.channels[0].onmessage(packet()); expect(engine.push).toHaveBeenCalledOnce();
  feed.companion(clock('browser:song',1,false));
  expect(engine.stop).toHaveBeenCalledOnce();
  expect(transport.invoke).toHaveBeenCalledWith('native_audio_stop',{captureId:id});
  expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({mode:'clock',reason:'not-playing'}));
  feed.stop('browser:song','subscription');
});
it('drops old packets after a source handoff and resets buffers after seeking', async () => {
  const publish = vi.fn(), feed = createNativeAudioFeed(publish); feed.companion(clock()); feed.activate('browser:song','subscription');
  await vi.waitFor(() => expect(transport.channels).toHaveLength(1));
  const first = transport.channels[0];
  feed.companion(clock('browser:song',40));
  await vi.waitFor(() => expect(transport.channels).toHaveLength(2));
  first.onmessage(packet()); expect(engine.push).not.toHaveBeenCalled();
  const published = publish.mock.calls.length;
  vi.mocked(createNativeAudioEngine).mock.calls[0][0].onBeat('old', ['kick']);
  expect(publish).toHaveBeenCalledTimes(published);
  feed.companion(clock('browser:other')); feed.activate('browser:other','subscription');
  await vi.waitFor(() => expect(transport.channels).toHaveLength(3));
  feed.stop('browser:song','subscription');
  transport.channels[2].onmessage(packet()); expect(engine.push).toHaveBeenCalledOnce();
  feed.stop('browser:other','subscription');
});
it('expires capture when the Companion clock disappears even if PCM continues', async () => {
  vi.useFakeTimers(); vi.setSystemTime(100000);
  const feed = createNativeAudioFeed(vi.fn()); feed.companion(clock()); feed.activate('browser:song','subscription');
  await vi.advanceTimersByTimeAsync(10);
  await vi.advanceTimersByTimeAsync(3500);
  expect(engine.stop).toHaveBeenCalledOnce();
  feed.stop('browser:song','subscription');
});
