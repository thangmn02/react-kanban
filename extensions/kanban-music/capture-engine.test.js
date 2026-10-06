import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createCaptureEngine, tabConstraints } from './capture-engine.js';
import { TempoTracker } from './tempo-tracker.js';
import { beatTelemetry } from './beat-telemetry.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { beatTelemetry.enable(false); beatTelemetry.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });
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
it('traces lifecycle and detector delivery without changing the detected bands', async () => {
  beatTelemetry.enable();
  const f = fixture(); await f.engine.start('stream', 'traced');
  await vi.advanceTimersByTimeAsync(450);
  f.analyser.getFloatFrequencyData = (array) => array.fill(-20);
  await vi.advanceTimersByTimeAsync(20);
  expect(f.deps.onBeat).toHaveBeenCalled();
  const [id, bands, traces] = f.deps.onBeat.mock.calls[0];
  expect(id).toBe('traced'); expect(bands).toEqual(['kick', 'clap', 'hat', 'bass']);
  expect(traces.map((t) => t.type)).toEqual(['kick', 'snare', 'hat', 'bass']);
  expect(f.engine.renew('traced')).toBe(true);
  f.analyser.getFloatFrequencyData = (array) => array.fill(-Infinity);
  await vi.advanceTimersByTimeAsync(50);
  f.analyser.getFloatFrequencyData = (array) => array.fill(-20);
  await vi.advanceTimersByTimeAsync(20);
  f.engine.stop();
  const log = beatTelemetry.snapshot();
  for (const stage of ['CAPTURE_START', 'AUDIO_DETECTED', 'LOW_ENERGY', 'CAPTURE_RECOVERED', 'LEASE_RENEW', 'CAPTURE_STOP']) expect(log.counts[stage]).toBeGreaterThan(0);
  expect(log.records.filter((r) => r.id === traces[0].id).map((r) => r.stage)).toEqual(['EVENT_DETECTED', 'EVENT_QUEUED', 'EVENT_SENT']);
});
it('reports existing late-event drops and capture lease expiry', async () => {
  beatTelemetry.enable();
  const f = fixture(); let audioTime = 0;
  Object.defineProperty(f.context, 'currentTime', { get: () => audioTime });
  const instrument = { ready: Promise.resolve(), delaySeconds: 3.5, connect() {}, stop() {} };
  const engine = createCaptureEngine({ ...f.deps, createInstrumentCapture: () => instrument });
  await engine.start('stream', 'late'); await vi.advanceTimersByTimeAsync(450);
  f.analyser.getFloatFrequencyData = (array) => array.fill(-20);
  await vi.advanceTimersByTimeAsync(20);
  expect(f.deps.onBeat).not.toHaveBeenCalled();
  audioTime = 4.2; await vi.advanceTimersByTimeAsync(20);
  expect(beatTelemetry.snapshot().records.some((r) => r.stage === 'EVENT_DROPPED' && r.reason === 'late')).toBe(true);
  expect(f.deps.onBeat).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(5600);
  expect(f.deps.onStop).toHaveBeenCalledWith('late', 'expired');
  expect(beatTelemetry.snapshot().counts.LEASE_EXPIRED).toBe(1);
  engine.stop();
});
it('reports a full existing queue and cancellation without extending its capacity', async () => {
  beatTelemetry.enable();
  const f = fixture(); let notes;
  f.context.currentTime = 0;
  const engine = createCaptureEngine({ ...f.deps, createInstrumentCapture: (options) => {
    notes = options.onNotes;
    return { ready: Promise.resolve(), delaySeconds: 3.5, connect() {}, stop() {} };
  } });
  await engine.start('stream', 'full');
  notes(Array.from({ length: 2049 }, (_, note) => ({ time: 10, state: { active: true, level: .5, note } })));
  expect(beatTelemetry.snapshot().records.some((r) => r.stage === 'EVENT_DROPPED' && r.reason === 'queue-full')).toBe(true);
  expect(f.deps.onMelody).not.toHaveBeenCalled();
  engine.stop();
  expect(beatTelemetry.snapshot().counts.EVENT_DROPPED).toBe(2049);
  expect(vi.getTimerCount()).toBe(0);
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
  expect(f.deps.onMelody).toHaveBeenLastCalledWith('melody', expect.objectContaining({ active: false, note: 0 }));
  expect(f.deps.onTempoTick).not.toHaveBeenCalled();
  tone = false;
  await vi.advanceTimersByTimeAsync(500);
  expect(f.deps.onMelody).toHaveBeenLastCalledWith('melody', expect.objectContaining({ active: false, level: 0 }));
  f.engine.stop();
  expect(vi.getTimerCount()).toBe(0);
});

