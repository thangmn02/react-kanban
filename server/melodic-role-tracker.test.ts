import { describe, expect, it } from 'vitest';
import { melodicRoleTracker, sustainedVoicePath } from './melodic-role-tracker';
import { phraseMelodyTracker } from './phrase-melody-tracker';
import type { MelodyCandidate } from './primary-melody-tracker';

const line = (source: string): MelodyCandidate => ({ source, energy: .01,
  notes: [60, 62, 64, 62].map((pitch, i) => ({ start: i, end: i + .8, pitch, amp: .75 })) });

describe('polyphonic-source voice-path candidate', () => {
  it('keeps a held pitched contour rather than retriggering it for intervening chord attacks', () => {
    const melody = line('piano').notes;
    const chords = [0, 1, 2, 3].flatMap(i => [40, 47].map(pitch => ({ start: i + .3, end: i + .5, pitch, amp: .9 })));
    expect(sustainedVoicePath([...melody, ...chords])).toEqual(melody);
  });

  it('does not prefer a source name, loud stem or high register', () => {
    const low = line('other');
    low.notes = low.notes.map(note => ({ ...note, pitch: note.pitch - 36 }));
    const result = melodicRoleTracker.track([low], 5);
    expect(result.notes.map(note => note.pitch)).toEqual([24, 26, 28, 26]);
    expect(melodicRoleTracker.track([{ ...low, source: 'vocals', energy: 1000 }], 5).notes).toEqual(result.notes);
  });

  it('does not turn equally convincing simultaneous sources into a guessed owner', () => {
    const a = line('guitar'), b = line('other');
    b.notes = b.notes.map(note => ({ ...note, pitch: note.pitch + 12 }));
    expect(melodicRoleTracker.track([a, b], 5).notes).toEqual([]);
  });

  it('preserves the accepted measured short-note continuation and cannot invent missing notes', () => {
    const candidate = line('vocals');
    candidate.notes.push(...line('vocals').notes.map(note => ({ ...note, start: note.start + 6, end: note.end + 6 })));
    candidate.notes.push(...[4, 4.8, 5.5].map(start => ({ start, end: start + .12, pitch: 61, amp: .7 })));
    const baseline = phraseMelodyTracker.track([candidate], 11);
    const result = melodicRoleTracker.track([candidate], 11);
    const continuation = baseline.phrases.find(phrase => phrase.continuation);
    expect(continuation).toBeDefined();
    const preserved = result.phrases.find(phrase => phrase.continuation);
    expect(preserved?.notes).toEqual(continuation?.notes);
    expect(preserved?.confidence).toEqual(continuation?.confidence);
    expect(result.notes.every(note => candidate.notes.some(raw => raw.start === note.start && raw.pitch === note.pitch))).toBe(true);
  });

  it('keeps validation and nonoverlapping bounded output', () => {
    expect(() => melodicRoleTracker.track([line('drums')], 5)).toThrow();
    expect(() => melodicRoleTracker.track([line('vocals')], 301)).toThrow();
    const result = melodicRoleTracker.track([line('piano')], 4);
    expect(result.notes.every((note, i) => note.end <= 4 && note.end > note.start && (!i || note.start >= result.notes[i - 1].end))).toBe(true);
  });
});
