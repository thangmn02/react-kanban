import { createCaptureEngine } from './capture-engine.js';
import { beatTelemetry } from './beat-telemetry.js';
const telemetry = beatTelemetry.at('native-audio-engine');

// Feed Windows PCM through the same detector graph as tab capture. The browser
// keeps playing normally: this graph only analyses and never replays its audio.
export function createNativeAudioEngine(options) {
  let context, destination, nextTime = 0, live = false, ready = false, generation = 0;
  const sources = new Set();
  const engine = createCaptureEngine({ ...options, monitorOnly: true,
    createAudioContext() {
      context = new AudioContext({ sampleRate: 44100, latencyHint: 'interactive' });
      destination = context.createMediaStreamDestination();
      return context;
    },
    getUserMedia: async () => destination.stream,
  });
  return {
    async start(id) {
      const request = ++generation;
      live = true; ready = false; nextTime = 0;
      if (!await engine.start('', id) || request !== generation) return false;
      // A running context may still be opening its Windows output device. Do
      // not queue captured PCM until its rendering clock actually advances.
      const initialTime = context.currentTime, deadline = performance.now() + 2000;
      while (live && request === generation && context.state === 'running' && context.currentTime <= initialTime) {
        if (performance.now() >= deadline) { this.stop('audio-context-stalled'); return false; }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      ready = live && request === generation && context.state === 'running';
      return ready;
    },
    push(samples, diagnostic) {
      if (!ready || !live || !context || context.state !== 'running' || !samples.length || samples.length % 2) { telemetry.record('EVENT_DROPPED', undefined, { reason: 'invalid' }); return false; }
      const duration = samples.length / 2 / 44100;
      if (Math.max(nextTime - context.currentTime, .02) + duration > .3) { telemetry.record('EVENT_DROPPED', undefined, { reason: 'audio-backlog', delayMs: (nextTime - context.currentTime) * 1000 }); return false; }
      const buffer = context.createBuffer(2, samples.length / 2, 44100);
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      for (let frame = 0; frame < left.length; frame++) { left[frame] = samples[frame * 2]; right[frame] = samples[frame * 2 + 1]; }
      const source = context.createBufferSource(); source.buffer = buffer; source.connect(destination);
      sources.add(source);
      source.onended = () => { source.disconnect(); sources.delete(source); };
      nextTime = Math.max(nextTime, context.currentTime + .02);
      source.start(nextTime); nextTime += buffer.duration;
      telemetry.record('EVENT_QUEUED', undefined, { audioTime: context.currentTime, delayMs: (nextTime - context.currentTime) * 1000, queueDepth: sources.size, frames: samples.length / 2, sequence: diagnostic?.sequence });
      return true;
    },
    renew(id) { return engine.renew(id); },
    stop(reason = 'stopped') {
      live = false; ready = false; generation++;
      for (const source of sources) { try { source.stop(); } catch { /* An ended source is already released. */ } source.disconnect(); }
      sources.clear(); engine.stop(reason);
    },
  };
}
