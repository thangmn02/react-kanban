import { describe, expect, it } from 'vitest';
import { createPrimaryMelodyTracker, primaryMelodyTracker, type MelodyCandidate } from './primary-melody-tracker';
const phrase = (source: string, start: number, end: number, energy = .2): MelodyCandidate => ({ source, energy,
  notes: Array.from({ length: (end - start) * 2 }, (_, index) => ({ start: start + index * .5,
    end: start + index * .5 + .4, pitch: 60 + index % 5, amp: .85 })) });

describe('primary pitched melody ownership', () => {
  it('lets a stable pitched vocal phrase win, then hands back to instrumental melody', () => {
    const result = primaryMelodyTracker.track([phrase('other', 0, 15), phrase('vocals', 4, 10)], 15);
    expect(result.sections.some(section => section.source === 'vocals' && section.start < 8)).toBe(true);
    expect(result.sections.at(-1)?.source).toBe('other');
    expect(result.sourceSwitches).toBeLessThanOrEqual(3);
    expect(result.notes.every((note, index) => !index || note.start >= result.notes[index - 1].end)).toBe(true);
  });
  it('does not give loud speech-like activity ownership', () => {
    const speech = phrase('vocals', 0, 12, 20);
    speech.notes = speech.notes.map((note, index) => ({ ...note, pitch: index % 2 ? 95 : 40, amp: .35, end: note.start + .11 }));
    const result = primaryMelodyTracker.track([phrase('guitar', 0, 12), speech], 12);
    expect(result.sections.every(section => section.source === 'guitar')).toBe(true);
  });
  it('avoids chord attacks stealing a coherent primary voice', () => {
    const chords = phrase('piano', 0, 12, 10);
    chords.notes = chords.notes.flatMap(note => [0, 4, 7, 12].map(offset => ({ ...note, pitch: note.pitch + offset })));
    expect(primaryMelodyTracker.track([chords, phrase('other', 0, 12)], 12).sections.every(section => section.source === 'other')).toBe(true);
  });
  it('ignores a transient challenger and follows a stable instrumental section handoff', () => {
    const result = primaryMelodyTracker.track([phrase('guitar', 0, 8), phrase('piano', 8, 16), phrase('vocals', 3, 3.5, 2)], 16);
    expect(result.sections.some(section => section.source === 'vocals')).toBe(false);
    expect(result.sections.at(-1)?.source).toBe('piano');
    expect(result.sourceSwitches).toBe(1);
  });
  it('preserves silence and does not retrigger a sustained note', () => {
    const result = primaryMelodyTracker.track([{ source: 'other', energy: .2,
      notes: [{ start: 2, end: 8, pitch: 70, amp: .9 }] }], 12);
    expect(result.notes).toHaveLength(1);
    expect(result.sections.at(-1)?.source).toBeUndefined();
    expect(primaryMelodyTracker.track([], 12).notes).toEqual([]);
  });
  it('validates configuration, note data and exclusion of percussion/bass', () => {
    expect(() => createPrimaryMelodyTracker({ stepSeconds: 0 })).toThrow();
    expect(() => primaryMelodyTracker.track([phrase('bass', 0, 2)], 2)).toThrow();
    expect(() => primaryMelodyTracker.track([{ ...phrase('other', 0, 2), energy: NaN }], 2)).toThrow();
  });
  it('preserves descending and lower-register phrase attacks without a whole-track pitch floor', () => {
    const voice = phrase('guitar', 0, 12);
    voice.notes = voice.notes.map((note, index) => ({ ...note, pitch: 80 - index }));
    const result = primaryMelodyTracker.track([voice], 12);
    expect(result.notes.map(note => note.pitch)).toEqual(voice.notes.map(note => note.pitch));
  });
});
