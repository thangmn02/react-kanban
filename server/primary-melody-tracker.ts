import { selectLeadNotes, type LeadNote } from './lead-note-selection.ts';

export interface MelodyCandidate { source: string; notes: LeadNote[]; energy: number }
export interface MelodyTrackerConfig {
  stepSeconds: number; evidenceSeconds: number; minimumConfidence: number;
  switchMargin: number; stableSeconds: number; inactiveSeconds: number;
  vocalPrior: number; minEventGap: number;
}
export interface MelodySection { start: number; end: number; source?: string; confidence: number }
export interface PrimaryMelodyResult {
  notes: LeadNote[]; sections: MelodySection[]; sourceSwitches: number;
  source?: string; confidence: number; eventsPerMinute: number;
}
export interface PrimaryMelodyTracker {
  track(candidates: MelodyCandidate[], duration: number, previousSource?: string): PrimaryMelodyResult;
}

const defaults: MelodyTrackerConfig = {
  stepSeconds: .5, evidenceSeconds: 3, minimumConfidence: .52,
  switchMargin: .10, stableSeconds: 1.5, inactiveSeconds: .5,
  vocalPrior: .14, minEventGap: .28,
};
const bounded = (value: number) => Math.max(0, Math.min(1, value));
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

// Rank measured pitched phrases, not stem loudness or a provider/song identity.
// Separation names are opaque except for the optional pitched-vocal prior.
export function createPrimaryMelodyTracker(config: Partial<MelodyTrackerConfig> = {}): PrimaryMelodyTracker {
  const settings = { ...defaults, ...config };
  if (Object.values(settings).some(value => !Number.isFinite(value) || value < 0)
    || settings.stepSeconds < .1 || settings.evidenceSeconds < settings.stepSeconds
    || settings.stableSeconds < settings.stepSeconds || settings.minimumConfidence > 1
    || settings.inactiveSeconds < settings.stepSeconds || settings.minEventGap < .18 || settings.minEventGap > 1) {
    throw new Error('Invalid primary melody configuration');
  }
  return { track(candidates, duration, previousSource) {
    if (!Number.isFinite(duration) || duration <= 0 || duration > 7200 || !Array.isArray(candidates)
      || candidates.length > 12 || new Set(candidates.map(value => value.source)).size !== candidates.length) {
      throw new Error('Invalid primary melody candidates');
    }
    const prepared = candidates.map(candidate => {
      if (typeof candidate.source !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(candidate.source)
        || ['drums', 'bass'].includes(candidate.source) || !Number.isFinite(candidate.energy) || candidate.energy < 0) {
        throw new Error('Invalid primary melody source');
      }
      // Keep the established note validation and retrigger/monophonic boundary.
      // Phrase ownership must not discard the lower half of a voice's notes.
      // Preserve the legacy register filter for its existing import callers.
      const notes = selectLeadNotes(candidate.notes, settings.minEventGap, true, false);
      return { ...candidate, notes, raw: candidate.notes.slice().sort((a, b) => a.start - b.start) };
    });
    const energyMax = Math.max(...prepared.map(candidate => candidate.energy), 1e-12);
    const sections: MelodySection[] = [];
    let current = prepared.some(candidate => candidate.source === previousSource) ? previousSource : undefined;
    let challenger: string | undefined, challengerSince = 0, inactiveSince: number | undefined;
    let sourceSwitches = 0;
    for (let time = 0; time < duration; time += settings.stepSeconds) {
      const end = Math.min(duration, time + settings.stepSeconds);
      const left = Math.max(0, time - settings.evidenceSeconds / 2);
      const right = Math.min(duration, time + settings.evidenceSeconds / 2);
      const ranked = prepared.map(candidate => {
        const raw = candidate.raw.filter(note => note.start < right && note.end > left);
        const line = candidate.notes.filter(note => note.start < right && note.end > left);
        if (!raw.length || !line.length || !candidate.energy) return { source: candidate.source, score: 0 };
        const span = right - left;
        const occupancy = raw.reduce((sum, note) => sum + Math.max(0, Math.min(note.end, right) - Math.max(note.start, left)), 0);
        const mono = bounded(span / Math.max(span, occupancy));
        const rawClusters = raw.filter((note, index) => index === 0 || note.start - raw[index - 1].start > .08).length;
        const chordPenalty = bounded(1 - rawClusters / raw.length);
        const jumps = line.slice(1).map((note, index) => Math.abs(note.pitch - line[index].pitch));
        const contour = jumps.length ? average(jumps.map(jump => bounded(1 - Math.max(0, jump - 5) / 15))) : .7;
        const confidence = average(line.map(note => note.amp));
        const sustain = average(line.map(note => bounded((note.end - note.start) / .35)));
        const gaps = line.slice(1).map((note, index) => Math.max(0, note.start - line[index].end));
        const phrase = gaps.length ? average(gaps.map(gap => bounded(1 - gap / 1.5))) : .6;
        const activity = bounded(line.reduce((sum, note) => sum + Math.max(0, Math.min(note.end, right) - Math.max(note.start, left)), 0) / span);
        // A polyphonic stem can contain a coherent lead plus accompaniment.
        // Judge the selected line's pitch evidence; polyphony ranks sources
        // separately instead of suppressing that voice as non-melodic.
        const pitchCoherence = confidence * contour * sustain;
        // Relative energy is a small supporting signal, never the decision.
        const salience = Math.sqrt(candidate.energy / energyMax);
        let score = .24 * confidence + .22 * contour + .18 * mono + .12 * phrase
          + .12 * activity + .12 * salience - .12 * chordPenalty;
        if (candidate.source === 'vocals' && pitchCoherence >= .55) score += settings.vocalPrior * pitchCoherence;
        if (pitchCoherence < .35) score *= pitchCoherence / .35;
        // Keep ranking headroom for a prior: clipping before comparing would
        // prevent any challenger from exceeding a high-confidence incumbent.
        return { source: candidate.source, score: Math.max(0, score) };
      }).sort((a, b) => b.score - a.score || a.source.localeCompare(b.source));
      const winner = ranked[0];
      const currentScore = ranked.find(candidate => candidate.source === current)?.score ?? 0;
      if (currentScore < settings.minimumConfidence) inactiveSince ??= time;
      else inactiveSince = undefined;
      const currentInactive = inactiveSince !== undefined && time - inactiveSince >= settings.inactiveSeconds;
      const reliable = winner && winner.score >= settings.minimumConfidence;
      if (reliable && winner.source !== current && (!current || currentInactive || winner.score >= currentScore + settings.switchMargin)) {
        if (challenger !== winner.source) { challenger = winner.source; challengerSince = time; }
        const required = currentInactive ? settings.inactiveSeconds : settings.stableSeconds;
        if (time - challengerSince >= required || !current && time === 0) {
          if (current) sourceSwitches++;
          current = winner.source; challenger = undefined; inactiveSince = undefined;
        }
      } else challenger = undefined;
      const score = bounded(ranked.find(candidate => candidate.source === current)?.score ?? 0);
      const source = score >= settings.minimumConfidence ? current : undefined;
      const previous = sections.at(-1);
      if (previous && previous.source === source) { previous.end = end; previous.confidence = Math.min(previous.confidence, score); }
      else sections.push({ start: time, end, source, confidence: score });
    }
    const selected: LeadNote[] = [];
    for (const section of sections) {
      const candidate = prepared.find(value => value.source === section.source);
      for (const note of candidate?.notes ?? []) if (note.start >= section.start && note.start < section.end) {
        selected.push({ ...note, end: Math.min(note.end, section.end) });
      }
    }
    const notes = selected.sort((a, b) => a.start - b.start).map((note, index, line) => ({
      ...note, end: Math.min(note.end, line[index + 1]?.start ?? Infinity),
    })).filter(note => note.end > note.start);
    const final = sections.at(-1);
    return { notes, sections, sourceSwitches, source: final?.source, confidence: final?.confidence ?? 0,
      eventsPerMinute: notes.length * 60 / duration };
  } };
}

export const primaryMelodyTracker = createPrimaryMelodyTracker();
