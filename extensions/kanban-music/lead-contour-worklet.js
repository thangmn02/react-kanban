import { createLeadContourTracker, LEAD_CONTOUR_VERSION } from './lead-contour-tracker.js';

// Source-aware Lead tracker on the audio rendering thread. Output is silent; only note attacks
// (audio time, kind, confidence, optional pitch and a timbral source estimate) leave this thread.
class LeadContourProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ownership = options?.processorOptions?.ownership;
    this.tracker = createLeadContourTracker(sampleRate);
    this.mono = new Float32Array(128);
    this.blocks = 0; this.busyMs = 0; this.live = true;
    this.port.onmessage = ({ data }) => {
      if (data?.kind === 'reset') { this.tracker.reset(); this.ownership = data.ownership ?? this.ownership; }
      if (data?.kind === 'stop') this.live = false;
    };
  }
  process(inputs) {
    if (!this.live) return false;
    const channels = inputs[0];
    if (!channels?.[0]) return true;
    const length = channels[0].length;
    if (this.mono.length !== length) this.mono = new Float32Array(length);
    for (let i = 0; i < length; i++) { let sum = 0; for (const channel of channels) sum += channel[i]; this.mono[i] = sum / channels.length; }
    const started = Date.now();
    const events = this.tracker.push(this.mono, (currentFrame + length) / sampleRate);
    this.busyMs += Date.now() - started;
    if (events.length) this.port.postMessage({ kind: 'events', ownership: this.ownership, version: LEAD_CONTOUR_VERSION,
      events, renderedAt: (currentFrame + length) / sampleRate });
    if (++this.blocks % 345 === 0) {
      const { owner, acquired, switched } = this.tracker.ownership;
      this.port.postMessage({ kind: 'stats', ownership: this.ownership, frames: this.tracker.stats.frames,
        voicedFrames: this.tracker.stats.voicedFrames, onsets: this.tracker.stats.onsets, switches: this.tracker.stats.switches,
        owner: owner ? { source: owner.source.source, confidence: owner.source.confidence } : null, acquiredAt: acquired?.time ?? null,
        switchedAt: switched?.time ?? null, busyMs: this.busyMs, renderedAt: currentFrame / sampleRate });
      this.busyMs = 0;
    }
    return true;
  }
}
registerProcessor('kora-lead-contour', LeadContourProcessor);
