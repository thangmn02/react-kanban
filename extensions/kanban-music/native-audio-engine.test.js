import { afterEach, expect, it, vi } from 'vitest';
import { createNativeAudioEngine } from './native-audio-engine.js';
const state = vi.hoisted(() => ({ context: undefined, capture: { start: vi.fn(), stop: vi.fn(), renew: vi.fn() } }));
vi.mock('./capture-engine.js', () => ({ createCaptureEngine(options) {
  state.capture.start.mockImplementation(async () => { options.createAudioContext(); return true; });
  return state.capture;
} }));
class TestContext {
  currentTime = 0; state = 'running';
  constructor() { state.context=this; }
  createMediaStreamDestination() { return { stream:{} }; }
  createBuffer(_channels, frames, rate) { return { duration:frames/rate, getChannelData:()=>new Float32Array(frames) }; }
  createBufferSource() { return {connect:vi.fn(),start:vi.fn(),stop:vi.fn(),disconnect:vi.fn()}; }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('waits for the real rendering clock before accepting captured PCM', async () => {
  vi.useFakeTimers(); vi.stubGlobal('AudioContext',TestContext);
  const engine=createNativeAudioEngine({}), pending=engine.start('capture');
  await vi.advanceTimersByTimeAsync(100);
  expect(engine.push(new Float32Array(882))).toBe(false);
  state.context.currentTime=.02;
  await vi.advanceTimersByTimeAsync(20);
  expect(await pending).toBe(true);
  engine.stop();
});
it('fails a stalled context and cannot revive a cancelled startup', async () => {
  vi.useFakeTimers();vi.stubGlobal('AudioContext',TestContext);
  const engine=createNativeAudioEngine({}), pending=engine.start('capture');
  await vi.advanceTimersByTimeAsync(2020);
  expect(await pending).toBe(false);
  expect(state.capture.stop).toHaveBeenCalledWith('audio-context-stalled');
  const cancelled=engine.start('next');
  await vi.advanceTimersByTimeAsync(1);engine.stop();state.context.currentTime=.02;
  await vi.advanceTimersByTimeAsync(20);
  expect(await cancelled).toBe(false);
});
it('rejects a single packet that would exceed the live queue budget', async () => {
  vi.useFakeTimers();vi.stubGlobal('AudioContext',TestContext);
  const engine=createNativeAudioEngine({}), pending=engine.start('capture');
  await vi.advanceTimersByTimeAsync(1);state.context.currentTime=.02;
  await vi.advanceTimersByTimeAsync(20);expect(await pending).toBe(true);
  expect(engine.push(new Float32Array(44100*2))).toBe(false);
  expect(engine.push(new Float32Array(882*2))).toBe(true);
  engine.stop();
});
