import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cacheKey } from './beat-event-cache';
import { parseMediaAsset } from '../extensions/kanban-music/media-asset.js';
import { MAX_RESPONSE_BYTES } from '../src/features/music/event-track';
import { parseRange, parseSparseManifest, sparseChunk } from '../src/features/music/event-track-ranges';

// Explicit development-only fixture cache. Never configured by deployed APIs.
export async function localPercussionListeningCache(request: Request, directory: string): Promise<Response> {
  const reply = (value: object, status = 200) =>
    Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

  try {
    if (request.method !== 'GET') return reply({ status: 'unavailable' }, 503);

    const url = new URL(request.url);
    const asset = parseMediaAsset({
      provider: url.searchParams.get('provider'),
      id: url.searchParams.get('id'),
    });
    if (!asset || asset.provider !== 'soundcloud' || !asset.id.startsWith('private-local/')) {
      return reply({ status: 'miss' }, 404);
    }

    const load = async (name: string) => {
      const path = resolve(directory, cacheKey(asset), name);
      if ((await stat(path)).size > MAX_RESPONSE_BYTES) throw new Error('Oversized private cache');
      return JSON.parse(await readFile(path, 'utf8'));
    };

    const manifest = parseSparseManifest(await load('manifest.json'), asset);
    if (!manifest) return reply({ error: 'invalid_cache' }, 502);

    const indexValue = url.searchParams.get('chunk');
    if (indexValue !== null) {
      if (!/^\d{1,5}$/.test(indexValue)) return reply({ error: 'invalid_chunk' }, 400);

      const index = Number(indexValue);
      if (!manifest.chunks.some((chunk) => chunk.index === index)) {
        return reply({ status: 'miss' }, 404);
      }

      const chunk = await load(`${index}.json`);
      return sparseChunk(chunk, manifest, index) ? reply(chunk) : reply({ error: 'invalid_cache' }, 502);
    }

    const start = Number(url.searchParams.get('start'));
    const end = Number(url.searchParams.get('end'));
    const range = parseRange({ start, end });
    if (!range || end > manifest.duration) return reply({ error: 'invalid_range' }, 400);

    const chunks = manifest.chunks.filter((chunk) => chunk.index >= start / 30 && chunk.index * 30 < end);
    return reply({ ...manifest, requestedRange: range, chunks });
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT'
      ? reply({ status: 'miss' }, 404)
      : reply({ error: 'invalid_cache' }, 502);
  }
}
