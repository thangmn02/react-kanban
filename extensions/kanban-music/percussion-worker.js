import { PercussionClassifier } from './percussion-classifier.js';
import { CausalPercussionClassifier } from './causal-percussion-classifier.js';
let session, config, ort, running = false, stopped = false, queue = [], frames = [], count = 0, lastTime;
let classifier = new PercussionClassifier();
async function drain() {
  if (running || !session || stopped) return;
  running = true;
  try {
    while (queue.length && !stopped) {
      const block = queue.shift();
      for (let i = 0; i < block.times.length; i++) {
        const time = block.times[i];
        if (lastTime !== undefined && Math.abs(time - lastTime - .01) > .005) {
          frames = []; count = 0; classifier.reset();
        }
        lastTime = time;
        frames.push({ data: block.data.slice(i * config.bins, (i + 1) * config.bins), time });
        if (frames.length > config.windowFrames) frames.shift();
        if (++count % config.stepFrames) continue;
        const input = new Float32Array(config.windowFrames * config.bins);
        const offset = config.windowFrames - frames.length;
        for (let j = 0; j < frames.length; j++) input.set(frames[j].data, (offset + j) * config.bins);
        const began = performance.now();
        const inferenceStartedAt = config.diagnostics ? Date.now() : undefined;
        const output = await session.run({ [config.input]: new ort.Tensor('float32', input,
          [1, config.windowFrames, config.bins, 1]) });
        if (stopped) return;
        const scores = output[config.output].data;
        const events = [];
        const from = config.windowFrames - config.rightContext - config.stepFrames;
        const diagnostics = [];
        for (let j = from; j < from + config.stepFrames; j++) {
          const source = frames[j - offset];
          if (source) {
            const classes = config.scoreClasses || 5;
            const values = Array.from(scores.slice(j * classes, (j + 1) * classes));
            const accepted = classifier.push(values, source.time).events;
            events.push(...accepted);
            if (config.diagnostics) diagnostics.push({ audioTime: source.time, scores: values,
              events: accepted.map(event => ({ ...event, decisionAudioTime: source.time })) });
          }
        }
        self.postMessage({ kind: 'result', events, outcome: events.length ? 'percussion' : 'non-percussion/abstain',
          durationMs: performance.now() - began, queueDepth: queue.length, processedAudioTime: time,
          ...(config.diagnostics ? { diagnostics, postedAt: block.postedAt, workerReceivedAt: block.receivedAt,
            availableAudioTime: block.availableAudioTime, inferenceStartedAt, inferenceEndedAt: Date.now() } : {}) });
      }
    }
  } catch { self.postMessage({ kind: 'failed' }); stopped = true; }
  finally { running = false; }
}
self.onmessage = async ({ data }) => {
  if (data.kind === 'init') {
    try {
      config = data.config;
      classifier = config.classifier === 'causal' ? new CausalPercussionClassifier()
        : new PercussionClassifier(config.thresholds, { onsetGuided: config.classifier === 'onset-guided' });
      // Keep ORT's loader intact and emit its exact assets in production builds.
      const runtimeUrl = new URL('./vendor/percussion/ort.wasm.min.mjs', import.meta.url).href;
      ort = await import(/* @vite-ignore */ runtimeUrl);
      ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
      ort.env.wasm.wasmPaths = {
        mjs: new URL('./vendor/percussion/ort-wasm-simd-threaded.mjs', import.meta.url).href,
        wasm: new URL('./vendor/percussion/ort-wasm-simd-threaded.wasm', import.meta.url).href,
      };
      session = await ort.InferenceSession.create(data.model, { executionProviders: ['wasm'] });
      self.postMessage({ kind: 'ready' }); void drain();
    } catch { self.postMessage({ kind: 'failed' }); stopped = true; }
  }
  if (data.kind === 'frames' && !stopped && data.times?.length === config?.stepFrames
    && data.data?.length === data.times.length * config.bins) {
    if (queue.length >= 3) { queue.shift(); self.postMessage({ kind: 'backlog' }); }
    queue.push({ ...data, ...(config.diagnostics ? { receivedAt: Date.now() } : {}) }); void drain();
  }
};
