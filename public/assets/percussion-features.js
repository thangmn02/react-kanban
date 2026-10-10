// Exact trained frontend: 44.1kHz, Hanning FFT, log triangular filterbank.
export class PercussionFeatures {
  constructor(config) {
    this.config = config;
    this.samples = new Float32Array(config.fftSize);
    this.real = new Float64Array(config.fftSize);
    this.imag = new Float64Array(config.fftSize);
    this.magnitude = new Float64Array(config.fftSize / 2);
    this.window = Float32Array.from({ length: config.fftSize }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (config.fftSize - 1)));
    this.reverse = new Uint16Array(config.fftSize);
    for (let i = 0; i < config.fftSize; i++) {
      let value = i;
      let reversed = 0;
      for (let bit = config.fftSize; bit > 1; bit >>= 1) {
        reversed = (reversed << 1) | (value & 1);
        value >>= 1;
      }
      this.reverse[i] = reversed;
    }
    this.write = 0;
    this.received = 0;
    this.next = config.fftSize / 2;
    this.data = new Float32Array(config.stepFrames * config.bins);
    this.times = [];
    this.used = 0;
  }

  spectrum() {
    const size = this.real.length;
    for (let i = 0; i < size; i++) {
      this.real[this.reverse[i]] = this.samples[(this.write + i) % size] * this.window[i];
      this.imag[i] = 0;
    }
    for (let length = 2; length <= size; length *= 2) {
      const half = length / 2;
      const angle = -2 * Math.PI / length;
      for (let start = 0; start < size; start += length) for (let k = 0; k < half; k++) {
        const a = start + k;
        const b = a + half;
        const cosine = Math.cos(angle * k);
        const sine = Math.sin(angle * k);
        const real = this.real[b] * cosine - this.imag[b] * sine;
        const imag = this.real[b] * sine + this.imag[b] * cosine;
        this.real[b] = this.real[a] - real;
        this.imag[b] = this.imag[a] - imag;
        this.real[a] += real;
        this.imag[a] += imag;
      }
    }
    for (let i = 0; i < this.magnitude.length; i++) this.magnitude[i] = Math.hypot(this.real[i], this.imag[i]);
    for (let bin = 0; bin < this.config.bins; bin++) {
      const filter = this.config.filterbank[bin];
      let value = 0;
      for (let k = 0; k < filter.weights.length; k++) value += this.magnitude[filter.first + k] * filter.weights[k];
      this.data[this.used * this.config.bins + bin] = Math.log10(1 + value);
    }
  }
  push(channels, startTime, emit) {
    if (!channels.length) return;
    for (let i = 0; i < channels[0].length; i++) {
      let value = 0;
      for (const channel of channels) value += channel[i] / channels.length;
      this.samples[this.write] = value;
      this.write = (this.write + 1) % this.samples.length;
      if (++this.received !== this.next) continue;
      this.spectrum();
      this.times.push(startTime + (i + 1 - this.config.fftSize / 2) / this.config.sampleRate);
      this.next += this.config.hopSize;
      if (++this.used === this.config.stepFrames) {
        emit({ kind: 'frames', data: this.data, times: this.times,
          ...(this.config.diagnostics ? { postedAt: Date.now(), availableAudioTime: startTime + (i + 1) / this.config.sampleRate } : {}) });
        this.data = new Float32Array(this.config.stepFrames * this.config.bins);
        this.times = [];
        this.used = 0;
      }
    }
  }
}
