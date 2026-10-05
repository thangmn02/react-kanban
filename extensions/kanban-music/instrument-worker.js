import * as ort from 'onnxruntime-web/wasm';
import FFT from 'fft.js';
import { models, modelCache, loadModel, instrumentSampleRate, modelFrames, modelBins } from './instrument-models.js';
import { resizeModelWindow } from './model-window.js';
import { InstrumentNoteTracker } from './instrument-note-tracker.js';

ort.env.wasm.numThreads = 1; // Offscreen extension pages are not cross-origin isolated.
ort.env.wasm.wasmPaths = new URL(/* @vite-ignore */ '../vendor/', import.meta.url).href;
const hop = 1024, fftSize = 4096, stride = 64, contextFrames = 32;
const capacity = instrumentSampleRate * 8;
const ring = [new Float32Array(capacity), new Float32Array(capacity)];
const fft = new FFT(fftSize), complex = fft.createComplexArray();
const window = Float32Array.from({ length: fftSize }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / fftSize));
const samples = new Float32Array(fftSize);
const tracker = new InstrumentNoteTracker();
let sessions, preparing, baseFrame, received = 0, nextFrame = 0, busy = false, failed = false;
const send = (message) => self.postMessage(message);
function fail(error) {
  if (failed) return;
  failed = true; send({ kind: 'error', message: String(error?.message || 'Instrument analysis failed').slice(0, 160) });
}
async function prepare() {
  const cache = await caches.open(modelCache);
  sessions = [];
  let loaded = 0;
  const total = models.reduce((sum, model) => sum + model.bytes, 0);
  for (const model of models) {
    const bytes = await loadModel(model, { cache, progress: (count) => send({ kind: 'progress', bytes: loaded + count, total }) });
    const session = await ort.InferenceSession.create(resizeModelWindow(bytes, modelFrames), { executionProviders: ['wasm'] });
    sessions.push(session); loaded += model.bytes;
  }
  // Check the actual operators/backend before delaying any tab audio.
  const x = new ort.Tensor('float32', new Float32Array(2 * modelFrames * modelBins), [2, 1, modelFrames, modelBins]);
  for (const session of sessions) {
    const result = await session.run({ x }); result.y.dispose();
  }
  x.dispose(); send({ kind: 'ready' });
}
async function pump() {
  if (busy || failed || !sessions || baseFrame === undefined) return;
  busy = true;
  try {
    while (received >= (nextFrame + stride + contextFrames - 1) * hop + fftSize / 2) {
      if (received - Math.max(0, (nextFrame - contextFrames) * hop - fftSize / 2) >= capacity) throw new Error('Instrument analysis cannot keep up');
      const data = new Float32Array(2 * modelFrames * modelBins);
      for (let channel = 0; channel < 2; channel++) for (let frame = 0; frame < modelFrames; frame++) {
        const at = (nextFrame + frame - contextFrames) * hop - fftSize / 2;
        for (let sample = 0; sample < fftSize; sample++) {
          const position = at + sample;
          samples[sample] = (position < 0 ? 0 : ring[channel][position % capacity]) * window[sample];
        }
        fft.realTransform(complex, samples);
        const offset = (channel * modelFrames + frame) * modelBins;
        for (let bin = 0; bin < modelBins; bin++) data[offset + bin] = Math.hypot(complex[bin * 2], complex[bin * 2 + 1]);
      }
      const x = new ort.Tensor('float32', data, [2, 1, modelFrames, modelBins]);
      const outputs = [];
      try {
        for (const session of sessions) outputs.push((await session.run({ x })).y);
        const events = [], spectra = new Float32Array(modelFrames * modelBins);
        const bassPowers = new Float64Array(modelFrames), otherPowers = new Float64Array(modelFrames), mixPowers = new Float64Array(modelFrames);
        for (let frame = contextFrames - 16; frame < contextFrames + stride + 16; frame++) {
          let otherEnergy = 0, bassEnergy = 0, mixEnergy = 0;
          for (let bin = 0; bin < modelBins; bin++) {
            let amplitude = 0;
            for (let channel = 0; channel < 2; channel++) {
              const index = (channel * modelFrames + frame) * modelBins + bin;
              let total = 1e-10;
              for (const output of outputs) total += output.data[index] ** 2;
              const mask = outputs[3].data[index] ** 2 / total;
              if (!Number.isFinite(mask)) throw new Error('Invalid model output');
              const value = data[index] * mask;
              const bass = data[index] * outputs[2].data[index] ** 2 / total;
              bassEnergy += bass * bass;
              otherEnergy += value * value; mixEnergy += data[index] ** 2;
              // Reject bins assigned to vocals, drums or bass. The other stem
              // is used for visual analysis; original audio remains untouched.
              amplitude += mask >= .55 ? value : 0;
            }
            spectra[frame * modelBins + bin] = amplitude * .5;
          }
          bassPowers[frame] = bassEnergy; otherPowers[frame] = otherEnergy; mixPowers[frame] = mixEnergy;
        }
        for (let frame = contextFrames; frame < contextFrames + stride; frame++) {
          let bass = 0, other = 0;
          for (let offset = -16; offset <= 16; offset++) {
            const weight = 1 - Math.abs(offset) / 17;
            bass += bassPowers[frame + offset] * weight; other += otherPowers[frame + offset] * weight;
          }
          const frameTime = (baseFrame + (nextFrame + frame - contextFrames) * hop) / instrumentSampleRate;
          // Classify a phrase using context already buffered for inference.
          // Bass attack tails must not become a second instrumental voice.
          const state = tracker.analyze(spectra.subarray(frame * modelBins, (frame + 1) * modelBins), frameTime * 1000,
            bass > other * 1.5 ? 0 : otherPowers[frame] / Math.max(1e-10, mixPowers[frame]));
          if (state) events.push({ time: frameTime, state });
        }
        send({ kind: 'notes', events }); nextFrame += stride;
      } finally { x.dispose(); outputs.forEach((output) => output.dispose()); }
    }
  } catch (error) { fail(error); }
  finally { busy = false; }
}
self.onmessage = ({ data }) => {
  if (data?.kind === 'prepare') {
    preparing ||= prepare().catch(fail); return;
  }
  if (data?.kind !== 'pcm' || failed || !sessions) return;
  const { left, right, startFrame } = data;
  if (!(left instanceof Float32Array) || !(right instanceof Float32Array) || left.length !== right.length
    || left.length > 4096 || !Number.isSafeInteger(startFrame)) { fail(new Error('Invalid captured audio')); return; }
  baseFrame ??= startFrame;
  const gap = startFrame - baseFrame - received;
  if (gap < 0 || gap > 2048) { fail(new Error('Captured audio discontinuity')); return; }
  // Connecting a MediaStream can skip a few rendering quanta. Preserve the
  // absolute playback timeline with silence; never slide all subsequent notes.
  for (let sample = 0; sample < gap; sample++) {
    ring[0][received % capacity] = 0; ring[1][received % capacity] = 0; received++;
  }
  for (let sample = 0; sample < left.length; sample++) {
    ring[0][received % capacity] = left[sample]; ring[1][received % capacity] = right[sample]; received++;
  }
  send({ kind: 'ack' }); void pump();
};
