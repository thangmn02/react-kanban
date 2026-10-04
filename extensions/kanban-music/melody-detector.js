// Tonal-energy visualizer, not source separation or pitch transcription.
// Only scalar levels leave the analyser, never audio samples.
export class MelodyDetector {
  constructor(sampleRate, fftSize = 2048, floor = 1e-7) {
    this.first = Math.ceil(250 * fftSize / sampleRate);
    this.last = Math.min(fftSize / 2 - 1, Math.floor(4000 * fftSize / sampleRate));
    this.floor = floor;
    this.level = 0;
    this.note = 0;
    this.tonalSince = null;
    this.lastTonal = -Infinity;
    this.lastNote = -Infinity;
    this.previousTime = null;
    this.centroid = 0;
    this.active = false;
  }

  analyze(spectrum, now) {
    const elapsed = this.previousTime === null ? 16.67 : Math.max(1, Math.min(100, now - this.previousTime));
    this.previousTime = now;
    let sum = 0, logs = 0, peak = 0, weighted = 0;
    const count = this.last - this.first + 1;
    for (let bin = this.first; bin <= this.last; bin++) {
      const power = Number.isFinite(spectrum[bin]) ? 10 ** (spectrum[bin] / 10) : 0;
      sum += power;
      logs += Math.log(Math.max(1e-12, power));
      peak = Math.max(peak, power);
      weighted += power * bin;
    }
    const energy = sum / count;
    const flatness = Math.exp(logs / count) / Math.max(1e-12, energy);
    const tonal = energy > this.floor && flatness < .55 && peak > energy * 4;
    const centroid = sum ? weighted / sum : 0;
    if (tonal) {
      this.tonalSince ??= now;
      this.lastTonal = now;
    } else this.tonalSince = null;
    const active = (tonal && now - this.tonalSince >= 120)
      || (this.active && now - this.lastTonal < 240);
    if (active && tonal && now - this.lastNote > 180
      && (!this.active || Math.abs(centroid - this.centroid) > Math.max(2, this.centroid * .08))) {
      this.note++;
      this.lastNote = now;
      this.centroid = centroid;
    }
    const target = active ? Math.min(1, Math.max(.15, (10 * Math.log10(Math.max(energy, this.floor)) + 70) / 45)) : 0;
    this.level += (1 - Math.exp(-elapsed / (target > this.level ? 80 : 180))) * (target - this.level);
    this.active = active;
    return { active, level: active ? this.level : 0, note: this.note, audible: energy > this.floor };
  }
}
