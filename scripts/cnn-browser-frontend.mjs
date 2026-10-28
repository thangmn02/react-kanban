// Private numerical experiment only. Never imported by the packaged Companion.
// Coefficients and all reference identities are supplied by the frozen Python probe.
const F = Math.fround;
const FFT = 1024, HOP = 256, MELS = 96, HALF = 512;

export class CnnBrowserFrontend {
  constructor({ kernel, melFilters, oraclePower = null, observe = () => {} }) {
    if (kernel.length % 2 !== 1 || kernel.length < 3 || melFilters.length !== MELS * 513)
      throw Error('Invalid reference DSP coefficients');
    if (oraclePower !== null && (!Number.isFinite(oraclePower) || oraclePower < 0))
      throw Error('Invalid oracle reference');
    this.kernel = kernel;
    this.radius = (kernel.length - 1) / 2;
    this.filters = Array.from({ length: MELS }, (_, m) => {
      const entries = [];
      for (let k = 0; k <= HALF; k++) if (melFilters[m * 513 + k]) entries.push([k, melFilters[m * 513 + k]]);
      return entries;
    });
    this.oraclePower = oraclePower;
    this.observe = observe;
    this.window = Float64Array.from({ length: FFT }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / FFT));
    this.reverse = Uint16Array.from({ length: FFT }, (_, i) => {
      let value = i, reversed = 0;
      for (let bit = FFT; bit > 1; bit >>= 1) { reversed = (reversed << 1) | (value & 1); value >>= 1; }
      return reversed;
    });
    this.twiddles = new Map();
    for (let size = 2; size <= FFT; size *= 2) this.twiddles.set(size,
      Array.from({ length: size / 2 }, (_, k) => [Math.cos(-2 * Math.PI * k / size), Math.sin(-2 * Math.PI * k / size)]));
    this.reset();
  }

  reset(generation = 0) {
    this.generation = generation;
    this.input = new Float32Array(this.kernel.length + 4);
    this.audio = new Float32Array(FFT + HOP);
    this.real = new Float64Array(FFT);
    this.imag = new Float64Array(FFT);
    this.db = Array.from({ length: 32 }, () => new Float32Array(MELS));
    this.features = Array.from({ length: 32 }, () => new Float32Array(3 * MELS));
    this.received = this.resampled = this.frames = this.featureFrames = this.contextFrames = 0;
    this.runningPower = 0;
    this.finished = false;
  }

  // Call from a Worker, not AudioWorklet. Observer buffers are borrowed until return.
  push(channels, generation = this.generation) {
    if (generation !== this.generation) return false;
    if (this.finished) throw Error('Reset required after EOF');
    if (!channels.length || channels.some(c => c.length !== channels[0].length)) throw Error('Unequal or missing channels');
    for (let i = 0; i < channels[0].length; i++) {
      let sum = 0;
      for (const channel of channels) {
        if (!Number.isFinite(channel[i])) throw Error('Nonfinite PCM');
        sum = F(sum + channel[i]);
      }
      const mono = F(sum / channels.length);
      this.input[this.received % this.input.length] = mono;
      this.observe('mono', this.received, [mono]);
      this.received++;
      if (2 * this.resampled + this.radius < this.received) this.resampleOne();
    }
    return true;
  }

  resampleOne() {
    const center = 2 * this.resampled;
    let value = 0;
    for (let tap = 0; tap < this.kernel.length; tap++) {
      const index = center + this.radius - tap;
      if (index >= 0 && index < this.received) value += this.input[index % this.input.length] * this.kernel[tap];
    }
    this.pushResampled(F(value));
  }

  pushResampled(value) {
    this.audio[this.resampled % this.audio.length] = value;
    this.observe('resampled', this.resampled, [value]);
    this.resampled++;
    if (this.frames * HOP + HALF <= this.resampled) this.spectrum();
  }

  spectrum() {
    const center = this.frames * HOP;
    for (let i = 0; i < FFT; i++) {
      const index = center - HALF + i;
      this.real[this.reverse[i]] = (index < 0 || index >= this.resampled ? 0 : this.audio[index % this.audio.length]) * this.window[i];
      this.imag[i] = 0;
    }
    for (let size = 2; size <= FFT; size *= 2) {
      const twiddles = this.twiddles.get(size), half = size / 2;
      for (let start = 0; start < FFT; start += size) for (let k = 0; k < half; k++) {
        const a = start + k, b = a + half, [cos, sin] = twiddles[k];
        const real = this.real[b] * cos - this.imag[b] * sin;
        const imag = this.real[b] * sin + this.imag[b] * cos;
        this.real[b] = this.real[a] - real; this.imag[b] = this.imag[a] - imag;
        this.real[a] += real; this.imag[a] += imag;
      }
    }
    const power = new Float32Array(513);
    for (let k = 0; k <= HALF; k++) {
      const mag = F(Math.hypot(F(this.real[k]), F(this.imag[k])));
      power[k] = F(mag * mag);
    }
    this.observe('power', this.frames, power);
    const mel = new Float32Array(MELS);
    for (let m = 0; m < MELS; m++) {
      let value = 0;
      for (const [k, weight] of this.filters[m]) value += power[k] * weight;
      mel[m] = value;
      this.runningPower = Math.max(this.runningPower, mel[m]);
    }
    this.observe('mel', this.frames, mel);
    const ref = this.oraclePower ?? this.runningPower;
    const refDb = F(10 * F(Math.log10(F(Math.max(1e-10, ref)))));
    const db = this.db[this.frames % 32];
    for (let m = 0; m < MELS; m++) {
      const powerDb = F(10 * F(Math.log10(F(Math.max(1e-10, mel[m])))));
      db[m] = Math.max(-80, F(powerDb - refDb));
    }
    this.observe('db', this.frames, db);
    this.frames++;
    while (Math.max(8, this.featureFrames + 4) < this.frames) this.finishFeature(false);
  }

  finishFeature(eof) {
    const t = this.featureFrames;
    const center = Math.max(4, Math.min(t, this.frames - 5));
    const output = this.features[t % 32];
    output.set(this.db[t % 32]);
    for (let m = 0; m < MELS; m++) {
      let first = 0, second = 0;
      for (let x = -4; x <= 4; x++) {
        const v = this.db[(center + x) % 32][m];
        first += x / 60 * v;
        second += (3 * x * x - 20) / 462 * v;
      }
      output[MELS + m] = first;
      output[2 * MELS + m] = second;
    }
    this.observe('features', t, output);
    this.featureFrames++;
    while (this.contextFrames + 3 < this.featureFrames || (eof && this.featureFrames === this.frames && this.contextFrames < this.frames)) this.finishContext();
  }

  finishContext() {
    const t = this.contextFrames, output = new Float32Array(3 * 7 * MELS);
    for (let c = 0; c < 3; c++) for (let x = -3; x <= 3; x++) {
      const index = t + x;
      if (index < 0 || index >= this.frames) continue;
      output.set(this.features[index % 32].subarray(c * MELS, (c + 1) * MELS), (c * 7 + x + 3) * MELS);
    }
    this.observe('tensor', t, output, {
      generation: this.generation, targetSample22050: t * HOP,
      observedInputSamples44100: this.received, eof: this.finished,
    });
    this.contextFrames++;
  }

  end(generation = this.generation) {
    if (generation !== this.generation) return false;
    if (this.finished) throw Error('EOF already flushed');
    this.finished = true;
    while (this.resampled < Math.ceil(this.received / 2)) this.resampleOne();
    while (this.frames < 1 + Math.floor(this.resampled / HOP)) this.spectrum();
    if (this.frames < 9) throw Error('Frozen width-nine delta requires at least nine frames');
    while (this.featureFrames < this.frames) this.finishFeature(true);
    return true;
  }
}
