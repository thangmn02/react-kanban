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
  const deps = { getUserMedia: vi.fn().mockResolvedValue(stream), createAudioContext: vi.fn(() => context), onBeat: vi.fn(), onStop: vi.fn(), now: () => Date.now() };
  return { audio, video, stream, source, context, deps, engine: createCaptureEngine(deps) };
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
