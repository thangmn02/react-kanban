import { PercussionClassifier } from './percussion-classifier.js';

// Private L1-gap0 decision variant. The frozen classifier stays byte-identical.
export class EarlyPercussionClassifier extends PercussionClassifier {
  constructor(thresholds, options = {}) {
    super(thresholds, { ...options, onsetGuided: true, localProminence: false });
  }

  push(scores, audioTime, timing) {
    const result = super.push(scores, audioTime, timing);
    if (this.lastTime !== audioTime || this.frames.at(-1)?.scores !== scores) return result;
    const frame = this.count - 3;
    const events = [...result.events];
    for (let c = 0; c < this.pending.length; c++) {
      const group = this.pending[c];
      if (group && frame - group.lastFrame > 0) {
        events.push(group.best);
        this.pending[c] = null;
        const decision = result.decisions?.find(value => value.classIndex === c);
        if (decision) decision.emitted.push({ audioTime: group.best.audioTime,
          activation: group.best.confidence, novelty: group.best.value });
      }
    }
    const unique = new Map();
    for (const event of events.sort((a, b) => a.classIndex - b.classIndex)) {
      const key = `${event.band}:${event.audioTime}`;
      if (!unique.has(key) || unique.get(key).confidence < event.confidence) unique.set(key, event);
    }
    return { ...result, outcome: unique.size ? 'percussion' : 'non-percussion/abstain', events: [...unique.values()] };
  }
}
