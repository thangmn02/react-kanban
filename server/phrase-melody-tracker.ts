import { selectLeadNotes, type LeadNote } from './lead-note-selection.ts';
import type { MelodyCandidate, PrimaryMelodyResult, PrimaryMelodyTracker } from './primary-melody-tracker.ts';

export const PHRASE_MELODY_VERSION = 'primary-melody-phrases-v3';

export interface PhraseMelodyConfig {
  phraseGap: number;
  minimumAttacks: number;
  minimumConfidence: number;
  ambiguityMargin: number;
  switchMargin: number;
  minimumOwnership: number;
}

export interface MelodyPhrase {
  source: string;
  start: number;
  end: number;
  notes: LeadNote[];
  confidence: number;
  chordFraction: number;
  coherence: number;
  continuation?: { from: number; until: number; attacks: number };
}

export interface PhraseMelodyResult extends PrimaryMelodyResult {
  phrases: MelodyPhrase[];
}

export interface PhraseMelodyTracker extends PrimaryMelodyTracker {
  track(candidates: MelodyCandidate[], duration: number, previousSource?: string): PhraseMelodyResult;
}

const defaults: PhraseMelodyConfig = {
  phraseGap: 1.2,
  minimumAttacks: 3,
  minimumConfidence: .55,
  ambiguityMargin: .06,
  switchMargin: .12,
  minimumOwnership: 2,
};

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const bounded = (value: number) => Math.max(0, Math.min(1, value));
const transition = (left: LeadNote, right: LeadNote) =>
  1 - Math.min(1, Math.max(0, Math.abs(right.pitch - left.pitch) - 5) / 12);

// Resolve a monophonic line over a complete phrase, rather than picking the
// highest note independently at each attack. The state is bounded per cluster.
function coherentLine(clusters: LeadNote[][]): LeadNote[] {
  const layers: { note: LeadNote; score: number; previous: number }[][] = [];

  for (const cluster of clusters) {
    const previous = layers.at(-1);
    const layer = cluster
      .slice()
      .sort((a, b) => b.amp - a.amp || a.pitch - b.pitch)
      .slice(0, 8)
      .map(note => {
        const reward = .65 * note.amp + .15 * Math.min(1, (note.end - note.start) / .5);
        let score = reward;
        let predecessor = -1;

        if (previous) {
          for (let index = 0; index < previous.length; index++) {
            const value = previous[index].score + reward + .2 * transition(previous[index].note, note);
            if (predecessor < 0 || value > score) {
              score = value;
              predecessor = index;
            }
          }
        }

        return { note, score, previous: predecessor };
      });
    layers.push(layer);
  }

  if (!layers.length) {
    return [];
  }

  let index = layers.at(-1)!.reduce((best, value, i, values) => value.score > values[best].score ? i : best, 0);
  const notes: LeadNote[] = [];

  for (let layer = layers.length - 1; layer >= 0; layer--) {
    const state = layers[layer][index];
    notes.push({ ...state.note });
    index = state.previous;
  }

  return notes.reverse();
}

function mergeRetriggers(notes: LeadNote[]): LeadNote[] {
  const merged: LeadNote[] = [];
  for (const note of notes.slice().sort((a, b) => a.pitch - b.pitch || a.start - b.start)) {
    const previous = merged.at(-1);
    if (previous && previous.pitch === note.pitch && note.start >= previous.start && note.start - previous.end <= .1) {
      previous.end = Math.max(previous.end, note.end);
      previous.amp = Math.max(previous.amp, note.amp);
    } else {
      merged.push({ ...note });
    }
  }
  return merged.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}

