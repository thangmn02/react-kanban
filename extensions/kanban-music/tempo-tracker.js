// Six seconds of locally sampled transient strength. This estimates only a
// visual grid; it does not alter the music or make clock fallback look live.
export class TempoTracker {
  constructor() {
    this.samples = [];
    this.lastEstimateAt = -Infinity;
    this.lowSince = null;
    this.locked = false;
    this.bpm = null;
    this.confidence = 0;
    this.anchor = null;
    this.lastTick = -1;
    this.candidateBpm = null;
    this.candidateSince = null;
  }

  analyze(envelope, now) {
    this.samples.push({ time: now, value: Math.max(0, Math.min(8, envelope)) });
    while (this.samples.length && this.samples[0].time < now - 6000) this.samples.shift();
    let updated = false;
    if (now - this.lastEstimateAt >= 500) {
      this.lastEstimateAt = now;
      updated = true;
      this.estimate(now);
    }
    let tick;
    if (this.locked && this.anchor !== null && this.bpm) {
      const eighthMs = 30000 / this.bpm;
      const current = Math.floor((now - this.anchor) / eighthMs);
      if (current > this.lastTick && current >= 0) {
        this.lastTick = current;
        const step = ((current % 8) + 8) % 8;
        tick = { step, bands: [...(step % 2 === 0 ? ['kick'] : []), 'hat', ...(step === 2 || step === 6 ? ['clap'] : [])] };
      }
    }
    return { updated, locked: this.locked, bpm: this.bpm, confidence: this.confidence, tick };
  }

  estimate(now) {
    const samples = this.samples;
    if (samples.length < 240 || now - samples[0].time < 4800) return;
    const mean = samples.reduce((sum, sample) => sum + sample.value, 0) / samples.length;
    const variance = samples.reduce((sum, sample) => sum + (sample.value - mean) ** 2, 0) / samples.length;
    if (variance < 0.002) { this.confidence = 0; this.weaken(now); return; }
    const frameMs = (samples.at(-1).time - samples[0].time) / (samples.length - 1);
    const scores = [];
    for (let bpm = 60; bpm <= 180; bpm += 1) {
      const lag = Math.round(60000 / bpm / frameMs);
      if (lag < 2 || lag >= samples.length / 2) continue;
      let pair = 0; let left = 0; let right = 0;
      for (let index = lag; index < samples.length; index++) {
        const a = samples[index].value - mean;
        const b = samples[index - lag].value - mean;
        pair += a * b; left += a * a; right += b * b;
      }
      const correlation = pair / Math.sqrt(left * right || 1);
      scores.push({ bpm, correlation, lag });
    }
    scores.sort((a, b) => b.correlation - a.correlation || b.bpm - a.bpm);
    const best = scores[0];
    if (!best) { this.confidence = 0; this.weaken(now); return; }
    const background = scores.filter(({ lag }) => Math.abs(lag - best.lag) > 2)
      .reduce((sum, item) => sum + Math.max(0, item.correlation), 0) / Math.max(1, scores.length - 5);
    this.confidence = Math.max(0, Math.min(1, (best.correlation - background) * 1.2));
    if (best.correlation < 0.48 || this.confidence < 0.42) { this.weaken(now); return; }
    const estimatedBpm = Math.max(60, Math.min(180, 60000 / (best.lag * frameMs)));
    // A strong peak at a different tempo is not evidence for the old grid.
    // Release it through the same confidence hysteresis before reacquiring.
    if (this.locked && Math.abs(estimatedBpm - this.bpm) > 6) {
      this.confidence = 0;
      this.weaken(now);
      return;
    }
    this.lowSince = null;
    if (!this.locked) {
      if (this.candidateBpm === null || Math.abs(estimatedBpm - this.candidateBpm) > 6) {
        this.candidateBpm = estimatedBpm;
        this.candidateSince = now;
        return;
      }
      if (now - this.candidateSince < 1000) return;
      this.locked = true;
      this.bpm = estimatedBpm;
      const recent = samples.slice(-best.lag);
      let strongest = recent[0];
      for (const sample of recent) if (sample.value > strongest.value) strongest = sample;
      this.anchor = strongest.time;
      this.lastTick = Math.floor((now - this.anchor) / (30000 / this.bpm)) - 1;
    } else {
      const previousEighth = 30000 / this.bpm;
      const phase = (now - this.anchor) / previousEighth;
      this.bpm = this.bpm * 0.8 + estimatedBpm * 0.2;
      this.anchor = now - phase * (30000 / this.bpm);
    }
  }

  weaken(now) {
    this.candidateBpm = null;
    this.candidateSince = null;
    this.lowSince ??= now;
    if (this.locked && now - this.lowSince > 4000) {
      this.locked = false;
      this.bpm = null;
      this.anchor = null;
      this.lastTick = -1;
    }
  }
}
