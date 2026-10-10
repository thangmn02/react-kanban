// Postprocess notes from an already selected instrumental stem. Inference and
// stem separation belong to the offline analysis worker, never this client.
export interface LeadNote { start: number; end: number; pitch: number; amp: number }

export interface LeadCandidate { source: 'piano' | 'guitar' | 'other'; notes: LeadNote[]; energy: number }
export interface LeadDecision { source?: LeadCandidate['source']; confidence: number; evidence: { source: LeadCandidate['source']; score: number }[]; previousSource?: string }
export interface LeadSourceSelector { select(candidates: LeadCandidate[], previous?: LeadDecision): LeadDecision }
export interface LeadAmbiguityResolver { choose(evidence: LeadDecision['evidence']): LeadCandidate['source'] | undefined }

// Choose from analyzed instrumental sources, never a provider, title or genre.
// One candidate owns the bounded analysis range; timestamps always come from
// measured notes. An optional ambiguity resolver can choose an existing source,
// never synthesize attacks, and failure retains the deterministic decision.
export function chooseLeadSource(candidates: LeadCandidate[]): LeadCandidate | undefined {
  const decision = deterministicLeadSelector.select(candidates);
  return candidates.find(candidate => candidate.source === decision.source);
}
export function createLeadSelector(resolver?: LeadAmbiguityResolver): LeadSourceSelector { return { select(candidates, previous) {
  const evidence: LeadDecision['evidence'] = [];
  for (const candidate of candidates) {
    if (!['piano', 'guitar', 'other'].includes(candidate.source) || !Number.isFinite(candidate.energy) || candidate.energy < 0) {
      throw new Error('Invalid lead candidate');
    }
    const selected = selectLeadNotes(candidate.notes, .28, candidate.source === 'other');
    if (!selected.length || !candidate.energy) continue;
    const salience = selected.reduce((sum, note) => sum + note.amp * Math.min(note.end - note.start, 1.2), 0);
    const jumps = selected.slice(1).reduce((sum, note, index) => sum + Math.abs(note.pitch - selected[index].pitch), 0);
    const score = salience * Math.sqrt(candidate.energy) / (1 + jumps / Math.max(1, selected.length - 1) / 9);
    evidence.push({ source: candidate.source, score });
  }
  evidence.sort((a, b) => b.score - a.score);
  const sum = evidence.reduce((total, item) => total + item.score, 0);
  const confidence = sum ? evidence[0].score / sum : 0;
  let source: LeadCandidate['source'] | undefined = evidence[0]?.source;
  if (resolver && evidence.length > 1 && confidence < .6) {
    try { const choice = resolver.choose(evidence.map(item => ({ ...item })));
      if (evidence.some(item => item.source === choice)) source = choice;
    } catch { /* Deterministic behavior is sufficient without the resolver. */ }
  }
  return { source, confidence, evidence, ...(previous?.source ? { previousSource: previous.source } : {}) };
} }; }
export const deterministicLeadSelector = createLeadSelector();

export function selectLeadNotes(input: LeadNote[], minEventGap = .28, mergeRetriggers = false, restrictRegister = true): LeadNote[] {
  if (!Array.isArray(input) || input.length > 200000 || !Number.isFinite(minEventGap) || minEventGap < .18 || minEventGap > 1) {
    throw new Error('Invalid lead note input');
  }
  const notes = input.map((note) => {
    if (![note.start, note.end, note.pitch, note.amp].every(Number.isFinite) || note.start < 0
      || note.end <= note.start || !Number.isInteger(note.pitch) || note.pitch < 0 || note.pitch > 127 || note.amp < 0 || note.amp > 1) {
      throw new Error('Invalid lead note');
    }
    return { ...note };
  }).sort((a, b) => a.pitch - b.pitch || a.start - b.start);

  const merged: LeadNote[] = [];
  for (const note of notes) {
    const previous = merged.at(-1);
    const gap = previous ? note.start - previous.end : Infinity;
    if (mergeRetriggers && previous && Math.abs(note.pitch - previous.pitch) <= 1 && gap >= -.03 && gap <= .1) {
      previous.end = Math.max(previous.end, note.end);
      previous.amp = Math.max(previous.amp, note.amp);
    } else merged.push(note);
  }
  const eligible = merged
    .filter((note) => note.amp >= .32 && note.end - note.start >= .16)
    .sort((a, b) => a.start - b.start);
  if (!eligible.length) return [];

  const pitches = eligible.map((note) => note.pitch).sort((a, b) => a - b);
  const quantile = (pitches.length - 1) * .58;
  const low = Math.floor(quantile);
  const floor = restrictRegister ? pitches[low] + (pitches[Math.ceil(quantile)] - pitches[low]) * (quantile - low) : pitches[0];
  const clusters: LeadNote[][] = [];
  for (const note of eligible.filter((note) => note.pitch >= floor)) {
    const current = clusters.at(-1);
    if (current && note.start - current[0].start <= .12) current.push(note);
    else clusters.push([note]);
  }

  const selected: LeadNote[] = [];
  for (const cluster of clusters) {
    const previous = selected.at(-1);
    const score = (note: LeadNote) => {
      const jump = previous ? Math.abs(note.pitch - previous.pitch) : 0;
      const continuity = !previous ? 0 : jump <= 2 ? 1 : jump <= 5 ? .55 : jump <= 9 ? .15 : -(jump - 9) * .18;
      return note.amp * 3 + (note.pitch - floor) * .12 + Math.min(note.end - note.start, 1.2) * .35 + continuity;
    };
    const chosen = cluster.reduce((best, note) => score(note) > score(best) ? note : best);
    const gap = previous ? chosen.start - previous.start : Infinity;
    if (previous && (gap < minEventGap && Math.abs(chosen.pitch - previous.pitch) <= 2 || gap < .18 && chosen.amp < .60)) continue;
    selected.push({ ...chosen });
  }
  // Retriggering the lead clips its predecessor's hold: EventTrack represents
  // one line, so raw transcription tails must not become overlapping voices.
  return selected.map((note, index) => ({
    ...note,
    end: Math.min(note.end, selected[index + 1]?.start ?? Infinity),
  }));
}
