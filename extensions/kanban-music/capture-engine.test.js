import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createCaptureEngine, tabConstraints } from './capture-engine.js';
import { TempoTracker } from './tempo-tracker.js';
import { beatTelemetry } from './beat-telemetry.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { beatTelemetry.enable(false); beatTelemetry.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });
it('reports a bounded capture failure category without retaining source details or changing recovery', async () => {
  const f = fixture();
  f.deps.getUserMedia.mockRejectedValueOnce(new DOMException('private source identifier', 'NotReadableError'));
  expect(await f.engine.start('stream', 'failed-stream')).toBe(false);
  expect(f.engine.lastFailure).toEqual({ stage: 'stream-open', code: 'NotReadableError' });
  expect(f.deps.onBeat).not.toHaveBeenCalled();
  expect(f.deps.onStop).toHaveBeenCalledWith('failed-stream', 'failed');
  expect(await f.engine.start('fresh', 'recovered-stream')).toBe(true);
  expect(f.engine.lastFailure).toBeUndefined();
  f.engine.stop();
});
it('keeps actual detection delivering through thirty minutes with long quiet sections', async () => {
  const f = fixture(); let time = 0, sample;
  Object.defineProperty(f.context, 'currentTime', { get: () => time / 1000 });
  f.analyser.getFloatFrequencyData = (array) => {
    const frame = Math.round(time / (1000 / 60));
    const quiet = frame % 18000 >= 12000 && frame % 18000 < 13200;
    array.fill(quiet ? -Infinity : frame % 30 === 0 ? -20 : -60);
  };
  const engine = createCaptureEngine({ ...f.deps, now: () => time,
    schedule: (callback) => { sample = callback; return 1; }, cancel: vi.fn() });
  await engine.start('stream', 'continuous');
  let previousCount = 0;
  for (let frame = 0; frame <= 108000; frame++) {
    time = frame * 1000 / 60;
    if (frame % 120 === 0) expect(engine.renew('continuous')).toBe(true);
    sample();
    if (frame > 60 && frame % 60 === 0 && (frame - 60) % 18000 < 12000) {
      expect(f.deps.onBeat.mock.calls.length).toBeGreaterThan(previousCount);
    }
    if (frame % 60 === 0) previousCount = f.deps.onBeat.mock.calls.length;
    if (frame % 18000 === 13200) expect(f.deps.onBeat.mock.calls.at(-1)[0]).toBe('continuous');
  }
  expect(f.deps.onStop).not.toHaveBeenCalled();
  expect(f.deps.getUserMedia).toHaveBeenCalledOnce();
  engine.stop();
}, 60000);
function fixture() {
  const audio = { stop: vi.fn(), addEventListener: vi.fn(), readyState: 'live' };
  const video = { stop: vi.fn() };
  const stream = { getTracks: () => [audio, video], getAudioTracks: () => [audio], getVideoTracks: () => [video] };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const analyser = { frequencyBinCount: 1024, getFloatFrequencyData: (array) => array.fill(-60), disconnect: vi.fn() };
  const context = { sampleRate: 48000, state: 'running', destination: {}, resume: vi.fn().mockResolvedValue(), close: vi.fn().mockResolvedValue(),
    createMediaStreamSource: () => source, createAnalyser: () => analyser };
  Object.defineProperty(context, 'currentTime', { configurable: true, get: () => Date.now() / 1000 });
  let classify;
  const deps = { getUserMedia: vi.fn().mockResolvedValue(stream), createAudioContext: vi.fn(() => context), onBeat: vi.fn(), onStop: vi.fn(), onAudible: vi.fn(),
    onTempo: vi.fn(), onTempoTick: vi.fn(), onMelody: vi.fn(), now: () => Date.now(),
    createPercussion: vi.fn(async ({ onEvent }) => { classify = onEvent; return { stop: vi.fn() }; }) };
  return { audio, video, stream, source, analyser, context, deps, engine: createCaptureEngine(deps),
    learned: (band, audioTime = context.currentTime) => classify({ band, audioTime, confidence: .9, classMargin: .4 }) };
}
function percussionSpectrum(array, rate = 48000) {
  array.fill(-Infinity);
  for (const [from, to, db] of [[45, 150, -20], [170, 350, -30], [1500, 5000, -45], [6000, 12000, -50]]) {
    array.fill(db, Math.ceil(from * 2048 / rate), Math.floor(to * 2048 / rate) + 1);
  }
}
it('traces unchanged Bass delivery while acoustic proposals cannot claim drum identities', async () => {
  beatTelemetry.enable();
  const f = fixture(); await f.engine.start('stream', 'traced');
  await vi.advanceTimersByTimeAsync(450);
  f.analyser.getFloatFrequencyData = percussionSpectrum;
  await vi.advanceTimersByTimeAsync(20);
  expect(f.deps.onBeat).toHaveBeenCalled();
  const [id, bands, traces] = f.deps.onBeat.mock.calls[0];
  expect(id).toBe('traced'); expect(bands).toEqual(['bass']);
  expect(traces.map((t) => t.type)).toEqual(['bass']);
  expect(f.engine.renew('traced')).toBe(true);
  f.analyser.getFloatFrequencyData = (array) => array.fill(-Infinity);
  await vi.advanceTimersByTimeAsync(50);
  f.analyser.getFloatFrequencyData = percussionSpectrum;
  f.learned('kick');
  await vi.advanceTimersByTimeAsync(20);
  f.engine.stop();
  const log = beatTelemetry.snapshot();
  for (const stage of ['CAPTURE_START', 'AUDIO_DETECTED', 'LOW_ENERGY', 'CAPTURE_RECOVERED', 'LEASE_RENEW', 'CAPTURE_STOP']) expect(log.counts[stage]).toBeGreaterThan(0);
  expect(log.records.filter((r) => r.id === traces[0].id).map((r) => r.stage)).toEqual(['EVENT_DETECTED', 'EVENT_QUEUED', 'EVENT_SENT']);
});
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
it('analyses native PCM without replaying or doubling browser audio', async () => {
  const f = fixture(), gain = { gain:{value:1}, connect:vi.fn(), disconnect:vi.fn() };
  f.context.createGain = () => gain;
  const engine = createCaptureEngine({...f.deps,monitorOnly:true});
  expect(await engine.start('native-stream','native')).toBe(true);
  expect(gain.gain.value).toBe(0);
  expect(f.source.connect).not.toHaveBeenCalledWith(f.context.destination);
  expect(gain.connect).toHaveBeenCalledWith(f.context.destination);
  await vi.advanceTimersByTimeAsync(100);
  expect(f.deps.onAudible).toHaveBeenCalledWith('native');
  engine.stop(); expect(gain.disconnect).toHaveBeenCalledOnce();
});