function measuredPhrases(candidate: MelodyCandidate, duration: number, settings: PhraseMelodyConfig): MelodyPhrase[] {
  // Reuse the established strict note/retrigger validation. Its register-biased
  // selection is not used to choose the phrase's pitch path.
  selectLeadNotes(candidate.notes, .28, true, false);
  if (!candidate.energy) {
    return [];
  }

  const input = candidate.notes
    .filter(note => note.start < duration && note.amp >= .32 && note.end - note.start >= .16)
    .map(note => ({ ...note, end: Math.min(note.end, duration) }));
  const merged = mergeRetriggers(input);
  const clusters: LeadNote[][] = [];

  for (const note of merged) {
    const current = clusters.at(-1);
    if (current && note.start - current[0].start <= .10) {
      current.push(note);
    } else {
      clusters.push([note]);
    }
  }

  const groups: LeadNote[][][] = [];
  let lastEnd = -Infinity;

  for (const cluster of clusters) {
    if (!groups.length || cluster[0].start - lastEnd > settings.phraseGap) {
      groups.push([]);
    }
    groups.at(-1)!.push(cluster);
    lastEnd = Math.max(...cluster.map(note => note.end));
  }

  const phrases: MelodyPhrase[] = groups.flatMap(group => {
    const line = coherentLine(group);
    // Reject isolated accompaniment/leakage without an absolute pitch floor.
    // A convincing sustained melodic note can still own a sparse phrase.
    if (line.length < settings.minimumAttacks && !(line.length === 1 && line[0].end - line[0].start >= 2)) {
      return [];
    }

    const coherence = line.length > 1 ? mean(line.slice(1).map((note, i) => transition(line[i], note))) : 1;
    const chordFraction = group.filter(cluster => cluster.length > 1).length / group.length;
    const sustain = mean(line.map(note => Math.min(1, (note.end - note.start) / .5)));
    const start = line[0].start;
    const end = Math.max(...line.map(note => note.end));
    const activity = bounded(line.reduce((sum, note) => sum + note.end - note.start, 0) / (end - start));
    const confidence = bounded(.5 * mean(line.map(note => note.amp)) + .25 * coherence + .15 * sustain + .1 * activity - .2 * chordFraction);
    const notes = line
      .map((note, i) => ({ ...note, end: Math.min(note.end, line[i + 1]?.start ?? duration) }))
      .filter(note => note.end > note.start);

    return [{ source: candidate.source, start, end, notes, confidence, chordFraction, coherence }];
  });

  // Reconstruct a missed middle contour only between two independently
  // convincing phrases. Short Basic Pitch fragments cannot win ownership or
  // create a new phrase by themselves, and existing handoff checkpoints stay.
  for (let i = 0; i < phrases.length - 1; i++) {
    const left = phrases[i], right = phrases[i + 1];
    if (left.confidence < settings.minimumConfidence || right.confidence < settings.minimumConfidence
      || right.start <= left.end) continue;
    const proposals = mergeRetriggers(candidate.notes
      .filter(note => note.start >= left.end && note.start < right.start && note.amp >= .32
        && note.end - note.start >= .10)
      .map(note => ({ ...note, end: Math.min(note.end, right.start) })));
    const middle: LeadNote[][] = [];
    for (const note of proposals) {
      const cluster = middle.at(-1);
      if (cluster && note.start - cluster[0].start <= .10) cluster.push(note);
      else middle.push([note]);
    }
    if (!middle.length) continue;
    const line = coherentLine([[left.notes.at(-1)!], ...middle, [right.notes[0]]]);
    if (line.slice(1).some((note, index) => note.start - line[index].end > settings.phraseGap
      || transition(line[index], note) <= 0)) continue;
    const continuation = line.slice(1, -1)
      .map((note, index) => ({ ...note, end: Math.min(note.end, line[index + 2].start) }))
      .filter(note => note.end > note.start);
    if (!continuation.length) continue;
    const anchorEnd = left.end;
    left.notes.push(...continuation);
    left.end = right.start;
    left.continuation = { from: anchorEnd, until: right.start, attacks: continuation.length };
  }
  return phrases;
}

function sameVoice(left: MelodyPhrase, right: MelodyPhrase): boolean {
  const relevant = left.notes.filter(note => note.start >= right.start && note.start < right.end);
  if (relevant.length < 3) {
    return false;
  }

  let first = 0;
  let matched = 0;

  for (const note of relevant) {
    while (first < right.notes.length && right.notes[first].start < note.start - .10) {
      first++;
    }

    for (let i = first; i < right.notes.length && right.notes[i].start <= note.start + .10; i++) {
      if (Math.abs(right.notes[i].pitch - note.pitch) <= 1) {
        matched++;
        break;
      }
    }
  }

  return matched / relevant.length >= .7;
}

