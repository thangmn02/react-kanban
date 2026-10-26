import { PercussionFeatures } from './percussion-features.js';
class PercussionProcessor extends AudioWorkletProcessor {
  constructor(options) { super(); this.features = new PercussionFeatures(options.processorOptions); this.ownership=options.processorOptions.ownership;
    const original=this.features.config.telemetry===true;
    this.port.onmessage=({data})=>{if(data.kind==='diagnostic-capture'&&(!this.ownership||['captureId','sourceId','sourceGeneration','synchronizationEpoch'].every(key=>data.ownership?.[key]===this.ownership[key])))this.features.config.telemetry=original||data.enabled===true;};
  }
  process(inputs) {
    this.features.push(inputs[0] || [], currentFrame / sampleRate,
      message => this.port.postMessage({...message,ownership:this.ownership}, [message.data.buffer]));
    // Analysis only; output remains silent and does not duplicate browser audio.
    return true;
  }
}
registerProcessor('kora-percussion-features', PercussionProcessor);
