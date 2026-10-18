// Private diagnostics only. No production classifier or scheduler imports.
export const instruments = ['kick', 'snare', 'hat', 'cymbal', 'grouped-percussion', 'tom', 'unknown'] as const;
export const causes = ['UNKNOWN', 'MODEL_MISS', 'MODEL_FALSE_POSITIVE', 'CLASS_CONFUSION', 'POSTPROCESS_SUPPRESSION', 'TRANSPORT_LOSS', 'SCHEDULER_LATE', 'CONTROLLER_SUPPRESSION', 'VISUAL_FUSION', 'SOURCE_TIME_MISMATCH', 'ANNOTATION_UNCERTAIN'] as const;
export type Instrument = typeof instruments[number];
export type Cause = typeof causes[number];
export type Model = 'A' | 'B' | 'C';
export interface Prediction { id: string; sourceTime: number; time: number; instrument: string; rawClass: string | number; confidence?: number; rawIndex: number; recordSha256: string }
export interface Clip { id: string; title: string; originalSourceSha256: string; canonicalWavSha256: string; decodedPcmSha256: string; sampleRate: number; duration: number; sourceOffset: number; start: number; end: number; natural: boolean; mapping: Record<string, unknown>; audioUrl: string; coverage?: Partial<Record<Model,{uncoveredIntervals:{start:number;end:number;reason:string}[];completeRawCoverage:boolean}>>; predictions: Record<Model, Prediction[] | null>; raw: Record<Model, { classes: string[]; times: number[]; scores: number[][]; scope: string } | null>; constructedReferences: { row: string; time: number }[] }
export interface Failure { model: Model; primary: Cause; secondary: Cause[]; evidenceRefs: string[]; confirmed: boolean }
export interface Mark { id: string; sourceTime: number; instrument: Instrument; audibility: 'high' | 'medium' | 'low'; overlap: boolean; ambiguous: boolean; uncertaintyMs: number | null; verified: boolean; reviewer: string; origin: 'blind-waveform-review'; modelVisibleWhenMarked: boolean; notes: string; failures: Failure[] }
export interface Review { version: 1; revision: number; clipId: string; sourceSha256: string; canonicalWavSha256: string; reviewer: string; modelsRevealed: boolean; referenceSelectionExposed: boolean; referenceStatus: 'provisional-human-reference' | 'human-reviewed-subset'; frozen: boolean; start: number; end: number; complete: Record<'kick' | 'snare' | 'hat', boolean>; ambiguousIntervals: { start: number; end: number; reason: string }[]; events: Mark[] }
export interface FrameTrace { id: string; traceId: string; model: Model; sourceTime: number; deliveredAt: number; generation: number; firstFrameAt?: number; firstFrameLevel?: number; renderer?: string; sourceDomain: 'offline-prediction' | 'constructed-renderer-fixture' }
export function blankReview(clip: Clip): Review {
  return { version: 1, revision: 0, clipId: clip.id, sourceSha256: clip.originalSourceSha256, canonicalWavSha256: clip.canonicalWavSha256, reviewer: 'local-reviewer', modelsRevealed: false, referenceSelectionExposed: false, referenceStatus: 'provisional-human-reference', frozen: false, start: clip.start, end: clip.end, complete: { kick: false, snare: false, hat: false }, ambiguousIntervals: [], events: [] };
}
function requireValue(ok: unknown, message: string): asserts ok { if (!ok) throw Error(message); }
export function validateReview(value: unknown, clip: Clip): Review {
  const d = value as Review;
  requireValue(d && d.version === 1 && Number.isInteger(d.revision) && d.revision >= 0, 'Unsupported annotation version');
  requireValue(d.clipId === clip.id && d.sourceSha256 === clip.originalSourceSha256 && d.canonicalWavSha256 === clip.canonicalWavSha256, 'Audio identity does not match');
  requireValue(typeof d.reviewer === 'string' && d.reviewer.trim().length > 0 && d.reviewer.length <= 100, 'Reviewer is required');
  requireValue(Number.isFinite(d.start) && Number.isFinite(d.end) && d.start >= clip.start && d.end <= clip.end && d.start < d.end, 'Invalid review interval');
  requireValue(typeof d.frozen === 'boolean' && ['provisional-human-reference', 'human-reviewed-subset'].includes(d.referenceStatus), 'Invalid reference status');
  requireValue(typeof d.modelsRevealed === 'boolean', 'Model-exposure provenance is required');
  requireValue(typeof d.referenceSelectionExposed === 'boolean', 'Reference-selection exposure provenance is required');
  requireValue(d.complete && ['kick', 'snare', 'hat'].every(k => typeof d.complete[k as 'hat'] === 'boolean'), 'Coverage must be explicit');
  requireValue(Array.isArray(d.ambiguousIntervals) && d.ambiguousIntervals.length <= 1000, 'Invalid ambiguous intervals');
  d.ambiguousIntervals.forEach(i => requireValue(Number.isFinite(i.start) && Number.isFinite(i.end) && i.start >= d.start && i.end <= d.end && i.start < i.end && typeof i.reason === 'string' && i.reason.length <= 500, 'Invalid ambiguous interval'));
  requireValue(Array.isArray(d.events) && d.events.length <= 5000, 'Invalid event list');
  const seen = new Set<string>(), onsets = new Set<string>();
  for (const e of d.events) {
    requireValue(typeof e.id === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(e.id) && !seen.has(e.id), 'Duplicate/invalid annotation ID'); seen.add(e.id);
    requireValue(Number.isFinite(e.sourceTime) && e.sourceTime >= clip.start && e.sourceTime < clip.end && instruments.includes(e.instrument), 'Invalid event time or instrument');
    const onsetKey = `${e.instrument}:${e.sourceTime}`;
    requireValue(!onsets.has(onsetKey), 'Duplicate same-instrument reference onset'); onsets.add(onsetKey);
    requireValue(['high', 'medium', 'low'].includes(e.audibility) && typeof e.overlap === 'boolean' && typeof e.ambiguous === 'boolean' && typeof e.verified === 'boolean', 'Missing uncertainty labels');
    requireValue(e.uncertaintyMs === null || Number.isFinite(e.uncertaintyMs) && e.uncertaintyMs >= 0 && e.uncertaintyMs <= 500, 'Invalid onset uncertainty');
    requireValue(e.origin === 'blind-waveform-review' && typeof e.modelVisibleWhenMarked === 'boolean' && typeof e.reviewer === 'string' && e.reviewer.trim().length > 0 && e.reviewer.length <= 100 && typeof e.notes === 'string' && e.notes.length <= 2000, 'Invalid review provenance');
    requireValue(Array.isArray(e.failures) && e.failures.length <= 3 && new Set(e.failures.map(f => f.model)).size === e.failures.length, 'Only one primary cause per model/case');
    for (const f of e.failures) requireValue(['A', 'B', 'C'].includes(f.model) && causes.includes(f.primary) && Array.isArray(f.secondary) && f.secondary.every(c => causes.includes(c) && c !== f.primary) && new Set(f.secondary).size === f.secondary.length && typeof f.confirmed === 'boolean' && Array.isArray(f.evidenceRefs) && f.evidenceRefs.every(s => typeof s === 'string' && s.length <= 500) && (!f.confirmed || f.primary === 'UNKNOWN' || f.evidenceRefs.some(s => s.trim())), 'Confirmed causes require evidence and distinct secondary factors');
  }
  requireValue(!d.frozen || freezeBlockers(d).length === 0 && d.referenceStatus === 'human-reviewed-subset', 'Reference cannot be frozen: review/coverage/timing incomplete');
  requireValue(d.frozen || d.referenceStatus === 'provisional-human-reference', 'Draft annotations must remain provisional');
  return structuredClone(d);
}
export function included(time: number, d: Review) { return time >= d.start && time < d.end && !d.ambiguousIntervals.some(i => time >= i.start - .05 && time <= i.end + .05); }
function scoreSelection(d: Review) {
  return JSON.stringify({ start: d.start, end: d.end, complete: d.complete, ambiguousIntervals: d.ambiguousIntervals,
    events: d.events.map(e => ({ id: e.id, sourceTime: e.sourceTime, instrument: e.instrument, audibility: e.audibility, overlap: e.overlap, ambiguous: e.ambiguous, uncertaintyMs: e.uncertaintyMs, verified: e.verified })).sort((a, b) => a.id.localeCompare(b.id)) });
}
export function retainReferenceExposure(prior: Review, next: Review): Review {
  return { ...next, referenceSelectionExposed: prior.referenceSelectionExposed || next.referenceSelectionExposed || prior.modelsRevealed && scoreSelection(prior) !== scoreSelection(next) };
}
export function validateReviewTransition(prior: Review, next: Review) {
  requireValue(!prior.modelsRevealed || next.modelsRevealed, 'Model exposure cannot be reset in this review');
  requireValue(!retainReferenceExposure(prior, next).referenceSelectionExposed || next.referenceSelectionExposed, 'Post-reveal reference/coverage/window selection cannot qualify as independent blind evidence');
  const keys = ['sourceTime', 'instrument', 'audibility', 'overlap', 'ambiguous', 'uncertaintyMs', 'verified'] as const;
  for (const event of next.events) {
    const old = prior.events.find(e => e.id === event.id);
    const changed = !old || keys.some(k => old[k] !== event[k]);
    requireValue(!(old?.modelVisibleWhenMarked || prior.modelsRevealed && changed) || event.modelVisibleWhenMarked, 'Post-reveal marks/edits must retain model exposure');
  }
}
export function describeCandidate(c: {outcome: string; classIdentity: string; matchedPrediction: Prediction | null; proposals: Prediction[]; timeErrorMs: number | null}, official: boolean) {
  const navigationOnly = !official || c.classIdentity === 'COARSE_GROUP_ASSOCIATION_ONLY';
  const event = navigationOnly ? c.proposals[0] : c.matchedPrediction;
  if (!event) return official && !navigationOnly ? 'No strict matched prediction.' : 'No same-target proposal within 150 ms.';
  return `${event.instrument} ${event.sourceTime.toFixed(4)} s${c.timeErrorMs === null ? '' : ` (${c.timeErrorMs.toFixed(1)} ms)`}${navigationOnly ? ' · navigation/association only' : ''}`;
}
export function matchOnsets(reference: number[], prediction: number[], cap = .05) {
  // Gap/4 windows are disjoint: nearest prediction per window is also the
  // maximum-cardinality, minimum-error one-to-one assignment used by the sprint.
  const refs = reference.map((time, index) => ({ time, index })).sort((a, b) => a.time - b.time);
  const used = new Set<number>();
  return refs.flatMap((r, i) => {
    const tolerance = Math.min(cap, i ? (r.time - refs[i - 1].time) / 4 : Infinity, i + 1 < refs.length ? (refs[i + 1].time - r.time) / 4 : Infinity);
    const best = prediction.map((time, index) => ({ index, error: Math.abs(time - r.time) })).filter(p => !used.has(p.index) && p.error <= tolerance + 1e-10).sort((a, b) => a.error - b.error || a.index - b.index)[0];
    if (!best) return [];
    used.add(best.index); return [{ referenceIndex: r.index, predictionIndex: best.index, errorSeconds: best.error, toleranceSeconds: tolerance }];
  });
}
export function freezeBlockers(d: Review) {
  const blockers: string[] = [];
  if (d.referenceSelectionExposed) blockers.push('Reference selection changed after model disclosure. Keep this review provisional; an independent blind subset is required for official metrics.');
  if (!Object.values(d.complete).every(Boolean)) blockers.push('Confirm complete Kick, Snare and Hat coverage outside ambiguous intervals.');
  const eligible = d.events.filter(e => included(e.sourceTime, d));
  if (!eligible.length) blockers.push('No reviewed events in this subset.');
  for (const e of eligible) {
    const others = eligible.filter(v => v.id !== e.id && v.instrument === e.instrument).map(v => Math.abs(v.sourceTime - e.sourceTime));
    const bound = Math.min(50, ...others.map(g => g * 250));
    if (!e.verified || e.audibility !== 'high' || e.ambiguous || e.instrument === 'unknown' || e.modelVisibleWhenMarked || e.uncertaintyMs === null || e.uncertaintyMs > bound) blockers.push(`Review ${e.id}: blind, confident identity and onset uncertainty <= ${bound.toFixed(1)} ms required.`);
  }
  return blockers;
}
export function compareReview(d: Review, clip: Clip, frames: FrameTrace[] = []) {
  const official = d.frozen && freezeBlockers(d).length === 0;
  const rows = d.events.map(reference => ({ reference, candidates: Object.fromEntries((['A', 'B', 'C'] as Model[]).map(model => {
    const family = reference.instrument === 'hat' && model === 'C' ? 'grouped-percussion' : reference.instrument;
    const proposals = (clip.predictions[model] || []).filter(p => p.instrument === family);
    const nearby = proposals.filter(p => Math.abs(p.sourceTime - reference.sourceTime) <= .15).sort((a, b) => Math.abs(a.sourceTime - reference.sourceTime) - Math.abs(b.sourceTime - reference.sourceTime));
    const raw = clip.raw[model];
    const rawNearby = raw ? raw.times.flatMap((time, index) => Math.abs(time - reference.sourceTime) <= .05 ? [{ time, scores: raw.scores[index] }] : []) : null;
    return [model, { proposals: nearby, timeErrorMs: nearby[0] ? (nearby[0].sourceTime - reference.sourceTime) * 1000 : null, rawNearby,
      rawClasses: raw?.classes, rawScope: raw?.scope, outcome: 'UNVERIFIED_NAVIGATION_ONLY', matchedPrediction: null as Prediction | null, classIdentity: model === 'C' && reference.instrument === 'hat' ? 'COARSE_GROUP_ASSOCIATION_ONLY' : 'MODEL_PREDICTION',
      visual: nearby.map(p => ({ id: p.id, observations: frames.filter(f => f.id === p.id) })), primaryCause: reference.failures.find(f => f.model === model && f.confirmed)?.primary || (reference.ambiguous ? 'ANNOTATION_UNCERTAIN' : 'UNKNOWN') }];
  })) }));
  const metrics: Record<string, unknown> = {};
  if (official) for (const model of ['A', 'B', 'C'] as Model[]) for (const instrument of ['kick', 'snare', 'hat'] as const) {
    if (!clip.predictions[model]) { metrics[`${model}:${instrument}`] = { status: 'NO_SAVED_INPUT' }; continue; }
    if (clip.coverage?.[model]?.uncoveredIntervals.some(i => i.start < d.end && i.end > d.start)) { metrics[`${model}:${instrument}`] = { status: 'UNAVAILABLE_ANALYSIS_GAP', intervals: clip.coverage[model]!.uncoveredIntervals }; continue; }
    if (model === 'C' && instrument === 'hat') { metrics[`${model}:${instrument}`] = { status: 'COARSE_GROUP_NOT_TRUE_HAT' }; continue; }
    const refs = d.events.filter(e => e.instrument === instrument && included(e.sourceTime, d));
    const preds = clip.predictions[model]!.filter(p => p.instrument === instrument && included(p.sourceTime, d));
    const pairs = matchOnsets(refs.map(e => e.sourceTime), preds.map(e => e.sourceTime), clip.natural === false ? .04 : .05);
    const tp = pairs.length, fp = preds.length - tp, fn = refs.length - tp;
    metrics[`${model}:${instrument}`] = { tp, fp, fn, precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null, f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null, pairs,
      unmatchedPredictions: preds.filter((_, i) => !pairs.some(p => p.predictionIndex === i)), missedReferences: refs.filter((_, i) => !pairs.some(p => p.referenceIndex === i)) };
  }
  if (official) for (const row of rows) for (const model of ['A', 'B', 'C'] as Model[]) {
    const candidate = row.candidates[model];
    if (!included(row.reference.sourceTime, d)) { candidate.outcome = 'EXCLUDED_AMBIGUOUS_OR_OUTSIDE_REVIEW'; continue; }
    const result = metrics[`${model}:${row.reference.instrument}`] as {status?: string; pairs?: {referenceIndex: number; predictionIndex: number}[]} | undefined;
    if (!result?.pairs) { candidate.outcome = result?.status || 'CLASS_NOT_SCORED'; continue; }
    const refs = d.events.filter(e => e.instrument === row.reference.instrument && included(e.sourceTime, d));
    const preds = clip.predictions[model]!.filter(p => p.instrument === row.reference.instrument && included(p.sourceTime, d));
    const pair = result.pairs.find(p => refs[p.referenceIndex].id === row.reference.id);
    candidate.matchedPrediction = pair ? preds[pair.predictionIndex] : null;
    candidate.outcome = pair ? 'CORRECT_MATCH_AGAINST_REVIEWED_SUBSET' : 'MISSED_REVIEWED_HIT';
    candidate.timeErrorMs = pair ? (preds[pair.predictionIndex].sourceTime - row.reference.sourceTime) * 1000 : null;
  }
  const causeCounts: Record<string, number> = {};
  d.events.forEach(e => e.failures.filter(f => f.confirmed).forEach(f => { causeCounts[f.primary] = (causeCounts[f.primary] || 0) + 1; }));
  return { version: 1, sourceSha256: d.sourceSha256, annotationRevision: d.revision, referenceStatus: d.referenceStatus, officialSubsetMetrics: official, scope: 'Only this reviewed excerpt; no music-domain qualification. ±150 ms proposals are navigation, not verified matching. C has no true-Hat precision claim.', rows, metrics, causeCounts, fractionOfUserProblems: 'UNKNOWN: reviewed failure coverage and live evidence required.', frameScope: 'Offline renderer delivery bypasses the production controller and transport; first DOM frame is not physical visibility.' };
}
export function classifyTrace(records: Record<string, unknown>[], id: string): Cause {
  const trace = records.filter(r => r.id === id);
  if (trace.some(r => r.stage === 'EVENT_LATE' || r.reason === 'schedule-late' || r.reason === 'delivery-late')) return 'SCHEDULER_LATE';
  if (trace.some(r => r.stage === 'EVENT_DROPPED' && r.reason === 'transport')) return 'TRANSPORT_LOSS';
  if (trace.some(r => r.stage === 'EVENT_DROPPED' && ['debounce', 'semantic-duplicate', 'renderer-coalesced'].includes(String(r.reason)))) return 'CONTROLLER_SUPPRESSION';
  return 'UNKNOWN'; // A missing stage in an incomplete bounded log proves no loss.
}
