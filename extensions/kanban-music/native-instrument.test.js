import { afterEach, expect, it, vi } from 'vitest';
import { createNativeInstrument, getNativeInstrumentStatus, setNativeInstrumentEnabled } from './native-instrument.js';

let instrument;
afterEach(() => { instrument?.stop(); setNativeInstrumentEnabled(false); vi.useRealTimers(); });
function setup() {
  let callbacks;
  const send = vi.fn(), stop = vi.fn();
  const output = vi.fn();
  instrument = createNativeInstrument(output, (options) => {
    callbacks = options;
    return { ready: Promise.resolve(), send, stop };
  });
  return { get callbacks() { return callbacks; }, send, stop, output };
}
it('feeds real stereo PCM in bounded continuous blocks after model readiness', async () => {
  setNativeInstrumentEnabled(true);
  const test = setup(); await Promise.resolve();
  const left = new Float32Array(5000).fill(.2), right = new Float32Array(5000).fill(.3);
  instrument.push(left, right);
  expect(test.send.mock.calls.map(([packet]) => [packet.startFrame, packet.left.length])).toEqual([[0,4096],[4096,904]]);
  expect(test.send.mock.calls[0][0].right[0]).toBeCloseTo(.3);
  expect(getNativeInstrumentStatus()).toBe('ready');
});
it('sends a late batch ahead with preserved attack spacing and cancels its reserve on pause', async () => {
  vi.useFakeTimers(); setNativeInstrumentEnabled(true);
  const test = setup(); await Promise.resolve(); test.output.mockClear();
  test.callbacks.notes([0, .5, 1, 1.5].map((time, note) => ({time, state:{active:true,level:.8,note:note+1}})));
  expect(test.output).toHaveBeenCalledTimes(4);
  const targets = test.output.mock.calls.map(([, , timing]) => timing.targetOutputTime);
  expect(targets.map((at) => at - targets[0])).toEqual([0, 500, 1000, 1500]);
  expect(targets[0]).toBeCloseTo(Date.now() + 500);
  instrument.stop(); test.output.mockClear();
  await vi.advanceTimersByTimeAsync(3000); expect(test.output).not.toHaveBeenCalled();
});
it('failed or disabled analysis cannot publish a late note from its old worker', async () => {
  vi.useFakeTimers(); setNativeInstrumentEnabled(true);
  const test = setup(); await Promise.resolve();
  test.callbacks.error('too slow');
  expect(getNativeInstrumentStatus()).toBe('failed'); test.output.mockClear();
  test.callbacks.notes([{time:0,state:{active:true,level:1,note:1}}]);
  await vi.advanceTimersByTimeAsync(1000); expect(test.output).not.toHaveBeenCalled();
  expect(test.stop).toHaveBeenCalled();
});
