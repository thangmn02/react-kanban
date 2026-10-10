import { afterEach, expect, it, vi } from 'vitest';
import { createLeadAudioTap, LEAD_AUDIO_VERSION } from './lead-audio-tap.js';
import { authorizedLeadAudio } from './lead-audio-authorization.js';
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
const asset = { provider: 'kora-development', id: 'a'.repeat(64) };
const sourceUrl = `https://private-test.example/kora-lead-test/${asset.id}.wav`;
const session = { asset, src: sourceUrl }, sender = { url: 'http://127.0.0.1:5173/focus' };

it('requires a short-lived exact-source operator grant separately from capture permission', () => {
  const now = Date.now(), scope = { asset, sourceUrl, analysisVersion: LEAD_AUDIO_VERSION, expiresAt: now + 1000 };
  expect(authorizedLeadAudio(scope, session, sender, now)).toBe(true);
  for (const invalid of [undefined, { ...scope, expiresAt: now - 1 }, { ...scope, expiresAt: now + 4000000 },
    { ...scope, analysisVersion: 'old' }, { ...scope, asset: { ...asset, id: 'xxxxxxxxxxx' } }]) {
    expect(authorizedLeadAudio(invalid, session, sender, now)).toBeFalsy();
  }
  for (const invalid of [{ url: 'https://koraspace.online/focus' }, { ...sender, native: 'native' }, { url: 'broken' }]) {
    expect(authorizedLeadAudio(scope, session, invalid, now)).toBeFalsy();
  }
});

it('keeps one private PCM packet, consumes it once and disconnects only the tap', async () => {
  let node;
  class Node { constructor() { node = this; this.port = { postMessage: vi.fn(), close: vi.fn() }; this.connect = vi.fn(); this.disconnect = vi.fn(); } }
  const context = { sampleRate: 44100, destination: {}, audioWorklet: { addModule: vi.fn() } };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const tap = await createLeadAudioTap({ context, source, Node });
  const first = new Int16Array(8820).fill(2000), next = new Int16Array(8820).fill(1000);
  node.port.onmessage({ data: { samples: first.buffer, sequence: 1, endTime: .2 } });
  node.port.onmessage({ data: { samples: next.buffer, sequence: 2, endTime: .4 } });
  expect(first.every(value => value === 0)).toBe(true);
  expect(tap.read()).toMatchObject({ sequence: 2, endTime: .4, pcm: expect.any(String) });
  expect(next.every(value => value === 0)).toBe(true);
  expect(tap.read()).toBeUndefined();
  tap.stop();
  expect(source.disconnect).toHaveBeenCalledExactlyOnceWith(node);
  expect(node.port.close).toHaveBeenCalledOnce();
  expect(node.port.onmessage).toBeNull();
});

it('binds first-party capture consent to the actual source bytes URL', () => {
  const asset = { provider: 'kora-development', id: 'a'.repeat(64) };
  const sourceUrl = `https://private-test.example/kora-lead-test/${asset.id}.wav`;
  const scope = { asset, sourceUrl, analysisVersion: LEAD_AUDIO_VERSION, expiresAt: Date.now() + 60000 };
  expect(authorizedLeadAudio(scope, { asset, src: sourceUrl }, sender)).toBe(true);
  expect(authorizedLeadAudio(scope, { asset, src: 'https://other.example/audio.wav' }, sender)).toBe(false);
  const provider = { provider: 'youtube', id: 'abcdefghijk' };
  expect(authorizedLeadAudio({ ...scope, asset: provider }, { asset: provider, src: sourceUrl }, sender)).toBe(false);
});

it('bounds worklet-port backlog and reports dropped blocks in the sequence', async () => {
  let Processor;
  vi.stubGlobal('AudioWorkletProcessor', class { constructor() { this.port = { postMessage: vi.fn() }; } });
  vi.stubGlobal('registerProcessor', (_name, value) => { Processor = value; });
  vi.stubGlobal('sampleRate', 44100);
  vi.stubGlobal('currentFrame', 0);
  await import('./lead-audio-worklet.js');
  const processor = new Processor(), input = [new Float32Array(128).fill(.3)];
  for (let index = 0; index < 210; index++) { globalThis.currentFrame = index * 128; processor.process([input]); }
  expect(processor.port.postMessage).toHaveBeenCalledTimes(1);
  expect(processor.port.postMessage.mock.calls[0][0]).toMatchObject({ sequence: 1, endTime: .2 });
  processor.port.onmessage('ack');
  for (let index = 210; index < 280; index++) { globalThis.currentFrame = index * 128; processor.process([input]); }
  expect(processor.port.postMessage).toHaveBeenCalledTimes(2);
  expect(processor.port.postMessage.mock.calls[1][0].sequence).toBe(4);
  expect(processor.samples.length).toBe(8820);
});
