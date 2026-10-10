import { expect, it } from 'vitest';
import { chooseLeadSource, createLeadSelector, deterministicLeadSelector, selectLeadNotes, type LeadNote } from './lead-note-selection';
const note = (start:number, end:number, pitch:number, amp=.7): LeadNote => ({start,end,pitch,amp});
it('keeps ambiguity resolution optional, bounded to existing evidence and unable to invent note timing', () => {
  const candidates = [{ source: 'piano' as const, energy: .1, notes: [note(0,.8,78)] },
    { source: 'guitar' as const, energy: .1, notes: [note(0,.8,80)] }];
  const normal = deterministicLeadSelector.select(candidates);
  expect(normal.confidence).toBe(.5);
  expect(createLeadSelector({ choose: () => { throw new Error('offline'); } }).select(candidates)).toEqual(normal);
  expect(createLeadSelector({ choose: () => 'other' }).select(candidates)).toEqual(normal);
  expect(createLeadSelector({ choose: () => 'guitar' }).select(candidates).source).toBe('guitar');
  expect(candidates[1].notes).toEqual([note(0,.8,80)]);
});

it('selects one coherent upper voice and clips overlapping transcription tails', () => {
  const result=selectLeadNotes([
    note(0,1,43),note(0,1,73),note(0,1,78),
    note(.8,2,45),note(.8,2,79),note(.8,2,90,.33),
    note(1.6,2.6,43),note(1.6,2.6,78),
  ]);
  expect(result.map(n=>n.pitch)).toEqual([78,79,78]);
  expect(result[0].end).toBe(.8);
  expect(result[1].end).toBe(1.6);
});
it('merges retrigger artifacts, drops weak short noise and retains a later real repeat', () => {
  const result=selectLeadNotes([note(0,.4,78),note(.45,.8,78),note(1,1.8,78),note(.1,.15,90),note(2,3,90,.2)],.28,true);
  expect(result).toEqual([note(0,.8,78),note(1,1.8,78)]);
});
it('retains touching piano repeats when retrigger merging is not requested', () => {
  expect(selectLeadNotes([note(0,.8,78),note(.8,1.6,78)]).map(n=>n.start)).toEqual([0,.8]);
});
it('keeps legitimate fast confident contour changes instead of a global note debounce', () => {
  const result=selectLeadNotes([note(0,.2,78),note(.2,.4,83),note(.4,.6,78),note(0,.2,43),note(.2,.4,43),note(.4,.6,43)]);
  expect(result.map(n=>n.start)).toEqual([0,.2,.4]);
});
it('rejects malformed export data and produces no invented lead during silence', () => {
  expect(selectLeadNotes([])).toEqual([]);
  expect(()=>selectLeadNotes([note(NaN,1,78)])).toThrow();
  expect(()=>selectLeadNotes([note(0,1,200)])).toThrow();
  expect(()=>selectLeadNotes([note(0,1,78,2)])).toThrow();
});

it('selects one analyzed foreground line without a fixed instrumental-source preference', () => {
  const notes = [note(0, .8, 78), note(1, 1.8, 80)];
  const piano = { source: 'piano' as const, energy: .1, notes };
  const guitar = { source: 'guitar' as const, energy: .5, notes };
  const other = { source: 'other' as const, energy: .05, notes };
  expect(chooseLeadSource([piano, guitar, other])).toBe(guitar);
  expect(chooseLeadSource([{ ...piano, energy: 1 }, guitar, other])?.source).toBe('piano');
  expect(chooseLeadSource([piano, guitar, { ...other, energy: 1 }])?.source).toBe('other');
});

it('does not create a lead for energy-only or weak/noisy instrumental candidates', () => {
  expect(chooseLeadSource([{ source: 'other', energy: 1, notes: [] }])).toBeUndefined();
  expect(chooseLeadSource([{ source: 'guitar', energy: 1, notes: [note(0, 1, 78, .2)] }])).toBeUndefined();
  expect(() => chooseLeadSource([{ source: 'piano', energy: NaN, notes: [] }])).toThrow();
});
