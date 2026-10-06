import { instrumentDelay, instrumentSampleRate } from './instrument-models.js';

export function createInstrumentWorker({ progress = () => {}, notes = () => {}, error = () => {}, workerUrl } = {}) {
  const worker = new Worker(workerUrl || new URL('./generated/instrument-worker.js', import.meta.url), { type: 'module' });
  let closed = false, pending = 0, resolve, reject;
  const ready = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  const fail = (message) => {
    if (closed) return;
    closed = true; clearTimeout(timeout); worker.terminate(); reject(new Error(message)); error(message);
  };
  const timeout = setTimeout(() => fail('Instrument model setup timed out'), 180000);
  worker.onerror = () => fail('Instrument model could not start');
  worker.onmessage = ({ data }) => {
    if (closed) return;
    if (data.kind === 'progress') progress(data.bytes, data.total);
    if (data.kind === 'ready') { clearTimeout(timeout); resolve(); }
    if (data.kind === 'error') fail(data.message);
    if (data.kind === 'ack') pending = Math.max(0, pending - 1);
    if (data.kind === 'notes') notes(data.events);
  };
  worker.postMessage({ kind: 'prepare' });
  return { ready, send(data) {
    if (closed) return;
    if (++pending > 96) { fail('Instrument analysis cannot keep up on this device'); return; }
    worker.postMessage(data, [data.left.buffer, data.right.buffer]);
  }, stop() {
    if (closed) return;
    closed = true; clearTimeout(timeout); worker.terminate(); reject(new Error('Instrument analysis stopped'));
  } };
}

export function prepareInstrumentCapture({ context, onNotes, onError }) {
  if (context.sampleRate !== instrumentSampleRate) throw new Error('Unsupported instrument sample rate');
  let worklet, delay, stopped = false;
  const worker = createInstrumentWorker({ notes: onNotes, error: onError });
  const ready = (async () => {
    await worker.ready;
    if (stopped) throw new Error('Instrument analysis stopped');
    await context.audioWorklet.addModule(new URL('./instrument-worklet.js', import.meta.url));
    if (stopped) throw new Error('Instrument analysis stopped');
    worklet = new AudioWorkletNode(context, 'kora-instrument-capture', { outputChannelCount: [2] });
    worklet.port.onmessage = ({ data }) => { if (!stopped) worker.send(data); };
    delay = context.createDelay(instrumentDelay + 1); delay.delayTime.value = instrumentDelay;
    worklet.connect(delay); delay.connect(context.destination);
  })();
  return { ready, delaySeconds: instrumentDelay, connect(source) { source.connect(worklet); }, stopAnalysis() {
    worker.stop(); if (worklet) worklet.port.onmessage = null;
  }, stop() {
    stopped = true; worker.stop(); worklet?.disconnect(); delay?.disconnect();
    if (worklet) worklet.port.onmessage = null;
  } };
}
