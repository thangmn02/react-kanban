// Research-only source ownership and discontinuity fence.
export class SourceSegmentGuard {
  constructor(sourceId, generation) { this.reset(sourceId, generation); }
  reset(sourceId, generation) {
    if (!sourceId || !Number.isSafeInteger(generation) || generation < 0) throw Error('Stable source/generation required');
    this.sourceId = sourceId; this.generation = generation; this.nextSample = 0; this.sequence = 0;
  }
  accept(block) {
    if (block.sourceId !== this.sourceId || block.generation !== this.generation) return { accepted: false, reason: 'stale-source' };
    if (!Number.isSafeInteger(block.sequence) || block.sequence <= this.sequence) return { accepted: false, reason: 'stale-sequence' };
    if (!(block.mono instanceof Float32Array) || !Number.isSafeInteger(block.sourceStartSample)
      || !Number.isSafeInteger(block.sourceEndSample) || block.sourceStartSample < 0
      || block.sourceEndSample - block.sourceStartSample !== block.mono.length) throw Error('Invalid sample range');
    const initial=this.sequence===0;
    const discontinuity = !initial&&block.sourceStartSample !== this.nextSample;
    const previousEndSample = this.nextSample;
    this.nextSample = block.sourceEndSample; this.sequence = block.sequence;
    return { accepted: true, initial, discontinuity, previousEndSample:initial?null:previousEndSample, originSample: block.sourceStartSample };
  }
}
