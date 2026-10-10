import type { LeadNote } from './lead-note-selection.ts';
import { phraseMelodyTracker, type MelodyPhrase } from './phrase-melody-tracker.ts';
import type { MelodyCandidate, PrimaryMelodyResult, PrimaryMelodyTracker } from './primary-melody-tracker.ts';

export const MELODIC_ROLE_VERSION = 'primary-melody-voice-path-v1';

export interface RolePhrase extends MelodyPhrase {
  priorConfidence: number;
  retainedDuration: number;
}

export interface MelodicRoleResult extends PrimaryMelodyResult {
  phrases: RolePhrase[];
}

export interface MelodicRoleTracker extends PrimaryMelodyTracker {
  track(candidates: MelodyCandidate[], duration: number, previousSource?: string): MelodicRoleResult;
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

// A held voice need not retrigger whenever its polyphonic source plays a chord.
// Score explained pitched duration, rather than the number of visited attacks.
// No absolute register, instrument name or source-energy ranking is used.
export function sustainedVoicePath(input: LeadNote[]): LeadNote[] {
  if (input.length > 4096) throw new Error('Voice-path candidate budget exceeded');
  const merged: LeadNote[] = [];
  for (const note of input.slice().sort((a, b) => a.pitch - b.pitch || a.start - b.start)) {
    const previous = merged.at(-1);
    if (previous && previous.pitch === note.pitch && note.start - previous.end <= .1) {
      previous.end = Math.max(previous.end, note.end);
      previous.amp = Math.max(previous.amp, note.amp);
    } else merged.push({ ...note });
  }
  const notes = merged.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  const states = notes.map(note => ({ note, score: note.amp * Math.min(2, note.end - note.start), previous: -1 }));
  for (let i = 0; i < states.length; i++) {
    for (let j = i - 1; j >= 0; j--) {
      const left = states[j].note, right = states[i].note;
      if (right.start - left.end > 1.2 || right.start < left.end - .05 || right.start - left.start <= .1) continue;
      const jump = Math.abs(right.pitch - left.pitch);
      const continuity = Math.max(0, 1 - Math.max(0, jump - 5) / 12);
      if (!continuity) continue;
      const score = states[j].score + right.amp * Math.min(2, right.end - right.start) * continuity;
      if (score > states[i].score) {
        states[i].score = score;
        states[i].previous = j;
      }
    }
  }
  if (!states.length) return [];
  let index = states.reduce((best, value, i) => value.score > states[best].score ? i : best, 0);
  const result: LeadNote[] = [];
  while (index >= 0) {
    result.push({ ...states[index].note });
    index = states[index].previous;
  }
  return result.reverse().map((note, i, line) => ({ ...note, end: Math.min(note.end, line[i + 1]?.start ?? note.end) }));
}

function voicePhrase(phrase: MelodyPhrase, candidate: MelodyCandidate): RolePhrase {
  // Two-sided short-note continuations retain the accepted measured contour.
  // They cannot be removed simply because the alternate lattice is sparser.
  const notes = phrase.continuation ? phrase.notes.map(note => ({ ...note })) : sustainedVoicePath(candidate.notes
    .filter(note => note.start >= phrase.start && note.start < phrase.end && note.amp >= .32 && note.end - note.start >= .16)
    .map(note => ({ ...note, end: Math.min(note.end, phrase.end) })));
  const coherence = notes.length > 1 ? mean(notes.slice(1).map((note, i) =>
    Math.max(0, 1 - Math.max(0, Math.abs(note.pitch - notes[i].pitch) - 5) / 12))) : 1;
  const retainedDuration = notes.reduce((sum, note) => sum + note.end - note.start, 0);
  const sustain = mean(notes.map(note => Math.min(1, (note.end - note.start) / .5)));
  const activity = Math.min(1, retainedDuration / (phrase.end - phrase.start));
  const admitted = notes.length >= 3 || notes.length === 1 && notes[0].end - notes[0].start >= 2;
  // Polyphony belongs to the input source, not necessarily its selected voice.
  // Keep the existing quality components; remove the whole-source chord penalty.
  const confidence = phrase.continuation ? phrase.confidence : admitted ? Math.min(1, .5 * mean(notes.map(note => note.amp))
    + .25 * coherence + .15 * sustain + .1 * activity) : 0;
  return { ...phrase, notes, confidence, coherence, priorConfidence: phrase.confidence, retainedDuration };
}

export const melodicRoleTracker: MelodicRoleTracker = {
  track(candidates, duration, previousSource) {
    // Validate through the established bounded contract and preserve its phrase
    // admission/retrigger/continuation logic. Production defaults never call this.
    const baseline = phraseMelodyTracker.track(candidates, duration, previousSource);
    const phrases = baseline.phrases.map(phrase => voicePhrase(phrase, candidates.find(candidate => candidate.source === phrase.source)!));
    const boundaries = [...new Set([0, duration, ...phrases.flatMap(phrase => [phrase.start, phrase.end])])].sort((a, b) => a - b);
    const sections: PrimaryMelodyResult['sections'] = [];
    let owner: RolePhrase | undefined, ownedSince = 0, lastSource = previousSource, sourceSwitches = 0;
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i], end = boundaries[i + 1];
      const active = phrases.filter(phrase => phrase.start <= start && phrase.end > start && phrase.confidence >= .55)
        .sort((a, b) => b.confidence - a.confidence || a.source.localeCompare(b.source));
      if (owner && !active.includes(owner)) owner = undefined;
      const winner = active[0], runner = active.find(phrase => phrase.source !== winner?.source);
      const inherited = !owner && winner ? active.find(phrase => phrase.source === lastSource && winner.confidence - phrase.confidence < .12) : undefined;
      const challenger = owner && winner && winner.source !== owner.source && start === winner.start
        && start - ownedSince >= 2 && winner.confidence >= owner.confidence + .12;
      if (inherited || !owner && winner && (!runner || winner.confidence - runner.confidence >= .06) || challenger) {
        const next = inherited ?? winner;
        if (lastSource && lastSource !== next.source) sourceSwitches++;
        owner = next;
        lastSource = next.source;
        ownedSince = start;
      }
      const prior = sections.at(-1);
      if (prior && prior.source === owner?.source) {
        prior.end = end;
        prior.confidence = Math.min(prior.confidence, owner?.confidence ?? 0);
      } else sections.push({ start, end, source: owner?.source, confidence: owner?.confidence ?? 0 });
    }
    const notes = sections.flatMap(section => phrases.filter(phrase => phrase.source === section.source)
      .flatMap(phrase => phrase.notes.filter(note => note.start >= section.start && note.start < section.end)
        .map(note => ({ ...note, end: Math.min(note.end, section.end) }))))
      .sort((a, b) => a.start - b.start)
      .map((note, i, line) => ({ ...note, end: Math.min(note.end, line[i + 1]?.start ?? duration) }))
      .filter(note => note.end > note.start);
    const final = sections.at(-1);
    return { notes, sections, phrases, sourceSwitches, source: final?.source, confidence: final?.confidence ?? 0,
      eventsPerMinute: notes.length * 60 / duration };
  },
};