it('schedules individual model notes on the delayed audio timeline and cancels them on stop', async () => {
  const f = fixture();
  const started = Date.now();
  Object.defineProperty(f.context, 'currentTime', { get: () => (Date.now() - started) / 1000 });
  let publish;
  const pipeline = { ready: Promise.resolve(), delaySeconds: 3.5, connect: vi.fn(), stop: vi.fn(), stopAnalysis: vi.fn() };
  f.deps.createInstrumentCapture = ({ onNotes }) => { publish = onNotes; return pipeline; };
  const engine = createCaptureEngine(f.deps);
  await engine.start('stream', 'buffered');
  expect(f.source.connect.mock.calls.filter(([target]) => target === f.context.destination)).toHaveLength(0);
  publish([{ time: .1, state: { active: true, level: .7, note: 1 } }, { time: .19, state: { active: true, level: .8, note: 2 } }]);
  await vi.advanceTimersByTimeAsync(3550);
  expect(f.deps.onMelody.mock.calls.some(([, state]) => state.active)).toBe(false);
  await vi.advanceTimersByTimeAsync(160);
  expect(f.deps.onMelody.mock.calls.filter(([, state]) => state.active).map(([, state]) => state.note)).toEqual([1, 2]);
  publish([{ time: 1, state: { active: true, level: .8, note: 3 } }]);
  engine.stop();
  await vi.advanceTimersByTimeAsync(1000);
  expect(pipeline.stop).toHaveBeenCalledOnce();
  expect(f.deps.onMelody.mock.calls.filter(([, state]) => state.active)).toHaveLength(2);
});

it('leaves original audio connected when AI misses a note deadline', async () => {
  const f = fixture();
  f.context.currentTime = 10;
  let publish;
  const pipeline = { ready: Promise.resolve(), delaySeconds: 3.5, connect: vi.fn(), stop: vi.fn(), stopAnalysis: vi.fn() };
  f.deps.createInstrumentCapture = ({ onNotes }) => { publish = onNotes; return pipeline; };
  const engine = createCaptureEngine(f.deps);
  await engine.start('stream', 'slow');
  publish([{ time: 0, state: { active: true, level: .8, note: 1 } }]);
  expect(pipeline.stopAnalysis).toHaveBeenCalledOnce();
  expect(pipeline.stop).not.toHaveBeenCalled();
  expect(f.deps.onMelody).toHaveBeenLastCalledWith('slow', { active: false, level: 0, note: 0 });
  engine.stop();
});

it('continues ordinary capture without AI delay if model setup stalls', async () => {
  const f = fixture();
  const pipeline = { ready: new Promise(() => {}), stop: vi.fn(), stopAnalysis: vi.fn() };
  f.deps.createInstrumentCapture = () => pipeline;
  const engine = createCaptureEngine(f.deps);
  const started = engine.start('stream', 'stalled');
  expect(f.deps.getUserMedia).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(3010);
  expect(await started).toBe(true);
  expect(engine.delaySeconds).toBe(0);
  expect(f.source.connect).toHaveBeenCalledWith(f.context.destination);
  expect(pipeline.stop).toHaveBeenCalledOnce();
  engine.stop();
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
it('feeds real kick onsets back into the locked tracker and never uses hats as phase evidence', async () => {
  const f = fixture();
  const snap = vi.spyOn(TempoTracker.prototype, 'snapToBeat');
  let time = 0;
  let sample;
  f.deps.now = () => time;
  f.deps.schedule = (callback) => { sample = callback; return 1; };
  f.deps.cancel = vi.fn();
  f.analyser.getFloatFrequencyData = (array) => {
    array.fill(-60);
    // Sparse true FFT kick/bass transients, with independent off-beat hats.
    if (Math.round(time / (1000 / 60)) % 30 === 0) array.fill(-25, 2, 7);
    if (Math.round(time / (1000 / 60)) % 30 === 15) array.fill(-25, 256, 512);
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
