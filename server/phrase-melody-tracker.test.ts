import { describe, expect, it } from 'vitest';
import { createPhraseMelodyTracker, phraseMelodyTracker } from './phrase-melody-tracker';
import type { MelodyCandidate } from './primary-melody-tracker';

const voice = (source: string, start: number, pitches: number[], amp = .85, energy = .1): MelodyCandidate => ({
  source,
  energy,
  notes: pitches.map((pitch, i) => ({
    start: start + i * .5,
    end: start + i * .5 + .4,
    pitch,
    amp,
  })),
});

describe('phrase-owned primary melody candidate', () => {
  it('preserves legitimate low and descending phrases but rejects isolated low leakage', () => {
    const lead = voice('piano', 0, [42, 40, 38, 36, 35, 33]);
    const leakage = voice('guitar', 3.5, [29, 33]);
    const result = phraseMelodyTracker.track([lead, leakage], 8);
    expect(result.notes.map(note => note.pitch)).toEqual(lead.notes.map(note => note.pitch));
    expect(result.sections.at(-1)?.source).toBeUndefined();
  });

  it('lets either coherent vocal or instrumental phrases own successive sections without a source prior', () => {
    const result = phraseMelodyTracker.track([voice('vocals', 0, [60, 62, 64, 62, 60, 59]), voice('guitar', 4, [55, 57, 59, 60, 59, 57])], 9);
    expect(result.sections.filter(section => section.source).map(section => section.source)).toEqual(['vocals', 'guitar']);
    expect(result.sourceSwitches).toBe(1);
    expect(result.notes.every((note, i) => !i || note.start >= result.notes[i - 1].end)).toBe(true);
  });

  it('does not let a loud chordal accompaniment or a transient interrupt an owned phrase', () => {
    const chords = voice('piano', 0, [60, 62, 64, 62, 60, 59], .85, 100);
    chords.notes = chords.notes.flatMap(note => [0, 4, 7, 12].map(offset => ({ ...note, pitch: note.pitch + offset })));
    const lead = voice('other', 0, [67, 69, 71, 69, 67, 66]);
    const result = phraseMelodyTracker.track([chords, lead, voice('vocals', 1, [80], .99)], 6);
    expect(result.sections.filter(section => section.source).every(section => section.source === 'other')).toBe(true);
  });

  it('abstains on two different equally convincing simultaneous phrases', () => {
    expect(phraseMelodyTracker.track([voice('guitar', 0, [60, 62, 64, 62]), voice('other', 0, [72, 74, 76, 74])], 4).notes).toEqual([]);
  });

  it('keeps one owner for duplicate leakage and emits a sustained note once', () => {
    const piano = voice('piano', 0, [60, 62, 64, 62]);
    const result = phraseMelodyTracker.track([piano, { ...piano, source: 'guitar' }], 4);
    expect(result.sourceSwitches).toBe(0);
    expect(result.notes).toHaveLength(4);
    const sustained = phraseMelodyTracker.track([{ source: 'other', energy: .1, notes: [{ start: 2, end: 7, pitch: 55, amp: .9 }] }], 10);
    expect(sustained.notes).toHaveLength(1);
    expect(sustained.notes[0]).toMatchObject({ start: 2, end: 7 });
  });

  it('bounds analysis, rejects forbidden sources and invalid notes/configuration', () => {
    expect(() => phraseMelodyTracker.track([], 301)).toThrow();
    expect(() => phraseMelodyTracker.track([voice('drums', 0, [60, 62, 64])], 4)).toThrow();
    expect(() => phraseMelodyTracker.track([{ ...voice('piano', 0, [60]), notes: [{ start: 0, end: 1, pitch: 60, amp: NaN }] }], 4)).toThrow();
    expect(() => createPhraseMelodyTracker({ minimumAttacks: 1 })).toThrow();
  });

  it('reconnects measured short notes between confident phrases without erasing handoff checkpoints', () => {
    const left = voice('other', 0, [60, 62, 64]);
    const right = voice('other', 5, [62, 64, 65]);
    const short = [2, 2.7, 3.4, 4.1, 4.8].map(start => ({ start, end: start + .13, pitch: 64, amp: .7 }));
    const notes = [...left.notes, ...short, ...right.notes];
    for (const source of ['vocals', 'other']) {
      const result = phraseMelodyTracker.track([{ source, energy: .1, notes }], 8);
      expect(result.notes.map(note => note.start)).toEqual(notes.map(note => note.start));
      expect(result.sections.filter(section => section.source).map(section => section.source)).toEqual([source]);
      expect(result.phrases.map(phrase => phrase.start)).toEqual([0, 5]);
      expect(result.phrases[0].continuation?.attacks).toBe(5);
      const unconnected = phraseMelodyTracker.track([{ source, energy: .1, notes: [...left.notes, ...right.notes] }], 8);
      expect(result.phrases.map(phrase => phrase.confidence)).toEqual(unconnected.phrases.map(phrase => phrase.confidence));
    }
  });

  it('does not promote isolated short fragments or a briefly pitched burst into a primary phrase', () => {
    const fragments = voice('vocals', 0, [60, 62, 64], .9);
    fragments.notes = fragments.notes.map(note => ({ ...note, end: note.start + .11 }));
    expect(phraseMelodyTracker.track([fragments], 3).notes).toEqual([]);
    const isolated = voice('other', 0, [60], .95);
    isolated.notes[0].end = .12;
    expect(phraseMelodyTracker.track([isolated], 3).notes).toEqual([]);
  });

  it('does not bridge missing audio or a disconnected pitch jump between phrases', () => {
    const anchors = [...voice('vocals', 0, [60, 62, 64]).notes, ...voice('vocals', 5, [62, 64, 65]).notes];
    const distant = { start: 3, end: 3.13, pitch: 64, amp: .9 };
    const jump = [2, 2.7, 3.4, 4.1, 4.8].map(start => ({ start, end: start + .13, pitch: 100, amp: .9 }));
    for (const notes of [[...anchors, distant], [...anchors, ...jump]]) {
      const result = phraseMelodyTracker.track([{ source: 'vocals', energy: .1, notes }], 8);
      expect(result.notes).toHaveLength(6);
      expect(result.phrases.every(phrase => !phrase.continuation)).toBe(true);
    }
  });

  it('merges short same-pitch fragments in a continuation instead of flashing every retrigger', () => {
    const anchors = [...voice('other', 0, [60, 62, 64]).notes, ...voice('other', 5, [62, 64, 65]).notes];
    const short = [2, 2.13, 2.7, 3.4, 4.1, 4.8].map(start => ({ start, end: start + .13, pitch: 64, amp: .7 }));
    const result = phraseMelodyTracker.track([{ source: 'other', energy: .1, notes: [...anchors, ...short] }], 8);
    expect(result.notes.filter(note => note.start >= 2 && note.start < 5)).toHaveLength(5);
    expect(result.notes.find(note => note.start === 2)?.end).toBeCloseTo(2.26);
    expect(result.notes.some(note => note.start === 2.13)).toBe(false);
  });
});
