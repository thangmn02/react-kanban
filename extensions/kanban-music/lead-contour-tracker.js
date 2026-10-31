/**
 * Causal source-aware Lead tracker (candidate-6).
 *
 * Every frame keeps up to five pitch candidates. One melody line owns the fifth row: it follows the
 * strongest candidate within an octave of its slowly moving register, so a single louder note elsewhere
 * cannot steal it. A line outside that register takes ownership only after out-scoring the owner for a
 * stability window (and a returning line keeps its identity after rests). Owner attacks are emitted as
 * soon as they are confirmed and keep their original audio time; the window delays ownership changes,
 * never onsets. Each line carries timbral cues (attack, decay, vibrato, glide) and a calibrated source
 * estimate; the estimate only breaks ties between comparably dominant lines and is never verified identity.
 */
import { leadSourceModel } from './lead-source-model.js';

export const LEAD_CONTOUR_VERSION = 'kora-lead-contour-v1';
export const LEAD_SOURCES = ['piano', 'guitar', 'other', 'vocal'];

export const leadContourDefaults = Object.freeze({
  // Analysis band: rate and FFT size together keep a ~93 ms window and ~11.6 ms hop.
  analysisRate: 22050, bandHz: 9600, fftSize: 2048, hop: 256, minMidi: 40, maxMidi: 96,
  // An attack that cannot be decided within this time of its onset is dropped, not flashed late.
  maxLateness: .15, binsPerSemitone: 10, harmonics: 8, harmonicWeight: .8,
  peakRangeDb: 40, compression: .5, tonalDb: 6, silenceRms: .0025,
  maxCandidates: 5, candidateFloor: .3, minPartials: 6,
  // Partial matching: above tonalBandHz a partial must stand out more (cymbals and noise are dense up there).
  partialTolerance: .5, tonalBandHz: 3000, highTonalDb: 9,
  // A voice may step this far between consecutive notes; larger leaps start a new voice.
  maxStep: 12, voiceGap: .35, voiceExpiry: 1, registerSeconds: 1.5, minLineShare: .3, voicingRatio: 1, keepRatio: .5, octaveUp: 2,
  // Harmonic fingerprint: a new note joins a voice only if its partial balance matches that voice.
  profilePartials: 6, profileMatch: .85,
  dominanceSeconds: .3,
  // Ownership: acquisition after silence is quick; a switch needs sustained advantage.
  acquireFrames: 4, minOwnerScore: .2, switchRatio: 1.3, switchWindow: .5, ownerLost: 1, ownerMemory: 3,
  // Source is optional explanation only: Vocal when confidently estimated, otherwise Unknown.
  sourceConfidence: .6,
  confirmFrames: 4, pitchStep: 1, rearticulationDb: 9, minInterOnset: .09,
});