export function createPhraseMelodyTracker(config: Partial<PhraseMelodyConfig> = {}): PhraseMelodyTracker {
  const settings = { ...defaults, ...config };
  if (Object.values(settings).some(value => !Number.isFinite(value) || value < 0)
    || settings.phraseGap < .1 || settings.phraseGap > 3 || !Number.isInteger(settings.minimumAttacks)
    || settings.minimumAttacks < 2 || settings.minimumAttacks > 12 || settings.minimumConfidence > 1
    || settings.ambiguityMargin > 1 || settings.switchMargin > 1 || settings.minimumOwnership > 10) {
    throw new Error('Invalid phrase melody configuration');
  }

  return {
    track(candidates, duration, previousSource) {
      if (!Number.isFinite(duration) || duration <= 0 || duration > 300 || !Array.isArray(candidates) || candidates.length > 12
        || new Set(candidates.map(candidate => candidate.source)).size !== candidates.length) {
        throw new Error('Invalid bounded melody candidates');
      }

      const phrases = candidates.flatMap(candidate => {
        if (typeof candidate.source !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(candidate.source)
          || ['drums', 'bass'].includes(candidate.source) || !Number.isFinite(candidate.energy) || candidate.energy < 0) {
          throw new Error('Invalid melody source');
        }

        return measuredPhrases(candidate, duration, settings);
      });
      const boundaries = [...new Set([0, duration, ...phrases.flatMap(phrase => [phrase.start, phrase.end])])]
        .sort((a, b) => a - b);
      const sections: PrimaryMelodyResult['sections'] = [];
      let owner: MelodyPhrase | undefined;
      let ownedSince = 0;
      let lastSource = previousSource;
      let sourceSwitches = 0;

      for (let i = 0; i < boundaries.length - 1; i++) {
        const start = boundaries[i];
        const end = boundaries[i + 1];
        const active = phrases
          .filter(phrase => phrase.start <= start && phrase.end > start && phrase.confidence >= settings.minimumConfidence)
          .sort((a, b) => b.confidence - a.confidence || a.source.localeCompare(b.source));

        if (owner && !active.includes(owner)) {
          owner = undefined;
        }

        const winner = active[0];
        const runner = active.find(phrase => phrase.source !== winner?.source && !sameVoice(winner, phrase));
        const ambiguous = winner && runner && winner.confidence - runner.confidence < settings.ambiguityMargin;
        const inherited = !owner
          ? active.find(phrase => phrase.source === lastSource && winner.confidence - phrase.confidence < settings.switchMargin)
          : undefined;
        const challenger = owner && winner !== owner && winner.source !== owner.source
          && start === winner.start && start - ownedSince >= settings.minimumOwnership
          && winner.confidence >= owner.confidence + settings.switchMargin;

        if ((!owner && (inherited || (winner && !ambiguous))) || challenger) {
          const next = inherited ?? winner;
          if (lastSource && lastSource !== next.source) {
            sourceSwitches++;
          }
          owner = next;
          lastSource = next.source;
          ownedSince = start;
        }

        const previous = sections.at(-1);
        const source = owner?.source;
        const confidence = owner?.confidence ?? 0;

        if (previous && previous.source === source) {
          previous.end = end;
          previous.confidence = Math.min(previous.confidence, confidence);
        } else {
          sections.push({ start, end, source, confidence });
        }
      }

      const notes = sections
        .flatMap(section => phrases
          .filter(phrase => phrase.source === section.source)
          .flatMap(phrase => phrase.notes
            .filter(note => note.start >= section.start && note.start < section.end)
            .map(note => ({ ...note, end: Math.min(note.end, section.end) }))))
        .sort((a, b) => a.start - b.start)
        .map((note, i, line) => ({ ...note, end: Math.min(note.end, line[i + 1]?.start ?? duration) }))
        .filter(note => note.end > note.start);
      const final = sections.at(-1);

      return {
        notes,
        sections,
        phrases,
        sourceSwitches,
        source: final?.source,
        confidence: final?.confidence ?? 0,
        eventsPerMinute: notes.length * 60 / duration,
      };
    },
  };
}

export const phraseMelodyTracker = createPhraseMelodyTracker();
