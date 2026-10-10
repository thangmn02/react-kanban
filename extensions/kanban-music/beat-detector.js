export const beatBands = [
  { name: 'kick', low: 45, high: 150 },
  { name: 'clap', low: 1500, high: 5000 },
  { name: 'hat', low: 6000, high: 12000 },
  { name: 'bass', low: 150, high: 400 },
];

// Local onset evidence, not instrument separation. Percussion needs novelty
// plus timbral evidence; a rising tonal envelope alone is not a drum hit.
export class BeatDetector {
  constructor(sampleRate, fftSize = 2048, { ratio = 1.6, debounceMs = 120, floor = 1e-7,
    noiseSpread = { clap: .04, hat: .025 }, minKickShare = .08, harmonicVeto = .65 } = {}) {
    this.ratio = ratio;
    this.debounceMs = debounceMs;
    this.floor = floor;
    this.noiseSpread = noiseSpread;
    this.minKickShare = minKickShare;
    this.harmonicVeto = harmonicVeto;
    this.binHz = sampleRate / fftSize;
    this.power = new Float64Array(fftSize / 2);
    this.compressed = new Float64Array(fftSize / 2);
    this.previousSpectrum = new Float64Array(fftSize / 2);
    this.previousTime = null;
    this.startedAt = null;
    this.percussionUntil = -Infinity;
    this.bands = beatBands.map((band) => ({ ...band,
      first: Math.max(1, Math.ceil(band.low * fftSize / sampleRate)),
      last: Math.min(fftSize / 2 - 1, Math.floor(band.high * fftSize / sampleRate)),
      average: 0, previous: 0, fast: 0, fluxAverage: 0,
      lastHit: -Infinity, hitTimes: [], onsetRate: 0, threshold: ratio,
    }));
  }

  analyze(spectrum, now) {
    this.startedAt ??= now;
    const elapsed = this.previousTime === null ? 16.67 : Math.max(1, Math.min(100, now - this.previousTime));
    this.previousTime = now;
    const alpha = 1 - Math.exp(-elapsed / 700);
    const fastAlpha = 1 - Math.exp(-elapsed / 40);
    let total = 0;
    for (let bin = 0; bin < this.power.length; bin++) {
      const value = Number.isFinite(spectrum[bin]) ? 10 ** (Math.min(0, spectrum[bin]) / 10) : 0;
      this.power[bin] = value;
      this.compressed[bin] = Math.log1p(value / this.floor);
      if (bin * this.binHz >= 40 && bin * this.binHz <= 12000) total += value;
    }
    const hits = [];
    let audible = false;
    let envelope = 0;
    for (const band of this.bands) {
      let sum = 0, squares = 0, flux = 0, peak = band.first;
      for (let bin = band.first; bin <= band.last; bin++) {
        const value = this.power[bin];
        sum += value; squares += value * value;
        if (value > this.power[peak]) peak = bin;
        // A neighbouring-bin maximum suppresses narrow-band pitch/vibrato
        // motion without adding a look-ahead delay or moving event timestamps.
        const prior = Math.max(this.previousSpectrum[bin - 1] || 0,
          this.previousSpectrum[bin], this.previousSpectrum[bin + 1] || 0);
        flux += Math.max(0, this.compressed[bin] - prior);
      }
      const bins = Math.max(1, band.last - band.first + 1);
      const energy = sum / bins;
      flux /= bins;
      const spread = squares ? sum * sum / (squares * bins) : 0;
      const attack = Math.max(0, energy - band.fast) / Math.max(energy, this.floor);
      Object.assign(band, { energy, flux, spread, attack, peak, sum });
    }
    // Independent noisy transients provide short acoustic context for a kick
    // masked by simultaneous bass/lead. They never generate another row's hit.
    if (this.bands.some(b => (b.name === 'clap' || b.name === 'hat')
      && b.spread >= this.noiseSpread[b.name] && b.energy > this.floor
      && b.energy > b.average * this.ratio && b.energy > b.previous * 1.15
      && b.flux > Math.max(.005, b.fluxAverage * .5) && b.attack > .12)) this.percussionUntil = now + 100;
    for (const band of this.bands) {
      const { energy, flux, spread, attack, peak, sum } = band;
      while (band.hitTimes.length && band.hitTimes[0] <= now - 2000) band.hitTimes.shift();
      band.onsetRate = band.hitTimes.length / 2;
      band.threshold = this.ratio * (1 + Math.min(0.9, Math.max(0, band.onsetRate - 3) * .24));
      let timbre = true;
      if (band.name === 'clap' || band.name === 'hat') timbre = spread >= this.noiseSpread[band.name];
      if (band.name === 'kick') {
        let harmonics = 0, upper = 0;
        const from = Math.max(band.last + 1, peak * 2 - 1), to = Math.min(this.power.length - 1, Math.ceil(800 / this.binHz));
        for (let bin = from; bin <= to; bin++) {
          upper += this.power[bin];
          const harmonic = Math.round(bin / peak);
          if (harmonic >= 2 && harmonic <= 4 && Math.abs(bin - peak * harmonic) <= 1) harmonics += this.power[bin];
        }
        let harmonicPeaks = 0;
        for (const harmonic of [2, 3, 4]) {
          const bin = peak * harmonic;
          if (bin > band.last && Math.max(this.power[bin - 1] || 0, this.power[bin] || 0,
            this.power[bin + 1] || 0) > this.power[peak] * .03) harmonicPeaks++;
        }
        const tonal = harmonicPeaks >= 2 && upper > sum * .15
          && harmonics / Math.max(upper, this.floor) >= this.harmonicVeto;
        const noisyAccent = now <= this.percussionUntil;
        timbre = sum / Math.max(total, this.floor) >= (noisyAccent ? .03 : this.minKickShare)
          && (!tonal || noisyAccent);
      }
      audible ||= energy > this.floor;
      envelope += Math.min(3, Math.max(0, energy - band.previous) / Math.max(band.average, this.floor * 10))
        * (band.name === 'hat' ? 0.25 : band.name === 'bass' ? 0.5 : 1);
      if (now - this.startedAt >= 400 && energy > this.floor
        && energy > band.average * band.threshold && energy > band.previous * 1.15
        && flux > Math.max(.005, band.fluxAverage * .5) && attack > .12 && timbre
        && now - band.lastHit >= this.debounceMs) {
        hits.push(band.name);
        band.lastHit = now;
        band.hitTimes.push(now);
        band.onsetRate = band.hitTimes.length / 2;
      }
      band.average += alpha * (energy - band.average);
      band.fast += fastAlpha * (energy - band.fast);
      band.fluxAverage += alpha * (flux - band.fluxAverage);
      band.previous = energy;
    }
    this.previousSpectrum.set(this.compressed);
    return { hits, audible, envelope };
  }
}
