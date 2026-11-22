// Learned activations only. Acoustic band/onset candidates are never identities.
import {mapPercussionCandidates} from './percussion-label-contract.js';
import {SnareRescue, snareRescueEnabled} from './snare-rescue.js';
const classes = ['kick', 'clap', null, 'hat', 'hat'];

export class PercussionClassifier {
  constructor(thresholds = [.22, .24, .32, .22, .30], { onsetGuided = false, localProminence = false, diagnostics = false,labelMapping='M0',snareRescue = snareRescueEnabled } = {}) {
    // Private test only: quiet snares on the beat of sparse-snare songs (see snare-rescue.js).
    this.snareRescue = snareRescue ? new SnareRescue(typeof snareRescue === 'object' ? snareRescue : {}) : undefined;
    this.thresholds = thresholds;
    this.onsetGuided = onsetGuided;
    this.diagnostics = diagnostics;
    this.labelMapping=labelMapping;
    this.localProminence = localProminence;
    this.reset();
  }

  reset() {
    this.frames = [];
    this.base = 0;
    this.count = 0;
    this.pending = Array(classes.length).fill(null);
    this.lastTime = null;
    this.snareRescue?.reset();
  }

  scoreAt(classIndex, frame) {
    const index = Math.max(this.base, Math.min(this.count - 1, frame));
    return this.frames[index - this.base].scores[classIndex];
  }

  noveltyAt(classIndex, frame) {
    const index = Math.max(0, frame);
    let average = 0;
    for (let offset = -10; offset <= 1; offset++) average += this.scoreAt(classIndex, index + offset);
    const rolling=Math.max(0, this.scoreAt(classIndex, index) - average / 12);
    // Private comparison: a rapid new Snare/Hat rise can retain a low valley
    // even while earlier attacks keep the rolling activation mean elevated.
    if(this.localProminence&&[1,3,4].includes(classIndex)) {
      const valley=Math.min(this.scoreAt(classIndex,index-3),this.scoreAt(classIndex,index-2),this.scoreAt(classIndex,index-1));
      return Math.max(rolling,this.scoreAt(classIndex,index)-valley);
    }
    return rolling;
  }

  push(scores, audioTime, timing) {
    if (!Array.isArray(scores) || scores.length !== 5 || !scores.every(n => Number.isFinite(n) && n >= 0 && n <= 1)
      || !Number.isFinite(audioTime)) return { outcome: 'abstain', events: [] };
    if (this.lastTime !== null && Math.abs(audioTime - this.lastTime - .01) > .005) this.reset();
    this.lastTime = audioTime;
    this.frames.push({ scores, audioTime, timing });
    const frame = this.count++ - 2;
    const events = [];
    const decisions = this.diagnostics ? [] : undefined;
    if (frame >= 0) for (let c = 0; c < 5; c++) {
      if (!classes[c]) continue;
      const value = this.noveltyAt(c, frame);
      const prior = this.pending[c];
      const separateRise = this.onsetGuided && prior && frame - prior.lastFrame >= 2
        && this.scoreAt(c, frame - 1) < Math.min(prior.best.confidence, this.scoreAt(c, frame)) * .5;
      const local = (separateRise || value >= this.noveltyAt(c, frame - 2))
        && value >= this.noveltyAt(c, frame - 1) && value >= this.noveltyAt(c, frame + 1);
      const above = value >= this.thresholds[c];
      // A snare just under the line, while no snare group is open, may be rescued by its place in the beat.
      const rescued = !above && local && c === 1 && this.snareRescue && !prior && value >= this.snareRescue.options.floor
        && this.snareRescue.accepts(this.frames[frame - this.base].audioTime);
      const peak = (above || rescued) && local;
      const eventStart=events.length;
      const decision=decisions&&{frame,classIndex:c,band:classes[c],audioTime:this.frames[frame-this.base].audioTime,
        activation:this.scoreAt(c,frame),novelty:value,threshold:this.thresholds[c],peak:!!peak,separateRise:!!separateRise,...(rescued?{rescued:true}:{}),
        action:rescued?'snare-rescued':!peak?(value<this.thresholds[c]?'below-threshold':'not-local-maximum')
          :prior&&frame-prior.lastFrame<=2&&!separateRise?'grouped-with-neighbor':'new-candidate',
        previousGroup:prior?{lastFrame:prior.lastFrame,bestAudioTime:prior.best.audioTime,bestNovelty:prior.best.value}:null};
      if (peak) {
        const source = this.frames[frame - this.base];
        const candidate = {
          frame,
          classIndex:c,
          value,
          band: classes[c],
          confidence: source.scores[c],
          classMargin: rescued ? value - this.snareRescue.options.floor : value - this.thresholds[c],
          ...(rescued ? { rescued: true } : {}),
          audioTime: source.audioTime,
          scores: source.scores,
          ...(source.timing ? { timing: source.timing } : {}),
        };
        // A new activation rise after a deep intervening valley is a distinct
        // proposal, even when the preceding peak is still awaiting finalization.
        // Wide/flat peaks retain the existing group and produce only one event.
        if (prior && (frame - prior.lastFrame > 2 || separateRise)) { events.push(prior.best); this.pending[c] = null; }
        const group = this.pending[c];
        if (group) { if (value > group.best.value) group.best = candidate; group.lastFrame = frame; }
        else this.pending[c] = { best: candidate, lastFrame: frame };
      }
      const group = this.pending[c];
      if (group && frame - group.lastFrame > 2) { events.push(group.best); this.pending[c] = null; }
      if(decision){decision.emitted=events.slice(eventStart).map(event=>({audioTime:event.audioTime,activation:event.confidence,novelty:event.value}));decisions.push(decision);}
    }
    if (this.snareRescue) for (const event of events) {
      if (event.rescued) this.snareRescue.noteRescued(event.audioTime);
      else this.snareRescue.observe(event.band, event.audioTime);
    }
    // Ten history frames, two preceding peaks and two future-score frames.
    while (this.frames.length > 16) { this.frames.shift(); this.base++; }
    const mapped=mapPercussionCandidates(events,this.labelMapping,this.thresholds,this.diagnostics);
    return { outcome: mapped.events.length ? 'percussion' : 'non-percussion/abstain',...mapped,...(decisions?{decisions}:{}) };
  }
}
