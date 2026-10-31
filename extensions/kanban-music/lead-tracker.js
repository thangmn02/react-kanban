/**
 * Causal dominant-lead tracker for the fifth Beat Grid row.
 *
 * One frame at a time: decimate to ~11 kHz, take a 1024-point spectrum every
 * 128 samples (~11.6 ms), sum harmonic peak energy into a 10-cent pitch
 * salience (MELODIA-style), follow the single most salient contour and emit
 * one attack per new note: a voiced start, a held pitch change, or a clear
 * re-articulation of the same pitch. Sustained notes never retrigger.
 * No look-ahead: every decision uses only audio already received.
 */
export const LEAD_TRACKER_VERSION = 'kora-lead-salience-v1';

export const leadTrackerDefaults = Object.freeze({
  fftSize: 1024, hop: 128,
  minMidi: 40, maxMidi: 88, binsPerSemitone: 10, harmonics: 8, harmonicWeight: .8,
  peakRangeDb: 40, compression: .5,
  // A note must hold this many frames before it is announced.
  confirmFrames: 4,
  // Pitch change, in semitones, that starts a new note once held.
  pitchStep: 1,
  // Voicing: frame salience at least the slow running reference. Frame-level dominance and
  // salience share did not separate melody from accompaniment on development data, so they stay off.
  voicingRatio: 1, minDominance: 1, levelMin: 0,
  // Only peaks standing this far above their neighbourhood are treated as tonal.
  tonalDb: 6,
  // Partials of the chosen pitch that must be present as tonal peaks.
  minPartials: 6,
  // Same-pitch re-articulation: rise against the recent dip, in dB.
  rearticulationDb: 9, dipWindowFrames: 10,
  minInterOnset: .09,
  // Silence floor on the decimated signal (RMS).
  silenceRms: .0025,
});

function hann(n) { const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = .5 - .5 * Math.cos(2 * Math.PI * i / (n - 1)); return w; }

/** In-place radix-2 FFT of real input; returns magnitudes for bins 0..n/2. */
function createFft(n) {
  const levels = Math.log2(n); if (!Number.isInteger(levels)) throw new Error('fft size');
  const cos = new Float32Array(n / 2), sin = new Float32Array(n / 2), rev = new Uint32Array(n);
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / n); sin[i] = Math.sin(2 * Math.PI * i / n); }
  for (let i = 0; i < n; i++) { let r = 0; for (let b = 0, x = i; b < levels; b++, x >>= 1) r = (r << 1) | (x & 1); rev[i] = r; }
  const re = new Float32Array(n), im = new Float32Array(n), mag = new Float32Array(n / 2 + 1);
  return input => {
    for (let i = 0; i < n; i++) { re[rev[i]] = input[i]; im[rev[i]] = 0; }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let start = 0; start < n; start += size) for (let j = 0; j < half; j++) {
        const k = j * step, a = start + j, b = a + half;
        const tr = re[b] * cos[k] + im[b] * sin[k], ti = -re[b] * sin[k] + im[b] * cos[k];
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
    for (let i = 0; i <= n / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
    return mag;
  };
}

