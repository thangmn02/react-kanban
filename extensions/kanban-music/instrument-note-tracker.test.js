import { expect, it } from 'vitest';
import { InstrumentNoteTracker } from './instrument-note-tracker.js';
function tone(midi, level = 10, profile = [1, .5, .3, .2, .1, .08]) {
  const bins = new Float32Array(1024);
  for (let h = 1; h <= profile.length; h++) bins[Math.round(440 * 2 ** ((midi - 69) / 12) * h / (44100 / 4096))] += level * profile[h - 1];
  return bins;
}
it('detects repeated pitch attacks, short notes and pitch changes without repeating a sustained note', () => {
  const tracker = new InstrumentNoteTracker(), events = [];
  for (let time = 0; time < 1800; time += 23) {
    const phase = Math.floor(time / 180);
    const bins = time < 900 ? tone(69, time % 180 < 65 ? 10 : 3) : tone(72, 10);
    const event = tracker.analyze(bins, time);
    if (event && event.note > (events.at(-1)?.note || 0)) events.push({ ...event, time, phase });
  }
  expect(events.map((event) => event.note)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(events.at(-1).time).toBeLessThan(980);
});
it('rejects silence, broadband drums and bins assigned to vocals or bass', () => {
  for (const spectrum of [new Float32Array(1024), new Float32Array(1024).fill(5), tone(69)]) {
    const tracker = new InstrumentNoteTracker();
    for (let time = 0; time < 1000; time += 23) tracker.analyze(spectrum, time, spectrum[0] === 5 ? 1 : 0);
    expect(tracker.note).toBe(0);
  }
  const residue = new InstrumentNoteTracker();
  for (let time = 0; time < 1000; time += 23) residue.analyze(tone(69, .05), time);
  expect(residue.note).toBe(0);
});
it('retains a dominant harmonic profile across a quieter accompaniment', () => {
  const tracker = new InstrumentNoteTracker();
  for (let time = 0; time < 500; time += 23) tracker.analyze(tone(69), time);
  const selected = tracker.pitch;
  for (let time = 500; time < 900; time += 23) {
    const main = tone(69), accompaniment = tone(76, 5, [.3, 1, .9, .6, .4, .3]);
    main.forEach((_, i) => main[i] += accompaniment[i]);
    tracker.analyze(main, time);
  }
  expect(tracker.pitch).toBe(selected);
  expect(tracker.note).toBe(1);
});

it('confirms a leading subharmonic before counting a piano attack', () => {
  const tracker = new InstrumentNoteTracker();
  tracker.analyze(tone(53, .5), 0);
  expect(tracker.note).toBe(0);
  for (let time = 23; time <= 230; time += 23) tracker.analyze(tone(60, 30), time);
  expect(tracker.pitch).toBe(60);
  expect(tracker.note).toBe(1);
});

it('refines a faint leading tail into the full attack without flashing twice', () => {
  const tracker = new InstrumentNoteTracker();
  tracker.analyze(tone(64, .4), 0);
  tracker.analyze(tone(64, .4), 23);
  expect(tracker.note).toBe(1);
  for (let time = 46; time <= 230; time += 23) tracker.analyze(tone(67, 30), time);
  expect(tracker.pitch).toBe(67);
  expect(tracker.note).toBe(1);
  for (let time = 253; time <= 345; time += 23) tracker.analyze(tone(72, 30), time);
  expect(tracker.note).toBe(2);
});

it('still counts distinct fast notes at comparable attack strength', () => {
  const tracker = new InstrumentNoteTracker();
  for (const time of [0, 23, 46]) tracker.analyze(tone(60), time);
  for (const time of [69, 92, 115]) tracker.analyze(tone(64), time);
  expect(tracker.pitch).toBe(64);
  expect(tracker.note).toBe(2);
});
