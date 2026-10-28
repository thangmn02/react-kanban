// Explicit research adapter to the integrity-pinned npm WASM ABI, not product code.
export class SoxrStream {
  constructor(module, { sourceId, generation = 1, qualityFlags = 0, inputRate = 44100, observe = () => {} }) {
    if (!sourceId || !Number.isSafeInteger(generation) || generation < 0) throw Error('Source/generation required');
    if (![44100, 48000].includes(inputRate)) throw Error('Unsupported input sample rate');
    if (![0, 16].includes(qualityFlags)) throw Error('Unsupported research precision flag');
    this.module = module; this.sourceId = sourceId; this.generation = generation; this.observe = observe;
    this.received = this.emitted = 0; this.finished = false;
    const m = module;
    this.input = m._malloc(4096 * 4); this.output = m._malloc(16384 * 4);
    this.used = m._malloc(4); this.done = m._malloc(4); const error = m._malloc(4);
    const io = m._malloc(m._sizeof_soxr_io_spec_t()), quality = m._malloc(m._sizeof_soxr_quality_spec_t());
    m._soxr_io_spec(io, 0, 0); m._soxr_quality_spec(quality, 4, qualityFlags);
    this.handle = m._soxr_create(inputRate, 22050, 1, error, io, quality, 0);
    const failure = m.getValue(error, 'i32');
    m._free(io); m._free(quality); m._free(error);
    if (failure) { this.close(); throw Error(m.AsciiToString(failure)); }
  }
  process(mono, generation = this.generation) {
    if (generation !== this.generation) return false;
    if (this.finished) throw Error('Reset required after EOF');
    if (!(mono instanceof Float32Array) || mono.length > 4096 || !mono.every(Number.isFinite)) throw Error('Invalid PCM block');
    const m = this.module;
    m.HEAPF32.set(mono, this.input / 4); this.received += mono.length;
    m.setValue(this.used, 0, 'i32'); m.setValue(this.done, 0, 'i32');
    const error = m._soxr_process(this.handle, this.input, mono.length, this.used, this.output, 16384, this.done);
    if (error) throw Error(m.AsciiToString(error));
    if (m.getValue(this.used, 'i32') !== mono.length) throw Error('Unconsumed source samples');
    this.deliver(m.getValue(this.done, 'i32'));
    return true;
  }
  deliver(count) {
    const values = this.module.HEAPF32.subarray(this.output / 4, this.output / 4 + count);
    this.observe(values, { sourceId: this.sourceId, generation: this.generation, observedInputSamples: this.received, firstOutputSample: this.emitted });
    this.emitted += count;
  }
  end(generation = this.generation) {
    if (generation !== this.generation) return false;
    if (this.finished) throw Error('EOF already emitted');
    this.finished = true;
    const m = this.module;
    for (;;) {
      m.setValue(this.done, 0, 'i32');
      const error = m._soxr_process(this.handle, 0, 0, this.used, this.output, 16384, this.done);
      if (error) throw Error(m.AsciiToString(error));
      const count = m.getValue(this.done, 'i32'); this.deliver(count);
      if (count < 16384) break;
    }
    return true;
  }
  close() {
    if (this.handle) this.module._soxr_delete(this.handle);
    this.handle = 0;
    for (const key of ['input', 'output', 'used', 'done']) if (this[key]) { this.module._free(this[key]); this[key] = 0; }
  }
}
