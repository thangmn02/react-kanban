import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createCaptureEngine, tabConstraints } from './capture-engine.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
function fixture() {
  const audio = { stop: vi.fn(), addEventListener: vi.fn(), readyState: 'live' };
  const video = { stop: vi.fn() };
  const stream = { getTracks: () => [audio, video], getAudioTracks: () => [audio], getVideoTracks: () => [video] };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const analyser = { frequencyBinCount: 1024, getFloatFrequencyData: (array) => array.fill(-60), disconnect: vi.fn() };
  const context = { sampleRate: 48000, state: 'running', destination: {}, resume: vi.fn().mockResolvedValue(), close: vi.fn().mockResolvedValue(),
    createMediaStreamSource: () => source, createAnalyser: () => analyser };
  const deps = { getUserMedia: vi.fn().mockResolvedValue(stream), createAudioContext: vi.fn(() => context), onBeat: vi.fn(), onStop: vi.fn(), onAudible: vi.fn(),
    onTempo: vi.fn(), onTempoTick: vi.fn(), onMelody: vi.fn(), now: () => Date.now() };
  return { audio, video, stream, source, analyser, context, deps, engine: createCaptureEngine(deps) };
}
it('uses the documented constraints, discards video, and restores tab audio once', async () => {
  const f = fixture();
  expect(await f.engine.start('stream-id', 'capture')).toBe(true);
  expect(f.deps.getUserMedia).toHaveBeenCalledWith(tabConstraints('stream-id'));
  expect(f.video.stop).toHaveBeenCalledOnce();
  expect(f.audio.stop).not.toHaveBeenCalled();
  expect(f.source.connect.mock.calls.filter(([target]) => target === f.context.destination)).toHaveLength(1);
  f.engine.stop();
  expect(f.audio.stop).toHaveBeenCalledOnce();
  expect(f.context.close).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it('confirms audible analysis once, not just an opened stream', async () => {
  const f = fixture();
  f.analyser.getFloatFrequencyData = (array) => array.fill(-Infinity);
  await f.engine.start('stream', 'capture');
  await vi.advanceTimersByTimeAsync(100);
  expect(f.deps.onAudible).not.toHaveBeenCalled();
  f.analyser.getFloatFrequencyData = (array) => array.fill(-30);
  await vi.advanceTimersByTimeAsync(100);
  expect(f.deps.onAudible).toHaveBeenCalledExactlyOnceWith('capture');
  f.engine.stop();
});

it('publishes a held Melody envelope throughout a drumless note and turns it off on silence', async () => {
  const f = fixture();
  let tone = true;
  f.analyser.getFloatFrequencyData = (array) => {
    array.fill(-Infinity);
    if (tone) { array[19] = -25; array[38] = -32; array[57] = -36; }
  };
  await f.engine.start('stream', 'melody');
  await vi.advanceTimersByTimeAsync(3000);
  expect(f.deps.onMelody.mock.calls.filter(([, state]) => state.active).length).toBeGreaterThan(20);
  expect(f.deps.onMelody).toHaveBeenLastCalledWith('melody', expect.objectContaining({ active: true, note: 1 }));
  expect(f.deps.onTempoTick).not.toHaveBeenCalled();
  tone = false;
  await vi.advanceTimersByTimeAsync(500);
  expect(f.deps.onMelody).toHaveBeenLastCalledWith('melody', expect.objectContaining({ active: false, level: 0 }));
  f.engine.stop();
  expect(vi.getTimerCount()).toBe(0);
});

it('stops a silent or protected stream without announcing live analysis or any onsets', async () => {
  const f = fixture();
  f.analyser.getFloatFrequencyData = (array) => array.fill(-Infinity);
  await f.engine.start('stream', 'silent');
  await vi.advanceTimersByTimeAsync(2600);
  expect(f.deps.onAudible).not.toHaveBeenCalled();
  expect(f.deps.onBeat).not.toHaveBeenCalled();
  expect(f.deps.onStop).toHaveBeenCalledWith('silent', 'silent');
  expect(f.audio.stop).toHaveBeenCalledOnce();
});
it('locks sparse periodic captured transients, emits live tempo ticks, and drops the grid when confidence fades', async () => {
  const f = fixture();
  let periodic = true;
  f.analyser.getFloatFrequencyData = (array) => {
    array.fill(-60);
    if (periodic && Math.round(Date.now() / (1000 / 60)) % 30 === 0) array.fill(-25, 64, 214);
  };
  await f.engine.start('stream', 'tempo');
  for (let index = 0; index < 3; index++) {
    await vi.advanceTimersByTimeAsync(4000);
    f.engine.renew('tempo');
  }
  const locks = f.deps.onTempo.mock.calls.map(([, state]) => state).filter((state) => state.locked);
  expect(locks.length).toBeGreaterThan(0);
  expect(locks.at(-1).bpm).toBeGreaterThan(118);
  expect(locks.at(-1).bpm).toBeLessThan(124);
  expect(f.deps.onTempoTick).toHaveBeenCalledWith('tempo', expect.objectContaining({ step: expect.any(Number), bands: expect.arrayContaining(['hat']) }));
  periodic = false;
  for (let index = 0; index < 3; index++) {
    await vi.advanceTimersByTimeAsync(4000);
    f.engine.renew('tempo');
  }
  expect(f.deps.onTempo).toHaveBeenLastCalledWith('tempo', expect.objectContaining({ locked: false, bpm: null }));
  f.engine.stop();
});
it('keeps dense multi-band drums in raw-accent mode', async () => {
  const f = fixture();
  f.analyser.getFloatFrequencyData = (array) => {
    array.fill(Math.round(Date.now() / (1000 / 60)) % 30 === 0 ? -25 : -60);
  };
  await f.engine.start('stream', 'drums');
  for (let index = 0; index < 3; index++) {
    await vi.advanceTimersByTimeAsync(4000);
    f.engine.renew('drums');
  }
  expect(f.deps.onBeat).toHaveBeenCalled();
  expect(f.deps.onTempo.mock.calls.every(([, state]) => !state.locked)).toBe(true);
  expect(f.deps.onTempoTick).not.toHaveBeenCalled();
  f.engine.stop();
});
it('falls back cleanly on capture rejection and releases streams that arrive after cancellation', async () => {
  const failed = fixture();
  failed.deps.getUserMedia.mockRejectedValue(new Error('NotAllowedError'));
  expect(await failed.engine.start('id', 'denied')).toBe(false);
  expect(failed.deps.createAudioContext).not.toHaveBeenCalled();
  const late = fixture();
  let resolve;
  late.deps.getUserMedia.mockReturnValue(new Promise((done) => { resolve = done; }));
  const request = late.engine.start('id', 'late');
  late.engine.stop();
  resolve(late.stream);
  expect(await request).toBe(false);
  expect(late.audio.stop).toHaveBeenCalledOnce();
  expect(late.video.stop).toHaveBeenCalledOnce();
});
it('does not let stale stop commands stop a new capture, and releases an expired lease', async () => {
  const f = fixture();
  await f.engine.start('id', 'new');
  f.engine.stopCapture('old');
  expect(f.audio.stop).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(6100);
  expect(f.audio.stop).toHaveBeenCalledOnce();
  expect(f.deps.onStop).toHaveBeenCalledWith('new', 'expired');
});
