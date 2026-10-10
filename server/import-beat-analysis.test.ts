// @vitest-environment node
import { afterEach, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { cacheKey, handleBeatEventCache } from './beat-event-cache';
import { parseManifest, parseChunk } from '../src/features/music/event-track';
const asset = { provider: 'youtube' as const, id: 'abcdefghijk' };
let directory: string | undefined;
afterEach(async () => { if (directory) await rm(directory, { recursive: true }); directory = undefined; });
const input = () => ({ asset, duration: 100, offset: 29, leadSource: 'piano', onsets: [
  { row: 'kick', time: .5, confidence: .9 }, { row: 'snare', time: 1.5, confidence: .8 },
], notes: [
  { start: 0, end: 1.2, pitch: 72, amp: .8 }, { start: 1, end: 1.5, pitch: 74, amp: .8 },
  { start: 2, end: 2.8, pitch: 76, amp: .8 },
  { start: 0, end: 1, pitch: 40, amp: .8 }, { start: 1, end: 2, pitch: 42, amp: .8 },
  { start: 2, end: 3, pitch: 44, amp: .8 },
] });
async function run(value: unknown) {
  directory = await mkdtemp(join(tmpdir(), 'kora-analysis-import-'));
  const path = join(directory, 'analysis.json');
  await writeFile(path, JSON.stringify(value));
  return () => execFileSync(process.execPath, [resolve('scripts/import-beat-analysis.mjs'), path, join(directory!, 'cache')], { encoding: 'utf8', stdio: 'pipe' });
}
it('publishes selected lead and percussion through the real cache API across chunk boundaries', async () => {
  expect((await run(input()))()).toContain('3 lead attacks');
  const config = { cacheDirectory: join(directory!, 'cache') };
  const request = (chunk?: number) => new Request(`https://kora.example/api/beat-events?provider=youtube&id=abcdefghijk${chunk === undefined ? '' : `&chunk=${chunk}`}`);
  const manifest = parseManifest(await (await handleBeatEventCache(request(), config)).json(), asset);
  expect(manifest).toMatchObject({ duration: 100, melodyPolicy: 'dominant-monophonic', analysisVersion: 'lead-selector-v2' });
  if (!manifest) throw new Error('Invalid exported manifest');
  const first = parseChunk(await (await handleBeatEventCache(request(0), config)).json(), manifest, 0);
  const second = parseChunk(await (await handleBeatEventCache(request(1), config)).json(), manifest, 1);
  if (!first || !second) throw new Error('Invalid exported chunks');
  expect(first.events.map((event: { row: string; time: number }) => [event.row, event.time])).toEqual([['melody', 29], ['kick', 29.5]]);
  expect(first.events[0].duration).toBe(1);
  expect(second.events.map((event: { row: string; time: number }) => [event.row, event.time])).toEqual([['melody', 30], ['snare', 30.5], ['melody', 31]]);
  expect(JSON.parse(await readFile(join(config.cacheDirectory, cacheKey(asset), '3.json'), 'utf8')).events).toEqual([]);
});
it('rejects invalid analysis before writing any cache file', async () => {
  const invoke = await run({ ...input(), onsets: [{ row: 'melody', time: .5, confidence: .9 }] });
  expect(invoke).toThrow();
  expect(await readdir(directory!)).toEqual(['analysis.json']);
});
