import { PercussionClassifier } from './percussion-classifier.js';
import {mapPercussionCandidates} from './percussion-label-contract.js';

// Private L1-gap0 finalizes the same peak groups earlier.
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
    const mapped=mapPercussionCandidates(events.sort((a,b)=>a.classIndex-b.classIndex),this.labelMapping,this.thresholds,this.diagnostics);
    if(this.diagnostics){
      const final=new Map(mapped.labelCandidates.map(record=>[record.eventId,record]));
      mapped.labelCandidates=[...(result.labelCandidates||[]).map(record=>{
        const next=final.get(record.eventId);final.delete(record.eventId);return next?{...record,...next}:record;
      }),...final.values()];
    }
    return {...result,...mapped,outcome:mapped.events.length?'percussion':'non-percussion/abstain'};
  }
}
