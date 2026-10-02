export const beatBands = [
  { name: 'kick', low: 45, high: 150 },
  { name: 'bass', low: 60, high: 250 },
  { name: 'snare', low: 1500, high: 5000 },
  { name: 'hat', low: 6000, high: 12000 },
];

// Adaptive band-energy onset detection; no audio samples leave the extension.
export class BeatDetector {
  constructor(sampleRate, fftSize = 2048, { ratio = 1.6, debounceMs = 90, floor = 1e-7 } = {}) {
    this.ratio = ratio;
    this.debounceMs = debounceMs;
    this.floor = floor;
    this.previousTime = null;
    this.startedAt = null;
    this.bands = beatBands.map((band) => ({ ...band,
      first: Math.max(1, Math.ceil(band.low * fftSize / sampleRate)),
      last: Math.min(fftSize / 2 - 1, Math.floor(band.high * fftSize / sampleRate)),
      average: 0, previous: 0, lastHit: -Infinity,
    }));
  }

  analyze(spectrum, now) {
    this.startedAt ??= now;
    const elapsed = this.previousTime === null ? 16.67 : Math.max(1, Math.min(100, now - this.previousTime));
    this.previousTime = now;
    const alpha = 1 - Math.exp(-elapsed / 700);
    const hits = [];
    let audible = false;
    for (const band of this.bands) {
      let energy = 0;
      for (let bin = band.first; bin <= band.last; bin++) {
        const db = spectrum[bin];
        if (Number.isFinite(db)) energy += 10 ** (db / 10);
      }
      energy /= Math.max(1, band.last - band.first + 1);
      audible ||= energy > this.floor;
      if (now - this.startedAt >= 400 && energy > this.floor
        && energy > band.average * this.ratio && energy > band.previous * 1.15
        && now - band.lastHit >= this.debounceMs) {
        hits.push(band.name);
        band.lastHit = now;
      }
      band.average += alpha * (energy - band.average);
      band.previous = energy;
    }
    return { hits, audible };
  }
}
