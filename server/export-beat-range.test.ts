// @vitest-environment node
import { afterEach, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ANALYSIS_VERSION, parseSparseManifest, sparseChunk } from '../src/features/music/event-track-ranges';
const asset = { provider: 'youtube' as const, id: 'abcdefghijk' };
let directory: string | undefined;
afterEach(async () => { if (directory) await rm(directory, { recursive: true }); directory = undefined; });
it('clips context attacks and sustained holds to the requested core with absolute playback timestamps', async () => {
  directory = await mkdtemp(join(tmpdir(), 'kora-range-export-'));
  const input = join(directory, 'input.json'), output = join(directory, 'output');
  await writeFile(input, JSON.stringify({ duration: 70, job: { asset, duration: 7200, analysisVersion: ANALYSIS_VERSION,
    requestedRange: { start: 2040, end: 2100 } }, offset: 2035, candidates: [], onsets: [
      { row: 'kick', time: 4, confidence: .9 }, { row: 'bass', time: 5.25, duration: .8, confidence: .7 },
      { row: 'bass', time: 64.9, duration: 2, confidence: .7 }, { row: 'hat', time: 65, confidence: .8 },
    ] }));
  execFileSync(process.execPath, [resolve('scripts/export-beat-range.mjs'), input, output], { stdio: 'pipe' });
  const result = JSON.parse(await readFile(join(output, 'result.json'), 'utf8'));
  const manifest = parseSparseManifest({ schemaVersion: 2, asset, duration: 7200, analysisVersion: ANALYSIS_VERSION,
    timelineId: 'vod', chunkSeconds: 30, melodyPolicy: 'dominant-monophonic', requestedRange: { start: 2040, end: 2100 },
    chunks: result.chunks.map((chunk: { index: number; revision: string }) => ({ index: chunk.index, revision: chunk.revision })) }, asset)!;
  expect(result.eventCount).toBe(2);
  const first = sparseChunk(JSON.parse(await readFile(join(output, '68.json'), 'utf8')), manifest, 68)!;
  const last = sparseChunk(JSON.parse(await readFile(join(output, '69.json'), 'utf8')), manifest, 69)!;
  expect(first.events[0]).toMatchObject({ row: 'bass', time: 2040.25, duration: .8 });
  expect(last.events[0].duration).toBeCloseTo(.1);
  expect(result.chunks.every((chunk: { bytes: number }) => chunk.bytes < 524288)).toBe(true);
});
