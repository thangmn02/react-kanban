// Private comparison only; deliberately separate from the production exporter.
import { readFile, writeFile } from 'node:fs/promises';
import { melodicRoleTracker, MELODIC_ROLE_VERSION } from '../server/melodic-role-tracker.ts';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/select-melodic-role.mjs <candidates.json> <private-output.json>');
const value = JSON.parse(await readFile(input, 'utf8'));
const result = melodicRoleTracker.track(value.candidates, value.duration);
const dispositions = value.candidates.map(candidate => {
  const counts = { retained: 0, 'amplitude-or-duration': 0, 'phrase-admission': 0, 'source-ownership': 0, 'voice-path': 0 };
  const events = candidate.notes.map(note => {
    const phrase = result.phrases.find(phrase => phrase.source === candidate.source && note.start >= phrase.start && note.start < phrase.end);
    const owner = result.sections.find(section => note.start >= section.start && note.start < section.end)?.source;
    const retained = owner === candidate.source && result.notes.some(selected => selected.start === note.start && selected.pitch === note.pitch);
    const inContinuation = phrase?.continuation && note.start >= phrase.continuation.from && note.start < phrase.continuation.until;
    const minimumDuration = inContinuation ? .10 : .16;
    let reason = 'voice-path';
    if (retained) reason = 'retained';
    else if (note.amp < .32 || note.end - note.start < minimumDuration) reason = 'amplitude-or-duration';
    else if (!phrase) reason = 'phrase-admission';
    else if (owner !== candidate.source) reason = 'source-ownership';
    counts[reason]++;
    return { ...note, reason, owner, inputSource: candidate.source };
  });
  return { source: candidate.source, rawCount: candidate.notes.length, counts, events };
});
await writeFile(output, JSON.stringify({ version: MELODIC_ROLE_VERSION, duration: value.duration, ...result, dispositions }));
