// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import type { ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { beatCacheDevelopmentPlugin } from './vite-beat-cache-plugin';
import { MAX_PLAYBACK_AUDIO_BYTES } from './playback-audio-input';
const handlers = vi.hoisted(() => ({ cache: vi.fn() }));
vi.mock('./beat-event-cache', () => ({ handleBeatEventCache: handlers.cache }));
beforeEach(() => { handlers.cache.mockReset().mockResolvedValue(Response.json({ status: 'unavailable' }, { status: 503 })); });

async function submit(bytes: number, contentType = 'audio/wav', operation = 'segment') {
  let middleware: ((request: IncomingMessage, response: ServerResponse) => Promise<void>) | undefined;
  const plugin = beatCacheDevelopmentPlugin({});
  const setup = plugin.configureServer as (server: ViteDevServer) => void;
  setup({ middlewares: { use: (_path: string, handler: typeof middleware) => { middleware = handler; } } } as unknown as ViteDevServer);
  const response = { writeHead: vi.fn(), end: vi.fn() };
  const request = { method: 'POST', url: `?provider=youtube&id=abcdefghijk&operation=${operation}`,
    headers: { host: 'localhost', 'content-type': contentType },
    async *[Symbol.asyncIterator]() { yield Buffer.alloc(bytes); } };
  await middleware!(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  return response;
}

it('forwards bounded captured WAV to the same admission gates as the deployed gateway', async () => {
  const response = await submit(32044);
  expect(response.writeHead.mock.calls[0][0]).toBe(503);
  const [request] = handlers.cache.mock.calls[0];
  expect((await request.arrayBuffer()).byteLength).toBe(32044);
});

it('keeps JSON admission and captured-audio size limits separate', async () => {
  for (const [size, type, operation] of [[2049, 'application/json', 'demand'], [MAX_PLAYBACK_AUDIO_BYTES + 1, 'audio/wav', 'segment']] as const) {
    expect((await submit(size, type, operation)).writeHead.mock.calls[0][0]).toBe(400);
  }
  expect(handlers.cache).not.toHaveBeenCalled();
});