function hann(n) { const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = .5 - .5 * Math.cos(2 * Math.PI * i / (n - 1)); return w; }
function createFft(n) {
  const levels = Math.log2(n);
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
const median = values => { if (!values.length) return NaN; const s = [...values].sort((a, b) => a - b); return s[s.length >> 1]; };

/**
 * Timbral cue model, fitted offline (see plans/261031-1100-source-aware-lead) with leave-one-track-out
 * calibration. Gaussian per source over [attackMs, decayDbPerSecond, vibratoSemitones, glideSemitones].
 * Replaced by `options.sourceModel` in evaluation; `null` disables source guesses (all Unknown).
 */
export const defaultSourceModel = leadSourceModel;

export function classifySource(features, model) {
  if (!model || features.notes < model.minNotes) return { source: 'unknown', confidence: 0 };
  const values = model.features.map(name => features[name]);
  if (values.some(v => !Number.isFinite(v))) return { source: 'unknown', confidence: 0 };
  const logs = model.classes.map(c => {
    let l = Math.log(c.prior);
    values.forEach((v, i) => { const sd = c.sd[i]; l += -.5 * ((v - c.mean[i]) / sd) ** 2 - Math.log(sd); });
    return l;
  });
  const top = Math.max(...logs), weights = logs.map(l => Math.exp((l - top) * model.temperature)), sum = weights.reduce((a, b) => a + b, 0);
  const best = weights.indexOf(Math.max(...weights));
  return { source: model.classes[best].source, confidence: weights[best] / sum };
}

export function createLeadContourTracker(sampleRate, options = {}) {
  const o = { ...leadContourDefaults, ...options };
  const sourceModel = options.sourceModel === undefined ? defaultSourceModel : options.sourceModel;
  const factor = Math.max(1, Math.round(sampleRate / o.analysisRate)), rate = sampleRate / factor, frameSeconds = o.hop / rate;
  const cutoff = Math.min(.45 * rate, o.bandHz), rc = Math.exp(-2 * Math.PI * cutoff / sampleRate);
  let lp1 = 0, lp2 = 0, phase = 0, written = 0, sinceHop = 0, decimated = 0;
  const ring = new Float32Array(o.fftSize), frame = new Float32Array(o.fftSize), window = hann(o.fftSize), fft = createFft(o.fftSize);
  const bins = (o.maxMidi - o.minMidi) * o.binsPerSemitone + 1, salience = new Float32Array(bins), hzPerBin = rate / o.fftSize;
  const midiOf = hz => 69 + 12 * Math.log2(hz / 440), hzOf = midi => 440 * 2 ** ((midi - 69) / 12);
  const dominanceAlpha = 1 - Math.exp(-frameSeconds / o.dominanceSeconds);
  const peaks = [];
  let nextVoice = 1, owner, ownerSince = -Infinity, lastOnset = -Infinity, reference = 0;
  const stats = { frames: 0, onsets: 0, switches: 0, acquisitions: 0, voicedFrames: 0 };
  const db = v => 20 * Math.log10(v + 1e-12);

  function candidatesOf() {
    for (let i = 0; i < o.fftSize; i++) frame[i] = ring[(written + i) % o.fftSize] * window[i];
    let energy = 0; for (let i = 0; i < o.fftSize; i++) energy += frame[i] * frame[i];
    const rms = Math.sqrt(energy / o.fftSize) * 1.63;
    const mag = fft(frame);
    salience.fill(0); peaks.length = 0;
    let max = 0; for (let i = 2; i < mag.length - 1; i++) if (mag[i] > max) max = mag[i];
    const floor = max * 10 ** (-o.peakRangeDb / 20);
    for (let i = 2; i < mag.length - 1; i++) {
      const m = mag[i]; if (m < floor || m < mag[i - 1] || m < mag[i + 1]) continue;
      let local = 0, count = 0;
      for (let j = Math.max(1, i - 6); j <= Math.min(mag.length - 1, i + 6); j++) if (Math.abs(j - i) > 1) { local += mag[j]; count++; }
      const prominence = 20 * Math.log10(m / (local / count + 1e-12));
      if (prominence < o.tonalDb) continue;
      const a = Math.log(mag[i - 1] + 1e-12), b = Math.log(m + 1e-12), c = Math.log(mag[i + 1] + 1e-12);
      const hz = (i + (a - c) / (2 * (a - 2 * b + c) || 1)) * hzPerBin, weight = m ** o.compression;
      peaks.push({ hz, weight, prominence });
      for (let h = 1; h <= o.harmonics; h++) {
        const center = (midiOf(hz / h) - o.minMidi) * o.binsPerSemitone;
        if (center < -o.binsPerSemitone || center > bins + o.binsPerSemitone) continue;
        const gain = weight * o.harmonicWeight ** (h - 1);
        for (let k = Math.max(0, Math.ceil(center - o.binsPerSemitone)); k <= Math.min(bins - 1, Math.floor(center + o.binsPerSemitone)); k++)
          salience[k] += gain * Math.cos(Math.abs(k - center) / o.binsPerSemitone * Math.PI / 2) ** 2;
      }
    }
    let top = 0; for (let k = 0; k < bins; k++) if (salience[k] > top) top = salience[k];
    reference = reference ? reference * .995 + top * .005 : top;
    const found = [];
    if (rms <= o.silenceRms || !top) return { rms, top, found };
    // Local salience maxima, strongest first, at least a semitone apart.
    const maxima = [];
    for (let k = 1; k < bins - 1; k++) if (salience[k] >= o.candidateFloor * top && salience[k] >= salience[k - 1] && salience[k] > salience[k + 1]) maxima.push(k);
    maxima.sort((x, y) => salience[y] - salience[x]);
    for (const k of maxima) {
      if (found.length >= o.maxCandidates) break;
      const pitch = o.minMidi + k / o.binsPerSemitone;
      if (found.some(f => Math.abs(f.pitch - pitch) < 1)) continue;
      const f0 = hzOf(pitch);
      let partials = 0, fundamental = false;
      const profile = new Float32Array(o.profilePartials);
      for (let h = 1; h <= o.harmonics; h++) {
        let amplitude = 0;
        for (const p of peaks) if (Math.abs(12 * Math.log2(p.hz / (f0 * h))) < o.partialTolerance && (f0 * h <= o.tonalBandHz || p.prominence >= o.highTonalDb) && p.weight > amplitude) amplitude = p.weight;
        if (amplitude) { partials++; if (h === 1) fundamental = true; }
        if (h <= o.profilePartials) profile[h - 1] = amplitude;
      }
      // A salience peak without its own fundamental is usually a subharmonic of real partials.
      if (partials < o.minPartials || !fundamental && f0 > 120) continue;
      const norm = Math.hypot(...profile) || 1; for (let h = 0; h < profile.length; h++) profile[h] /= norm;
      found.push({ pitch, strength: salience[k], partials, profile });
    }
    return { rms, top, found };
  }

  function noteStep(voice, c, time) {
    // Per-voice note segmentation: voiced start, held pitch change, or clear same-pitch re-articulation.
    const note = voice.note;
    if (voice.pending && Math.abs(c.pitch - voice.pending.pitch) > o.pitchStep * .75) voice.pending = undefined;
    if (!voice.pending) {
      if (!note) voice.pending = { pitch: c.pitch, start: time, count: 0, kind: 'start' };
      else if (Math.abs(c.pitch - note.pitch) >= o.pitchStep) voice.pending = { pitch: c.pitch, start: time, count: 0, kind: 'change' };
      else {
        if (c.strength < note.peak) note.dip = Math.min(note.dip ?? Infinity, c.strength);
        if (note.dip !== undefined && db(note.peak) - db(note.dip) >= o.rearticulationDb && c.strength >= note.peak * .8) {
          voice.pending = { pitch: c.pitch, start: time, count: 0, kind: 'repeat' }; note.dip = undefined;
        }
        note.pitch = note.pitch * .8 + c.pitch * .2;
        if (c.strength > note.peak) { note.peak = c.strength; note.peakAt = time; note.dip = undefined; }
        note.trace.push([time, c.pitch, c.strength]);
        if (!voice.pending) return;
      }
    }
    voice.pending.count++; voice.pending.pitch = voice.pending.pitch * .7 + c.pitch * .3;
    voice.pending.peak = Math.max(voice.pending.peak || 0, c.strength);
    voice.pending.trace ||= []; voice.pending.trace.push([time, c.pitch, c.strength]);
    if (voice.pending.count < o.confirmFrames) return;
    const accepted = voice.pending; voice.pending = undefined;
    if (note) finishNote(voice, note);
    voice.note = { pitch: accepted.pitch, peak: accepted.peak, peakAt: time, start: accepted.start, trace: accepted.trace, kind: accepted.kind };
    return { audioTime: accepted.start, decidedAt: time, kind: accepted.kind, ...(Math.abs(c.pitch - accepted.pitch) < .5 ? { midiPitch: Math.round(accepted.pitch) } : {}) };
  }

  function finishNote(voice, note) {
    // Timbral cues of a finished note feed the voice's source guess.
    const trace = note.trace; if (trace.length < 4) return;
    const start = trace[0][0], peakIndex = trace.reduce((best, f, i) => f[2] > trace[best][2] ? i : best, 0);
    const attackMs = (trace[peakIndex][0] - start) * 1000, after = trace.slice(peakIndex);
    let decay = NaN;
    if (after.length >= 8) {
      const n = after.length, mx = after.reduce((a, f) => a + f[0], 0) / n, my = after.reduce((a, f) => a + db(f[2]), 0) / n;
      decay = after.reduce((a, f) => a + (f[0] - mx) * (db(f[2]) - my), 0) / (after.reduce((a, f) => a + (f[0] - mx) ** 2, 0) || 1);
    }
    let vibrato = NaN;
    const body = trace.filter(f => f[0] - start > .06);
    if (body.length >= 12) {
      const k = 3, residual = body.slice(k, -k).map((f, i) => f[1] - body.slice(i, i + 2 * k + 1).reduce((a, g) => a + g[1], 0) / (2 * k + 1));
      vibrato = Math.sqrt(residual.reduce((a, r) => a + r * r, 0) / residual.length);
    }
    const glide = trace.length >= 6 ? Math.abs(trace[5][1] - trace[0][1]) : NaN;
    voice.cues.push({ attackMs, decay, vibrato, glide });
    if (voice.cues.length > 12) voice.cues.shift();
    voice.features = { notes: voice.cues.length, attackMs: median(voice.cues.map(c => c.attackMs)),
      decayDbPerSecond: median(voice.cues.map(c => c.decay).filter(Number.isFinite)),
      vibratoSemitones: median(voice.cues.map(c => c.vibrato).filter(Number.isFinite)),
      glideSemitones: median(voice.cues.map(c => c.glide).filter(Number.isFinite)) };
    voice.source = classifySource(voice.features, sourceModel);
  }

  const newLine = (c, time) => ({ id: nextVoice++, pitch: c.pitch, register: c.pitch, profile: Float32Array.from(c.profile), lastSeen: time, frames: 0,
    dominance: 0, cues: [], features: { notes: 0 }, source: { source: 'unknown', confidence: 0 }, advantage: 0 });
  const similarity = (line, c) => line.profile ? c.profile.reduce((a, x, h) => a + x * line.profile[h], 0) : 1;
  const distance = (line, c) => Math.abs(c.pitch - line.register);
  /** How well a candidate continues a line: its strength, damped outside the line's register, weighted by timbre match. */
  const fit = (line, c) => c.strength * (distance(line, c) <= o.maxStep ? 1 : Math.exp(-(distance(line, c) - o.maxStep) / 6)) * (.7 + .3 * similarity(line, c));
  function follow(line, c, time) {
    // Fold an octave misreading back onto the line's register.
    if (Math.abs(Math.abs(c.pitch - line.pitch) - 12) < .7 && similarity(line, c) >= o.profileMatch) c = { ...c, pitch: c.pitch - 12 * Math.round((c.pitch - line.pitch) / 12) };
    line.pitch = c.pitch; line.lastSeen = time; line.frames++;
    line.register += (c.pitch - line.register) * registerAlpha;
    for (let h = 0; h < c.profile.length; h++) line.profile[h] = line.profile[h] * .9 + c.profile[h] * .1;
    const n = Math.hypot(...line.profile) || 1; for (let h = 0; h < line.profile.length; h++) line.profile[h] /= n;
    return noteStep(line, c, time);
  }
  function release(line, time) {
    if (line.note && time - line.lastSeen > 2 * frameSeconds) { finishNote(line, line.note); line.note = undefined; line.pending = undefined; }
  }
  const pickOctave = (c, list) => { if (!c) return c; const up = list.find(x => Math.abs(x.pitch - c.pitch - 12) < .6); return up && up.strength >= o.octaveUp * c.strength ? up : c; };
  const registerAlpha = 1 - Math.exp(-frameSeconds / o.registerSeconds);

  function step(time) {
    stats.frames++;
    const { found } = candidatesOf();
    if (found.length) stats.voicedFrames++;
    const top = found[0]?.strength || 0;
    let event;
    if (!owner) {
      // Acquisition: the strongest line, once it has held its register for a few frames.
      const c = found[0] && found[0].strength >= o.voicingRatio * reference ? found[0] : undefined;
      if (c && retired && time - retired.lastSeen <= o.ownerMemory && distance(retired, c) <= o.maxStep) { shadow = retired; retired = undefined; }
      if (c && (!shadow || distance(shadow, c) > o.maxStep)) shadow = newLine(c, time);
      if (c) { follow(shadow, c, time); shadow.dominance += dominanceAlpha * (1 - shadow.dominance); }
      if (shadow && shadow.frames >= o.acquireFrames && time - shadow.lastSeen <= o.voiceGap) {
        owner = shadow; shadow = undefined; ownerSince = time; stats.acquisitions++; acquired = { time, voice: owner.id };
        owner.frames = Math.max(owner.frames, o.acquireFrames);
        // The note that won ownership still flashes if it is on time; older notes are never replayed.
        if (owner.note && time + o.fftSize / 2 / rate - owner.note.start <= o.maxLateness)
          event = { audioTime: owner.note.start, decidedAt: time, kind: owner.note.kind || 'start', acquired: true, midiPitch: Math.round(owner.note.pitch) };
      }
    } else {
      // The strongest candidate leads, with three protections: prefer its octave-up partner when present
      // (salience favours subharmonics), keep the owner's register unless the outside line is clearly
      // stronger, and voice only against the running level.
      let chosen = pickOctave(found[0], found), outside;
      if (chosen && distance(owner, chosen) > o.maxStep) {
        const inside = found.filter(c => distance(owner, c) <= o.maxStep)[0];
        if (inside && inside.strength >= o.keepRatio * chosen.strength) chosen = pickOctave(inside, found);
        else { outside = chosen; chosen = undefined; }
      }
      if (chosen && chosen.strength < o.voicingRatio * reference) chosen = undefined;
      if (chosen) { event = follow(owner, chosen, time); owner.dominance += dominanceAlpha * (chosen.strength / top - owner.dominance); }
      else { owner.dominance += dominanceAlpha * (0 - owner.dominance); release(owner, time); }
      if (outside && outside.strength >= o.voicingRatio * reference) {
        if (!shadow || distance(shadow, outside) > o.maxStep) shadow = newLine(outside, time);
        follow(shadow, outside, time);
      } else if (shadow) { release(shadow, time); outside = undefined; }
      if (shadow) {
        const presence = outside ? outside.strength / top : 0;
        shadow.dominance += dominanceAlpha * (presence - shadow.dominance);
        // Ownership changes only on sustained, stronger evidence; source estimates never decide it.
        const stronger = shadow.dominance > owner.dominance * o.switchRatio;
        shadow.advantage = stronger ? shadow.advantage + frameSeconds : Math.max(0, shadow.advantage - frameSeconds);
        if (shadow.advantage >= o.switchWindow) {
          const previous = owner; owner = shadow; shadow = previous; shadow.advantage = 0; ownerSince = time; stats.switches++; switched = { time, voice: owner.id };
        } else if (time - shadow.lastSeen > o.voiceExpiry) shadow = undefined;
      }
      if (time - owner.lastSeen > o.ownerLost) { release(owner, time); retired = owner; owner = undefined; }
    }
    // Only the owner's confirmed attacks reach the row; their timestamps are the attack times. Attacks that
    // began before the owner was decided are dropped rather than flashed late (no backlog after a handoff).
    if (event && (event.audioTime - lastOnset < o.minInterOnset || !event.acquired && event.audioTime < ownerSince - o.confirmFrames * frameSeconds)) event = undefined;
    if (event && time + o.fftSize / 2 / rate - event.audioTime > o.maxLateness) { stats.late = (stats.late || 0) + 1; event = undefined; }
    if (event) { lastOnset = event.audioTime; stats.onsets++; }
    o.onFrame?.({ time, found, owner: owner ? { id: owner.id, pitch: owner.pitch, present: owner.lastSeen === time, dominance: owner.dominance,
      source: owner.source.source === 'vocal' && owner.source.confidence >= o.sourceConfidence ? 'vocal' : 'unknown', sourceConfidence: owner.source.confidence, features: owner.features } : null,
      shadow: shadow ? { pitch: shadow.pitch, dominance: shadow.dominance, advantage: shadow.advantage } : null });
    if (!event) return;
    const vocal = owner.source.source === 'vocal' && owner.source.confidence >= o.sourceConfidence;
    delete event.acquired;
    return { ...event, confidence: Math.max(0, Math.min(1, owner.dominance)), contourConfidence: Math.max(0, Math.min(1, owner.dominance)), voice: owner.id,
      // A timbral estimate, never verified identity; only Vocal was supported by evaluation.
      source: vocal ? 'vocal' : 'unknown', sourceTypeConfidence: vocal ? owner.source.confidence : 0, sourceConfidence: vocal ? owner.source.confidence : 0 };
  }
  let shadow, retired;
  let acquired, switched;

  return {
    version: LEAD_CONTOUR_VERSION, stats,
    windowDelay: o.fftSize / 2 / rate,
    get ownership() { return { owner: owner ? { id: owner.id, since: ownerSince, source: owner.source } : null, acquired, switched }; },
    push(samples, endTime) {
      const events = [], start = endTime - samples.length / sampleRate;
      for (let i = 0; i < samples.length; i++) {
        lp1 = lp1 * rc + samples[i] * (1 - rc); lp2 = lp2 * rc + lp1 * (1 - rc);
        if (++phase < factor) continue; phase = 0;
        ring[written] = lp2; written = (written + 1) % o.fftSize; decimated++;
        if (decimated < o.fftSize || ++sinceHop < o.hop) continue;
        sinceHop = 0;
        const event = step(start + (i + 1) / sampleRate - o.fftSize / 2 / rate);
        if (event) events.push(event);
      }
      return events;
    },
    reset() { shadow = retired = undefined; owner = undefined; ownerSince = -Infinity; lastOnset = -Infinity; reference = 0; },
  };
}
