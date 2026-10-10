// Private past-only learned scores with a separately trained abstention head.
const bands = ['kick', 'clap', null, 'hat', 'hat'];

export class CausalPercussionClassifier {
  constructor() {
    this.reset();
  }

  reset() {
    this.history = [];
    this.lastTime = null;
  }

  push(scores, audioTime) {
    const validScores =
      Array.isArray(scores) &&
      scores.length === 6 &&
      scores.every((score) => Number.isFinite(score) && score >= 0 && score <= 1);
    if (!validScores || !Number.isFinite(audioTime)) {
      return { outcome: 'abstain', events: [] };
    }

    if (this.lastTime !== null && Math.abs(audioTime - this.lastTime - 0.01) > 0.005) {
      this.reset();
    }

    this.lastTime = audioTime;
    this.history.push({ scores, audioTime });
    if (this.history.length < 3) return { outcome: 'abstain', events: [] };

    const [before, peak, after] = this.history;
    const unique = new Map();
    for (let column = 0; column < bands.length; column++) {
      const band = bands[column];
      const confidence = peak.scores[column];
      if (
        !band ||
        confidence < 0.5 ||
        confidence <= peak.scores[5] ||
        confidence <= before.scores[column] ||
        confidence < after.scores[column]
      ) {
        continue;
      }

      const previous = unique.get(band);
      if (!previous || previous.confidence < confidence) {
        unique.set(band, {
          band,
          audioTime: peak.audioTime,
          confidence,
          classMargin: confidence - peak.scores[5],
          scores: peak.scores,
          origin: 'causal-learned-percussion',
        });
      }
    }

    this.history.shift();
    return { outcome: unique.size ? 'percussion' : 'non-percussion/abstain', events: [...unique.values()] };
  }
}
