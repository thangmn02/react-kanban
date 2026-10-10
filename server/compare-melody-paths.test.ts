// @vitest-environment node
import { expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { deterministicLeadSelector, selectLeadNotes } from './lead-note-selection';

it('compares the unchanged accepted lead path without publishing experimental data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kora-melody-comparison-'));
  try {
    const candidates = [{ source: 'piano' as const, energy: .1, notes: [
      { start: 0, end: 1.2, pitch: 78, amp: .8 },
      { start: 0, end: 1.2, pitch: 43, amp: .9 },
      { start: 1, end: 2, pitch: 80, amp: .8 },
    ] }];
    const input = join(directory, 'input.json'), output = join(directory, 'comparison.json');
    await writeFile(input, JSON.stringify({ asset: { provider: 'youtube', id: 'abcdefghijk' }, candidates: [
      ...candidates, { source: 'vocals', energy: 10, notes: candidates[0].notes },
    ] }));
    execFileSync(process.execPath, [resolve('scripts/compare-melody-paths.mjs'), input, output], { stdio: 'pipe' });
    const result = JSON.parse(await readFile(output, 'utf8'));
    expect(result.decision).toEqual(deterministicLeadSelector.select(candidates));
    const notes = selectLeadNotes(candidates[0].notes);
    expect(result.events.map((event: { playbackTime: number; duration: number }) => ({ time: event.playbackTime, duration: event.duration })))
      .toEqual(notes.map(note => ({ time: note.start, duration: note.end - note.start })));
    expect(result.events.every((event: { type: string; source: string }) => event.type === 'melody' && event.source === 'server-cache')).toBe(true);
  } finally {
    await rm(directory, { recursive: true });
  }
});
