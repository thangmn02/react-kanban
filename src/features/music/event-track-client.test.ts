import { afterEach, expect, it, vi } from 'vitest';
import { createEventTrackClient } from './event-track-client';
import { beatCapabilities } from './beat-capabilities';
vi.mock('../native/runtime', () => ({ isNativeWidget: () => true }));
vi.mock('../../lib/supabase', () => ({ default: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
afterEach(() => { vi.restoreAllMocks(); });
const asset = { provider: 'youtube' as const, id: 'abcdefghijk' };
const manifest = { version: 1, asset, revision: 'r', analysisVersion: 'offline', duration: 60, chunkSeconds: 30, melodyPolicy: 'dominant-monophonic' };
it('uses the real native cache endpoint, omits cookies and propagates lifetime and seek cancellation', async () => {
  const lifetime = new AbortController(), range = new AbortController();
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json(manifest))
    .mockResolvedValueOnce(Response.json({ version: 1, revision: 'r', index: 0, events: [] }));
  const client = createEventTrackClient(asset, lifetime.signal, 60);
  const parsed = await client.manifest(); await client.chunk(parsed!, 0, range.signal);
  expect(fetcher.mock.calls[0][0]).toBe('https://koraspace.online/api/beat-events?provider=youtube&id=abcdefghijk');
  expect(fetcher.mock.calls[0][1]?.credentials).toBe('omit');
  const chunkSignal = fetcher.mock.calls[1][1]?.signal; range.abort(); expect(chunkSignal?.aborted).toBe(true);
  lifetime.abort(); expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
});
it('rejects malformed cache data and does not claim anonymous analysis was queued', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ ...manifest, version: 99 }));
  const client = createEventTrackClient(asset, new AbortController().signal);
  await expect(client.manifest()).rejects.toThrow('Invalid EventTrack');
  expect(await client.requestAnalysis()).toBe('unavailable'); expect(fetcher).toHaveBeenCalledOnce();
});
it('distinguishes estimated native timing, output-capable tab timing and unavailable audio capture', () => {
  expect(beatCapabilities(true, false)).toEqual({ tier: 'native-monitor', captureClock: 'estimated' });
  expect(beatCapabilities(false, true)).toEqual({ tier: 'tab-capture', captureClock: 'output-clock-capable' });
  expect(beatCapabilities(false, false)).toEqual({ tier: 'clock-only', captureClock: 'unavailable' });
});
