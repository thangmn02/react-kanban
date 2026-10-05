// Pass through original stereo audio without processing it. Only a bounded,
// in-memory copy goes to the source-separation worker for note analysis.
class InstrumentCapture extends AudioWorkletProcessor {
  constructor() { super(); this.left = new Float32Array(2048); this.right = new Float32Array(2048); this.used = 0; }
  process(inputs, outputs) {
    const input = inputs[0], output = outputs[0];
    output.forEach((channel, index) => {
      const source = input?.[index] || input?.[0];
      if (source) channel.set(source); else channel.fill(0);
    });
    // A missing MediaStream quantum is silence, not a jump in audio time.
    for (let i = 0; i < (output[0]?.length || 128); i++) {
      if (!this.used) this.startFrame = currentFrame + i;
      this.left[this.used] = input?.[0]?.[i] || 0;
      this.right[this.used] = (input?.[1] || input?.[0])?.[i] || 0; this.used++;
      if (this.used === this.left.length) {
        this.port.postMessage({ kind: 'pcm', left: this.left, right: this.right, startFrame: this.startFrame }, [this.left.buffer, this.right.buffer]);
        this.left = new Float32Array(2048); this.right = new Float32Array(2048); this.used = 0;
      }
    }
    return true;
  }
}
registerProcessor('kora-instrument-capture', InstrumentCapture);
