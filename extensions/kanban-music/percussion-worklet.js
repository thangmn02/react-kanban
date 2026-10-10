import { PercussionFeatures } from './percussion-features.js';
class PercussionProcessor extends AudioWorkletProcessor {
  constructor(options) { super(); this.features = new PercussionFeatures(options.processorOptions); }
  process(inputs) {
    this.features.push(inputs[0] || [], currentFrame / sampleRate,
      message => this.port.postMessage(message, [message.data.buffer]));
    // Analysis only; output remains silent and does not duplicate browser audio.
    return true;
  }
}
registerProcessor('kora-percussion-features', PercussionProcessor);
