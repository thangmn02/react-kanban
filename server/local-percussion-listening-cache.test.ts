// @vitest-environment node
import { it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheKey } from './beat-event-cache';
import { localPercussionListeningCache } from './local-percussion-listening-cache';

it('serves only validated sparse fixture ranges and reports uncached coverage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'private-percussion-'));
  const asset = { provider: 'soundcloud' as const, id: 'private-local/fixture' };
  const folder = join(directory, cacheKey(asset));
  const revision = 'a'.repeat(64);
  const request = (suffix: string) =>
    new Request(
      `http://localhost/api/beat-events?provider=soundcloud&id=private-local/fixture${suffix}`,
    );

  try {
    await mkdir(folder);
    await writeFile(
      join(folder, 'manifest.json'),
      JSON.stringify({
        schemaVersion: 2,
        asset,
        analysisVersion: 'private-reference-v1',
        timelineId: 'vod',
        duration: 90,
        chunkSeconds: 30,
        melodyPolicy: 'dominant-monophonic',
        requestedRange: { start: 0, end: 90 },
        chunks: [{ index: 0, revision }],
      }),
    );
    await writeFile(
      join(folder, '0.json'),
      JSON.stringify({
        schemaVersion: 2,
        index: 0,
        revision,
        events: [
          {
            eventId: 'kick-1',
            type: 'kick',
            playbackTime: 1,
            confidence: 0.9,
            duration: 0,
            source: 'server-cache',
          },
        ],
      }),
    );

    expect((await localPercussionListeningCache(request('&chunk=0'), directory)).status).toBe(200);
    const missing = await (
      await localPercussionListeningCache(request('&start=30&end=90'), directory)
    ).json();
    expect(missing).toMatchObject({ chunks: [] });
    expect((await localPercussionListeningCache(request('&chunk=1'), directory)).status).toBe(404);
    expect((await localPercussionListeningCache(request('&chunk=../../private'), directory)).status).toBe(
      400,
    );
    expect(
      (await localPercussionListeningCache(request('&start=1&end=90'), directory)).status,
    ).toBe(400);

    await writeFile(
      join(folder, '0.json'),
      JSON.stringify({
        schemaVersion: 2,
        index: 0,
        revision,
        events: [
          {
            eventId: 'bad',
            type: 'all',
            playbackTime: 1,
            confidence: 0.9,
            duration: 0,
            source: 'server-cache',
          },
        ],
      }),
    );
    expect((await localPercussionListeningCache(request('&chunk=0'), directory)).status).toBe(502);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
