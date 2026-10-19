// Real ONNX/AudioWorklet and renderer verification on local PCM. No live-browser
// or listening-accuracy claim: isolated stems/predictions are not human labels.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { chromium } from '@playwright/test';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const proof = resolve(repo, 'scratch/beat-runtime-proof');
const output = resolve(proof, 'built');
const seconds = Number(process.env.KORA_BEAT_PROOF_SECONDS || 8);
assert(Number.isFinite(seconds) && seconds >= 3 && seconds <= 1800);
const inputs = process.env.KORA_BEAT_PROOF_INPUTS?.split(',').filter(Boolean)
  || ['fixture-0-drums.f32', 'fixture-0-mixture.f32', 'fixture-0-vocals.f32'];
assert(inputs.every(name => /^[a-z0-9-]+\.f32$/i.test(name)));
const fullInput = process.env.KORA_BEAT_PROOF_FULL_INPUT === '1';
const candidate=process.env.KORA_BEAT_CLASSIFIER==='onset-guided'?'onset-guided':'baseline';
const resultName=process.env.KORA_BEAT_PROOF_RESULT;
assert(!resultName||/^[a-z0-9-]+\.json$/.test(resultName),'Result must be a local JSON filename');
const inputFolder=process.env.KORA_BEAT_SYNTHETIC==='1'?'scratch/browser-first-corpus':'scratch/instrument-proof';
const modelConfig = JSON.parse(await readFile(resolve(repo, 'extensions/kanban-music/generated/percussion/percussion.json'), 'utf8'));
const modelHash = createHash('sha256').update(await readFile(resolve(repo, 'extensions/kanban-music/generated/percussion/percussion.onnx'))).digest('hex');
assert.equal(modelHash, modelConfig.sha256, 'Model bytes do not match their manifest');
await mkdir(proof, { recursive: true });
const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import BeatPattern from '../../src/features/music/BeatPattern.tsx';
import '../../src/components/focus/floatingFocus.css';
import { createPercussionRuntime } from '../../extensions/kanban-music/percussion-runtime.js';
import { beatTelemetry } from '../../extensions/kanban-music/beat-telemetry.js';
const root = createRoot(document.querySelector('#grid'));
beatTelemetry.enable();
window.prove = async (url, requestedSeconds, fullInput) => {
  const context = new AudioContext({ sampleRate: 44100 });
  await context.resume();
  const bytes = await (await fetch(url)).arrayBuffer();
  const pcm = new Float32Array(bytes);
  const buffer = context.createBuffer(2, pcm.length / 2, 44100);
  const seconds = fullInput ? buffer.duration : requestedSeconds;
  for (let channel = 0; channel < 2; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let frame = 0; frame < samples.length; frame++) samples[frame] = pcm[frame * 2 + channel];
  }
  const source = context.createBufferSource(); source.buffer = buffer; source.loop = seconds > buffer.duration + 1e-6;
  let audioOrigin = Infinity;
  let state = { sessionId: 'proof', mode: 'capture', captureId: 'proof', onsets: {}, rates: { kick: 1, clap: 1, hat: 1 } };
  const render = () => root.render(<BeatPattern session={{ id: 'proof', playing: true, paused: false, currentTime: 8 }} beat={state} />);
  render();
  const counts = { kick: 0, clap: 0, hat: 0 }, latency = [], renderLatency = [], failures = [], events = [], activations = [];
  let eventsTruncated = false, activationsTruncated = false;
  const decisions = new Map(), eventByTrace = new Map();
  const diagnostic = { audioLookahead: [], decisionLookahead: [], workletToWorker: [], workerQueue: [], inference: [], workerToMain: [], mainAudioAge: [] };
  const sample = (name, value) => {
    if (!Number.isFinite(value)) return;
    diagnostic[name].push(value);
    if (diagnostic[name].length > 2000) diagnostic[name].shift();
  };
  let batches = 0, maxQueue = 0, frames = 0, lastFrame = 0, maxFrameGap = 0, running = true;
  const observed = new Set(), deadlines = new Map();
  const frame = at => {
    if (!running) return;
    if (lastFrame) maxFrameGap = Math.max(maxFrameGap, at - lastFrame);
    lastFrame = at; frames++;
    for (const cell of document.querySelectorAll('.semantic-beat-flash[data-beat-trace]')) {
      const id = cell.dataset.beatTrace;
      if (!observed.has(id) && Number(getComputedStyle(cell).opacity) >= .5 && deadlines.has(id)) {
        observed.add(id); renderLatency.push((context.currentTime - deadlines.get(id)) * 1000);
        const saved = eventByTrace.get(id);
        if (saved) saved.visibleAudioTime = context.currentTime;
        if (renderLatency.length > 2000) renderLatency.shift();
      }
    }
    if (observed.size > 2000) observed.clear();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  let runtime;
  try {
    const startup = performance.now();
    runtime = await createPercussionRuntime({ context, source, classifier: ${JSON.stringify(candidate)},
      onFailure: reason => failures.push(reason),
      onProgress: () => batches++,
      onDiagnostic: result => {
        maxQueue = Math.max(maxQueue, result.queueDepth || 0);
        sample('workletToWorker', result.workerReceivedAt - result.postedAt);
        sample('workerQueue', result.inferenceStartedAt - result.workerReceivedAt);
        sample('inference', result.inferenceEndedAt - result.inferenceStartedAt);
        sample('workerToMain', result.mainThreadReceivedAt - result.inferenceEndedAt);
        for (const frame of result.diagnostics || []) {
          if (Number.isFinite(audioOrigin)) {
            if (activations.length < 100000) activations.push({ ...frame, excerptTime: frame.audioTime - audioOrigin,
              availableAudioTime: result.availableAudioTime, modelInputAudioTime: result.timing?.modelInputAudioTime,
              inferenceStartedAt: result.inferenceStartedAt, inferenceEndedAt: result.inferenceEndedAt });
            else activationsTruncated = true;
          }
          for (const event of frame.events || []) {
            if (event.audioTime < audioOrigin || event.audioTime >= audioOrigin + seconds) continue;
            decisions.set(event.band + ':' + event.audioTime, { decisionAudioTime: event.decisionAudioTime,
              availableAudioTime: result.availableAudioTime, receivedAudioTime: result.receivedAudioTime,
              workerReceivedAt: result.workerReceivedAt, inferenceStartedAt: result.inferenceStartedAt,
              inferenceEndedAt: result.inferenceEndedAt, mainThreadReceivedAt: result.mainThreadReceivedAt });
            sample('audioLookahead', (result.availableAudioTime - event.audioTime) * 1000);
            sample('decisionLookahead', (event.decisionAudioTime - event.audioTime) * 1000);
            sample('mainAudioAge', (result.receivedAudioTime - event.audioTime) * 1000);
          }
        }
      },
      onEvent(event) {
        if (event.audioTime < audioOrigin || event.audioTime >= audioOrigin + seconds) return;
        counts[event.band]++;
        const key = event.band + ':' + event.audioTime;
        const saved = { band: event.band, audioTime: event.audioTime, excerptTime: event.audioTime - audioOrigin,
          confidence: event.confidence, classMargin: event.classMargin, scores: event.scores, ...decisions.get(key) };
        decisions.delete(key);
        if (events.length < 256) events.push(saved); else eventsTruncated = true;
        latency.push((context.currentTime - event.audioTime) * 1000);
        if (latency.length > 2000) latency.shift();
        const trace = beatTelemetry.events('onset', [event.band], { confidence: event.confidence })[0];
        eventByTrace.set(trace.id, saved);
        if (eventByTrace.size > 2000) eventByTrace.delete(eventByTrace.keys().next().value);
        trace.targetPlaybackTime = event.audioTime; trace.eventSource = 'local'; trace.origin = 'local-detector';
        deadlines.set(trace.id, event.audioTime);
        if (deadlines.size > 2000) deadlines.delete(deadlines.keys().next().value);
        state = { ...state, onsets: { ...state.onsets, [event.band]: counts[event.band] },
          telemetry: { ...state.telemetry, ['onset:' + (event.band === 'clap' ? 'snare' : event.band)]: trace } };
        render();
      },
    });
    if (!runtime) throw new Error('Real production percussion runtime did not initialize');
    const startupMs = performance.now() - startup;
    audioOrigin = context.currentTime + .05;
    source.start(audioOrigin);
    if (!source.loop) source.stop(audioOrigin + Math.min(seconds, buffer.duration));
    frames = 0; lastFrame = 0; maxFrameGap = 0;
    const began = performance.now();
    // Continue processing silence to finalize the excerpt's last real attacks.
    await new Promise(done => setTimeout(done, (seconds + .5) * 1000));
    const elapsed = performance.now() - began;
    const summary = values => {
      const sorted = values.slice().sort((a, b) => a - b);
      return { measured: sorted.length, medianMs: sorted[Math.floor(sorted.length / 2)] ?? null,
        p95Ms: sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)] ?? null,
        p99Ms: sorted[Math.max(0, Math.ceil(sorted.length * .99) - 1)] ?? null, maxMs: sorted.at(-1) ?? null };
    };
    return { input: url, seconds, inputDuration: buffer.duration, audioOrigin, looped: source.loop,
      startupMs, batches, counts, events, eventsTruncated, activations, activationsTruncated, failures, maxQueue,
      stages: Object.fromEntries(Object.entries(diagnostic).map(([name, values]) => [name, summary(values)])),
      latency: summary(latency), visibleFlash: summary(renderLatency), fps: frames / (elapsed / 1000), maxFrameGap };
  } finally {
    running = false; runtime?.stop(); try { source.stop(); } catch {} source.disconnect(); await context.close();
  }
};
`;
await writeFile(resolve(proof, 'proof.jsx'), fixture);
await writeFile(resolve(proof, 'index.html'), '<!doctype html><title>Real Beat Grid runtime verification</title><div id="grid" style="width:520px"></div><script type="module" src="./proof.jsx"></script>');
await build({ root: proof, configFile: resolve(repo, 'vite.config.ts'), logLevel: 'error',
  build: { outDir: output, copyPublicDir: false, emptyOutDir: true } });

const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const base = path.startsWith('/pcm/') ? resolve(repo, inputFolder) : output;
    const file = path.startsWith('/pcm/') ? resolve(base, path.slice(5)) : resolve(base, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(base + sep)) throw Error('Path outside verification root');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; worker-src 'self'; object-src 'none'");
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' })[extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end(); }
});
let browser;
const results = [];
try {
  await new Promise((done, fail) => { server.once('error', fail); server.listen(1431, '127.0.0.1', done); });
  console.log(JSON.stringify({ pid: process.pid, port: 1431, project: repo, browser: process.env.KORA_TEST_BROWSER || 'msedge' }));
  browser = await chromium.launch({ channel: process.env.KORA_TEST_BROWSER || 'msedge', headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:1431');
  for (const input of inputs) {
    const result = await page.evaluate(([input, seconds, fullInput]) => window.prove('/pcm/' + input, seconds, fullInput), [input, seconds, fullInput]);
    assert(result.batches > seconds * 5, 'Inference did not make sustained progress');
    assert.equal(result.failures.length, 0, 'Inference failed during real audio');
    if (input.includes('drums')) assert(Object.values(result.counts).some(count => count > 0), 'Drum fixture delivered no attacks');
    results.push(result);
    const { events, activations, ...summary } = result;
    console.log(JSON.stringify({ ...summary, savedEvents: events.length, savedActivations: activations.length }));
    if (seconds > 30) break; // Long runs use one sustained real-audio stream.
  }
  assert.deepEqual(errors, [], 'Production runtime produced page errors');
  const { filterbank, ...model } = modelConfig;
  void filterbank;
  await writeFile(resolve(proof, resultName||(process.env.KORA_BEAT_SYNTHETIC==='1'?`synthetic-${candidate}.json`:`result-${candidate}.json`)), JSON.stringify({ browser: await browser.version(), model,candidate,
    results, pageErrors: errors, scope: 'Local real PCM/model/worklet/renderer, not live services or human-scored accuracy' }, null, 2));
} finally { await browser?.close(); if (server.listening) await new Promise(done => server.close(done)); }
