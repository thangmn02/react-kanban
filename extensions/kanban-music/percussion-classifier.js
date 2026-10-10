// Learned activations only. Acoustic band/onset candidates are never identities.
const classes = ['kick', 'clap', null, 'hat', 'hat'];

export class PercussionClassifier {
  constructor(thresholds = [.22, .24, .32, .22, .30]) {
    this.thresholds = thresholds;
    this.reset();
  }

  reset() {
    this.frames = [];
    this.base = 0;
    this.count = 0;
    this.pending = Array(classes.length).fill(null);
    this.lastTime = null;
  }

  scoreAt(classIndex, frame) {
    const index = Math.max(this.base, Math.min(this.count - 1, frame));
    return this.frames[index - this.base].scores[classIndex];
  }

  noveltyAt(classIndex, frame) {
    const index = Math.max(0, frame);
    let average = 0;
    for (let offset = -10; offset <= 1; offset++) average += this.scoreAt(classIndex, index + offset);
    return Math.max(0, this.scoreAt(classIndex, index) - average / 12);
  }

  push(scores, audioTime) {
    if (!Array.isArray(scores) || scores.length !== 5 || !scores.every(n => Number.isFinite(n) && n >= 0 && n <= 1)
      || !Number.isFinite(audioTime)) return { outcome: 'abstain', events: [] };
    if (this.lastTime !== null && Math.abs(audioTime - this.lastTime - .01) > .005) this.reset();
    this.lastTime = audioTime;
    this.frames.push({ scores, audioTime });
    const frame = this.count++ - 2;
    const events = [];
    if (frame >= 0) for (let c = 0; c < 5; c++) {
      if (!classes[c]) continue;
      const value = this.noveltyAt(c, frame);
      const peak = value >= this.thresholds[c] && value >= this.noveltyAt(c, frame - 2)
        && value >= this.noveltyAt(c, frame - 1) && value >= this.noveltyAt(c, frame + 1);
      if (peak) {
        const source = this.frames[frame - this.base];
        const candidate = {
          frame,
          value,
          band: classes[c],
          confidence: source.scores[c],
          classMargin: value - this.thresholds[c],
          audioTime: source.audioTime,
          scores: source.scores,
        };
        const prior = this.pending[c];
        if (prior && frame - prior.lastFrame > 2) { events.push(prior.best); this.pending[c] = null; }
        const group = this.pending[c];
        if (group) { if (value > group.best.value) group.best = candidate; group.lastFrame = frame; }
        else this.pending[c] = { best: candidate, lastFrame: frame };
      }
      const group = this.pending[c];
      if (group && frame - group.lastFrame > 2) { events.push(group.best); this.pending[c] = null; }
    }
    // Ten history frames, two preceding peaks and two future-score frames.
    while (this.frames.length > 16) { this.frames.shift(); this.base++; }
    const unique = new Map();
    for (const event of events) {
      const key = `${event.band}:${event.audioTime}`;
      if (!unique.has(key) || unique.get(key).confidence < event.confidence) unique.set(key, event);
    }
    return { outcome: unique.size ? 'percussion' : 'non-percussion/abstain', events: [...unique.values()] };
  }
}