it('does not label mixed tonal energy as an instrumental note without AI separation', async () => {
  const f = fixture();
  let tone = true;
  f.analyser.getFloatFrequencyData = (array) => {
    array.fill(-Infinity);
    if (tone) { array[19] = -25; array[38] = -32; array[57] = -36; }
  };
  await f.engine.start('stream', 'melody');
  await vi.advanceTimersByTimeAsync(3000);
  expect(f.deps.onMelody.mock.calls.filter(([, state]) => state.active)).toHaveLength(0);
  expect(f.deps.onTempoTick).not.toHaveBeenCalled();
  tone = false;
  await vi.advanceTimersByTimeAsync(500);
  expect(f.deps.onMelody).not.toHaveBeenCalled();
  f.engine.stop();
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps leased quiet analysis alive without claiming audible capture and resumes on the next frame', async () => {
  const f = fixture();
  f.analyser.getFloatFrequencyData = (array) => array.fill(-Infinity);
  await f.engine.start('stream', 'silent');
  await vi.advanceTimersByTimeAsync(2600);
  expect(f.deps.onAudible).not.toHaveBeenCalled();
  expect(f.deps.onBeat).not.toHaveBeenCalled();
  expect(f.deps.onStop).not.toHaveBeenCalled();
  f.analyser.getFloatFrequencyData = percussionSpectrum;
  f.learned('kick');
  await vi.advanceTimersByTimeAsync(20);
  expect(f.deps.onAudible).toHaveBeenCalledWith('silent');
  expect(f.deps.onBeat.mock.calls.map(call => call.slice(0, 2))).toContainEqual(['silent', ['kick']]);
  f.engine.stop();
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
  expect(f.deps.onTempoTick.mock.calls.map(call => call.slice(0, 2))).toContainEqual(['tempo', expect.objectContaining({ step: expect.any(Number), phase: expect.any(Number), subdivision: 2 })]);
  periodic = false;
  for (let index = 0; index < 3; index++) {
    await vi.advanceTimersByTimeAsync(4000);
    f.engine.renew('tempo');
  }
  expect(f.deps.onTempo.mock.calls.at(-1).slice(0, 2)).toEqual(['tempo', expect.objectContaining({ locked: false, bpm: null })]);
  f.engine.stop();
});
it('keeps dense learned drums in direct onset mode', async () => {
  const f = fixture();
  f.analyser.getFloatFrequencyData = (array) => {
    if (Math.round(Date.now() / (1000 / 60)) % 30 === 0) {
      percussionSpectrum(array);
      for (const band of ['kick', 'clap', 'hat']) f.learned(band);
    }
    else array.fill(-60);
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
it('feeds real kick onsets back into the locked tracker and never uses hats as phase evidence', async () => {
  const f = fixture();
  const snap = vi.spyOn(TempoTracker.prototype, 'snapToBeat');
  let time = 0;
  let sample;
  f.deps.now = () => time;
  Object.defineProperty(f.context, 'currentTime', { get: () => time / 1000 });
  f.deps.schedule = (callback) => { sample = callback; return 1; };
  f.deps.cancel = vi.fn();
  f.analyser.getFloatFrequencyData = (array) => {
    array.fill(-60);
    // Learned identities, with independent off-beat hats. DSP is only energy.
    if (Math.round(time / (1000 / 60)) % 30 === 0) { array.fill(-25, 2, 7); f.learned('kick'); }
    if (Math.round(time / (1000 / 60)) % 30 === 15) { array.fill(-25, 256, 512); f.learned('hat'); }
  };
  const engine = createCaptureEngine(f.deps);
  await engine.start('stream', 'feedback');
  for (let frame = 0; frame < 1200; frame++) {
    time = frame * 1000 / 60;
    engine.renew('feedback');
    sample();
  }
  expect(snap.mock.calls.length).toBeGreaterThan(20);
  expect(snap.mock.calls.every(([now]) => Math.round(now / (1000 / 60)) % 30 === 0)).toBe(true);
  expect(f.deps.onTempoTick).toHaveBeenCalled();
  engine.stop();
});
it('falls back cleanly on capture rejection and releases streams that arrive after cancellation', async () => {
  const failed = fixture();
  failed.deps.getUserMedia.mockRejectedValue(new Error('NotAllowedError'));
  expect(await failed.engine.start('id', 'denied')).toBe(false);
  expect(failed.context.close).toHaveBeenCalledOnce();
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
it('cancels pending inference on stop and rejects stale owner, invalid class and unscored events', async () => {
  const f = fixture(); let listener, signal, finish;
  f.deps.createPercussion = ({ onEvent, signal: aborted }) => {
    listener = onEvent; signal = aborted;
    return new Promise(resolve => { finish = resolve; });
  };
  const engine = createCaptureEngine(f.deps);
  await engine.start('stream', 'pending');
  for (const event of [{ band: 'kick', audioTime: f.context.currentTime },
    { band: 'bass', audioTime: f.context.currentTime, confidence: .9, classMargin: .4 },
    { band: 'kick', audioTime: f.context.currentTime, confidence: .9, classMargin: -.1 }]) listener(event);
  await vi.advanceTimersByTimeAsync(20);
  expect(f.deps.onBeat).not.toHaveBeenCalled();
  engine.stop(); expect(signal.aborted).toBe(true);
  listener({ band: 'kick', audioTime: f.context.currentTime, confidence: .9, classMargin: .4 });
  const stop = vi.fn(); finish({ stop }); await Promise.resolve();
  expect(stop).toHaveBeenCalledOnce(); expect(f.deps.onBeat).not.toHaveBeenCalled();
});
it('preserves learned confidence, original audio time and observable late-event policy', async () => {
  beatTelemetry.enable(); const f = fixture();
  await f.engine.start('stream', 'scored');
  const target = f.context.currentTime - .2;
  f.learned('clap', target);
  await vi.advanceTimersByTimeAsync(20);
  const [id, bands, traces] = f.deps.onBeat.mock.calls[0];
  expect(id).toBe('scored'); expect(bands).toEqual(['clap']);
  expect(traces[0]).toMatchObject({ type: 'snare', confidence: .9, targetTime: target, targetClock: 'audio-seconds' });
  f.learned('hat', f.context.currentTime - 1);
  await vi.advanceTimersByTimeAsync(20);
  expect(f.deps.onBeat).toHaveBeenCalledOnce();
  expect(beatTelemetry.snapshot().counts.EVENT_LATE).toBeGreaterThan(0);
  expect(beatTelemetry.snapshot().records.some(r => r.stage === 'EVENT_DROPPED' && r.reason === 'late')).toBe(true);
  f.engine.stop();
});
