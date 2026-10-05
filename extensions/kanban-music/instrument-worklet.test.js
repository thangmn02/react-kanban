import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());
it('passes original audio once and preserves sample time through missing input quanta', async () => {
  let Processor;
  vi.stubGlobal('AudioWorkletProcessor', class { port = { postMessage: vi.fn() }; });
  vi.stubGlobal('registerProcessor', (_, value) => { Processor = value; });
  vi.stubGlobal('currentFrame', 0);
  await import('./instrument-worklet.js');
  const processor = new Processor();
  for (let quantum = 0; quantum < 32; quantum++) {
    globalThis.currentFrame = quantum * 128;
    const input = quantum === 7 ? [] : [new Float32Array(128).fill(.25)];
    const output = [new Float32Array(128), new Float32Array(128)];
    expect(processor.process([input], [output])).toBe(true);
    expect(output[0][0]).toBe(quantum === 7 ? 0 : .25);
    expect(output[1]).toEqual(output[0]);
  }
  const packets = processor.port.postMessage.mock.calls.map(([message]) => message);
  expect(packets.map((packet) => packet.startFrame)).toEqual([0, 2048]);
  expect(packets[0].left[7 * 128]).toBe(0);
  expect(packets[0].left[8 * 128]).toBe(.25);
  expect(packets.every((packet) => packet.left.length === 2048 && packet.right.length === 2048)).toBe(true);
});
