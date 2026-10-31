/**
 * Independent onset proposals for the annotation editor: `hpss-superflux-v1`.
 *
 * Deliberately unrelated to Kora's Lead trackers (no salience, no ownership): a short-time Fourier
 * transform, a harmonic/percussive median-filter split (Fitzgerald 2010) to de-emphasise drums, then
 * SuperFlux (Böck & Widmer 2013: log-magnitude flux against a frequency-max-filtered, lagged reference,
 * which suppresses vibrato) with adaptive peak picking. Every proposal is unreviewed until a human
 * accepts it.
 */
export const PROPOSAL_METHOD = Object.freeze({ id: 'hpss-superflux-v1', fftSize: 2048, hop: 256, minHz: 150, maxHz: 5000,
  hpssFrames: 17, hpssBins: 17, lag: 2, maxBins: 3, delta: .06, window: 10, minSpacing: .05 });

function hann(n) { const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = .5 - .5 * Math.cos(2 * Math.PI * i / (n - 1)); return w; }
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
const median = (values, scratch) => { for (let i = 0; i < values.length; i++) scratch[i] = values[i]; scratch.sort(); return scratch[scratch.length >> 1]; };

/** Magnitude spectrogram of the band of interest: frames × bins, plus timing info. */
export function spectrogram(samples, sampleRate, p = PROPOSAL_METHOD) {
  const w = hann(p.fftSize), re = new Float64Array(p.fftSize), im = new Float64Array(p.fftSize);
  const k0 = Math.floor(p.minHz * p.fftSize / sampleRate), k1 = Math.ceil(p.maxHz * p.fftSize / sampleRate), bins = k1 - k0;
  const frames = Math.max(0, Math.floor((samples.length - p.fftSize) / p.hop) + 1), mag = new Float32Array(frames * bins);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < p.fftSize; i++) { re[i] = samples[f * p.hop + i] * w[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k < bins; k++) mag[f * bins + k] = Math.hypot(re[k0 + k], im[k0 + k]);
  }
  // Frame f describes the window centred on sample f*hop + fftSize/2.
  return { mag, frames, bins, k0, hzPerBin: sampleRate / p.fftSize, frameTime: f => (f * p.hop + p.fftSize / 2) / sampleRate };
}

/** Proposed melodic onsets (seconds from the start of `samples`) with a pitch hint for display. */
export function proposeOnsets(samples, sampleRate, p = PROPOSAL_METHOD) {
  const s = spectrogram(samples, sampleRate, p), { mag, frames, bins } = s;
  // Harmonic/percussive split by median filtering across time and across frequency.
  const harmonic = new Float32Array(frames * bins), tWin = new Float32Array(p.hpssFrames), fWin = new Float32Array(p.hpssBins);
  const tBuf = new Float32Array(p.hpssFrames), fBuf = new Float32Array(p.hpssBins), hT = p.hpssFrames >> 1, hF = p.hpssBins >> 1;
  for (let f = 0; f < frames; f++) for (let k = 0; k < bins; k++) {
    for (let i = 0; i < p.hpssFrames; i++) { const g = Math.min(frames - 1, Math.max(0, f + i - hT)); tWin[i] = mag[g * bins + k]; }
    for (let i = 0; i < p.hpssBins; i++) { const b = Math.min(bins - 1, Math.max(0, k + i - hF)); fWin[i] = mag[f * bins + b]; }
    const H = median(tWin, tBuf), P = median(fWin, fBuf), m = H * H / (H * H + P * P + 1e-12);
    harmonic[f * bins + k] = mag[f * bins + k] * m;
  }
  // SuperFlux on the harmonic part.
  const log = harmonic.map(v => Math.log1p(100 * v)), flux = new Float32Array(frames);
  for (let f = p.lag; f < frames; f++) {
    let sum = 0;
    for (let k = 0; k < bins; k++) {
      let ref = 0; for (let d = -1; d <= 1; d++) { const b = Math.min(bins - 1, Math.max(0, k + d)); ref = Math.max(ref, log[(f - p.lag) * bins + b]); }
      const diff = log[f * bins + k] - ref; if (diff > 0) sum += diff;
    }
    flux[f] = sum;
  }
  const peak = Math.max(...flux) || 1; for (let f = 0; f < frames; f++) flux[f] /= peak;
  const onsets = [];
  let last = -Infinity;
  for (let f = 1; f < frames - 1; f++) {
    let localMax = true, mean = 0, n = 0;
    for (let d = -3; d <= 3; d++) { const g = f + d; if (g >= 0 && g < frames && flux[g] > flux[f]) localMax = false; }
    for (let d = -p.window; d <= 0; d++) { const g = f + d; if (g >= 0) { mean += flux[g]; n++; } }
    const t = s.frameTime(f) - (p.fftSize / 2 - p.hop) / sampleRate;
    if (!localMax || flux[f] < mean / n + p.delta || t - last < p.minSpacing) continue;
    last = t;
    onsets.push({ time: t, strength: flux[f], pitchMidi: pitchAt(harmonic, s, Math.min(frames - 1, f + 4)) });
  }
  return { onsets, spectrogram: s, flux };
}

/** Pitch hint by harmonic summation on one harmonic-spectrum frame (display only). */
function pitchAt(harmonic, s, f) {
  let best = 0, bestMidi = null;
  for (let midi = 40; midi <= 96; midi += .5) {
    const hz = 440 * 2 ** ((midi - 69) / 12); let sum = 0;
    for (let h = 1; h <= 6; h++) { const k = Math.round(hz * h / s.hzPerBin) - s.k0; if (k >= 0 && k < s.bins) sum += harmonic[f * s.bins + k] * .85 ** (h - 1); }
    if (sum > best) { best = sum; bestMidi = midi; }
  }
  return bestMidi === null ? null : Math.round(bestMidi);
}

/** Weak layer: a lead-register band at higher sensitivity. Shown as optional suggestions, never as review markers. */
export const SUGGESTION_METHOD = Object.freeze({ ...PROPOSAL_METHOD, id: 'hpss-superflux-v1-band', delta: .04, minHz: 300, maxHz: 3000 });
export function proposeLayers(samples, sampleRate, band = {}) {
  const strong = proposeOnsets(samples, sampleRate), weak = proposeOnsets(samples, sampleRate, { ...SUGGESTION_METHOD, ...band });
  return { strong, suggestions: weak.onsets.filter(o => !strong.onsets.some(s => Math.abs(s.time - o.time) < .04)) };
}