export function createLeadTracker(sampleRate, options = {}) {
  const o = { ...leadTrackerDefaults, ...options };
  const factor = Math.max(1, Math.round(sampleRate / 11025)), rate = sampleRate / factor;
  // Two-pole low-pass before decimation keeps harmonics under the new Nyquist.
  const cutoff = Math.min(.45 * rate, 4800), rc = Math.exp(-2 * Math.PI * cutoff / sampleRate);
  let lp1 = 0, lp2 = 0, phase = 0;
  const ring = new Float32Array(o.fftSize), frame = new Float32Array(o.fftSize), window = hann(o.fftSize), fft = createFft(o.fftSize);
  let written = 0, sinceHop = 0, decimated = 0;
  const bins = (o.maxMidi - o.minMidi) * o.binsPerSemitone + 1, salience = new Float32Array(bins);
  const hzPerBin = rate / o.fftSize;
  const history = [], peaks = [];
  let reference = 0, note, pending, lastOnset = -Infinity, frames = 0;
  const midiOf = hz => 69 + 12 * Math.log2(hz / 440);
  const stats = { frames: 0, voicedFrames: 0, onsets: 0 };

  function analyse(time) {
    for (let i = 0; i < o.fftSize; i++) frame[i] = ring[(written + i) % o.fftSize] * window[i];
    let energy = 0; for (let i = 0; i < o.fftSize; i++) energy += frame[i] * frame[i];
    const rms = Math.sqrt(energy / o.fftSize) * 1.63;
    const mag = fft(frame);
    salience.fill(0);
    let max = 0; for (let i = 2; i < mag.length - 1; i++) if (mag[i] > max) max = mag[i];
    const floor = max * 10 ** (-o.peakRangeDb / 20);
    let total = 0; peaks.length = 0;
    for (let i = 2; i < mag.length - 1; i++) {
      const m = mag[i]; if (m < floor || m < mag[i - 1] || m < mag[i + 1]) continue;
      // Tonal peaks only: a cymbal or noise floor has no peak standing clear of its neighbourhood.
      if (o.tonalDb) {
        let local = 0, count = 0;
        for (let j = Math.max(1, i - 6); j <= Math.min(mag.length - 1, i + 6); j++) if (Math.abs(j - i) > 1) { local += mag[j]; count++; }
        if (20 * Math.log10(m / (local / count + 1e-12)) < o.tonalDb) continue;
      }
      // Parabolic peak interpolation on log magnitude.
      const a = Math.log(mag[i - 1] + 1e-12), b = Math.log(m + 1e-12), c = Math.log(mag[i + 1] + 1e-12);
      const offset = (a - c) / (2 * (a - 2 * b + c) || 1), hz = (i + offset) * hzPerBin;
      // Hearing-like emphasis: melody partials sit mostly below ~2.5 kHz.
      const loudness = o.loudness ? (hz < 120 ? hz / 120 : hz > 2500 ? 2500 / hz : 1) : 1;
      const weight = (m * loudness) ** o.compression; total += weight; peaks.push(hz);
      for (let h = 1; h <= o.harmonics; h++) {
        const midi = midiOf(hz / h), center = (midi - o.minMidi) * o.binsPerSemitone;
        if (center < -o.binsPerSemitone || center > bins + o.binsPerSemitone) continue;
        const gain = weight * o.harmonicWeight ** (h - 1);
        for (let k = Math.max(0, Math.ceil(center - o.binsPerSemitone)); k <= Math.min(bins - 1, Math.floor(center + o.binsPerSemitone)); k++) {
          const d = Math.abs(k - center) / o.binsPerSemitone; salience[k] += gain * Math.cos(d * Math.PI / 2) ** 2;
        }
      }
    }
    // Mild range prior, and continuity with the note being followed.
    if (o.prior) for (let k = 0; k < bins; k++) { const m = o.minMidi + k / o.binsPerSemitone; salience[k] *= Math.exp(-.5 * ((m - o.prior.center) / o.prior.width) ** 2) * .5 + .5; }
    if (o.continuity && note) for (let k = 0; k < bins; k++) { const d = (o.minMidi + k / o.binsPerSemitone - note.pitch) / 1.5; salience[k] *= 1 + o.continuity * Math.exp(-d * d); }
    let best = -1, top = 0; for (let k = 0; k < bins; k++) if (salience[k] > top) { top = salience[k]; best = k; }
    // Dominance: strongest candidate against the best one more than a semitone away and not an octave relative.
    let rival = 0;
    for (let k = 0; k < bins; k++) {
      const st = Math.abs(k - best) / o.binsPerSemitone; if (st < 1.2) continue;
      const octave = Math.abs(st - 12 * Math.round(st / 12)) < .6 || Math.abs(st - 19) < .6 || Math.abs(st - 7) < .6;
      if (!octave && salience[k] > rival) rival = salience[k];
    }
    let pitch = best >= 0 ? o.minMidi + best / o.binsPerSemitone : NaN;
    // Hold the current contour through octave flips when it is nearly as strong.
    if (note && Number.isFinite(pitch)) {
      const here = Math.round((note.pitch - o.minMidi) * o.binsPerSemitone);
      if (here >= 0 && here < bins && Math.abs(Math.abs(pitch - note.pitch) - 12) < .7 && salience[here] >= .7 * top) pitch = note.pitch;
    }
    const level = top / (total + 1e-9);
    // A pitched source shows several partials on its own harmonic series; drum bodies rarely do.
    let partials = 0;
    if (Number.isFinite(pitch)) {
      const f0 = 440 * 2 ** ((pitch - 69) / 12);
      for (let h = 1; h <= o.harmonics; h++) if (peaks.some(hz => Math.abs(12 * Math.log2(hz / (f0 * h))) < .5)) partials++;
    }
    reference = reference ? reference * .995 + top * .005 : top;
    const voiced = rms > o.silenceRms && top > o.voicingRatio * reference && top > o.minDominance * rival && level > (o.levelMin ?? .25) && partials >= o.minPartials;
    return { time, pitch, strength: top, voiced, rms, level, partials, relative: top / (reference || 1), dominance: rival ? top / rival : Infinity };
  }

  function decide(f) {
    stats.frames++; if (f.voiced) stats.voicedFrames++;
    history.push(f); if (history.length > o.dipWindowFrames + o.confirmFrames + 2) history.shift();
    const db = v => 20 * Math.log10(v + 1e-12);
    if (!f.voiced) {
      pending = undefined;
      if (note && ++note.gap > 2) note = undefined;
      return;
    }
    if (note) note.gap = 0;
    if (pending && Math.abs(f.pitch - pending.pitch) > o.pitchStep * .75) pending = undefined;
    if (!pending) {
      if (!note) pending = { pitch: f.pitch, start: f.time, count: 0, kind: 'start' };
      else if (Math.abs(f.pitch - note.pitch) >= o.pitchStep) pending = { pitch: f.pitch, start: f.time, count: 0, kind: 'change' };
      else {
        // Same pitch: the note must first fall well below its own peak, then return. The
        // attack ramp of the note being followed is never a dip (it precedes the peak).
        if (f.strength < note.peak) note.dip = Math.min(note.dip ?? Infinity, f.strength);
        if (note.dip !== undefined && db(note.peak) - db(note.dip) >= o.rearticulationDb && f.strength >= note.peak * .8) {
          pending = { pitch: f.pitch, start: f.time, count: 0, kind: 'repeat' }; note.dip = undefined;
        }
        note.pitch = note.pitch * .8 + f.pitch * .2;
        if (f.strength > note.peak) { note.peak = f.strength; note.dip = undefined; }
        if (!pending) return;
      }
    }
    pending.count++; pending.pitch = pending.pitch * .7 + f.pitch * .3; pending.peak = Math.max(pending.peak || 0, f.strength);
    if (pending.count < o.confirmFrames) return;
    const accepted = pending; pending = undefined;
    if (accepted.start - lastOnset < o.minInterOnset) { note = { pitch: accepted.pitch, peak: accepted.peak, gap: 0 }; return; }
    lastOnset = accepted.start; note = { pitch: accepted.pitch, peak: accepted.peak, gap: 0 };
    stats.onsets++;
    const confidence = Math.max(0, Math.min(1, (f.dominance === Infinity ? 1 : 1 - 1 / f.dominance) * Math.min(1, f.strength / (reference * 1.5))));
    return { audioTime: accepted.start, decidedAt: f.time, kind: accepted.kind, confidence,
      // Pitch is reported only when the contour held steady through confirmation.
      ...(Math.abs(f.pitch - accepted.pitch) < .5 ? { midiPitch: Math.round(accepted.pitch) } : {}) };
  }

  return {
    version: LEAD_TRACKER_VERSION, stats,
    /** Feed mono samples; `endTime` is the audio time just after the last sample. Returns new note attacks. */
    push(samples, endTime) {
      const events = [];
      const start = endTime - samples.length / sampleRate;
      for (let i = 0; i < samples.length; i++) {
        lp1 = lp1 * rc + samples[i] * (1 - rc); lp2 = lp2 * rc + lp1 * (1 - rc);
        if (++phase < factor) continue; phase = 0;
        ring[written] = lp2; written = (written + 1) % o.fftSize; decimated++;
        if (decimated < o.fftSize || ++sinceHop < o.hop) continue;
        sinceHop = 0; frames++;
        // Frame time is the window centre: the moment its energy is attributed to.
        const time = start + (i + 1) / sampleRate - o.fftSize / 2 / rate;
        const analysed = analyse(time); o.onFrame?.(analysed);
        const event = decide(analysed);
        if (event) events.push(event);
      }
      return events;
    },
    /** Latency of the newest decision relative to its window centre. */
    windowDelay: o.fftSize / 2 / rate,
    reset() { note = pending = undefined; lastOnset = -Infinity; history.length = 0; reference = 0; },
  };
}
