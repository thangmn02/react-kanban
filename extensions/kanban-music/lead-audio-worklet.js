// A bounded tap on the existing captured source. Its output is always silent.
class LeadAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Int16Array(8820);
    this.count = 0; this.sequence = 0; this.pending = false;
    this.port.onmessage = () => { this.pending = false; };
  }
  process(inputs) {
    const channels = inputs[0];
    if (sampleRate !== 44100 || !channels?.[0]) return true;
    for (let index = 0; index < channels[0].length; index++) {
      let value = 0;
      for (const channel of channels) value += channel[index];
      this.samples[this.count++] = Math.round(Math.max(-1, Math.min(1, value / channels.length)) * 32767);
      if (this.count === this.samples.length) {
        this.sequence++;
        if (!this.pending) {
          const samples = this.samples.slice();
          this.pending = true;
          this.port.postMessage({ sequence: this.sequence, endTime: (currentFrame + index + 1) / sampleRate,
            samples: samples.buffer }, [samples.buffer]);
        }
        this.samples.fill(0); this.count = 0;
      }
    }
    return true;
  }
}
registerProcessor('kora-lead-audio', LeadAudioProcessor);
