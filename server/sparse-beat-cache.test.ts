// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { handleBeatEventCache } from './beat-event-cache';
import { ANALYSIS_VERSION } from '../src/features/music/event-track-ranges';
import { LEAD_ANALYSIS_VERSION } from '../src/features/music/lead-events';
const asset = { provider: 'youtube' as const, id: 'abcdefghijk' };
const owner = '10000000-0000-4000-8000-000000000001', track = '20000000-0000-4000-8000-000000000001';
const job = '30000000-0000-4000-8000-000000000001';
const config = { supabaseUrl: 'https://cache.example', supabaseAnonKey: 'public-test', supabaseServiceKey: 'server-test',
  analysisUrl: 'https://analyzer.example/jobs', analysisKey: 'gateway-test' };
const body = { schemaVersion: 2, analysisVersion: ANALYSIS_VERSION, operation: 'demand', demandId: owner, duration: 7200, requestedRange: { start: 2040, end: 2340 } };
const request = (value = body) => new Request('https://kora.example/api/beat-events?provider=youtube&id=abcdefghijk', {
  method: 'POST', headers: { Authorization: 'Bearer user-test', 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
afterEach(() => vi.restoreAllMocks());

it('admits the versioned Lead path only with explicit server opt-in and keeps cache identity separate',async()=>{
  const fetcher=vi.spyOn(globalThis,'fetch');
  const leadBody={...body,analysisVersion:LEAD_ANALYSIS_VERSION};
  expect((await handleBeatEventCache(request(leadBody),config)).status).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
  fetcher.mockResolvedValueOnce(Response.json({id:owner})).mockResolvedValueOnce(Response.json({trackId:track,jobs:[]}));
  expect((await handleBeatEventCache(request(leadBody),{...config,leadEnabled:true,leadAccess:'development',leadProcessingEnabled:true})).status).toBe(202);
  expect(JSON.parse(String(fetcher.mock.calls.at(-1)![1]?.body))).toMatchObject({p_version:LEAD_ANALYSIS_VERSION});
});

it('keeps sparse cache hits and overlapping admissions free of new analyzer invocations', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ id: owner }))
    .mockResolvedValueOnce(Response.json({ trackId: track, jobs: [] }));
  expect((await handleBeatEventCache(request(), config)).status).toBe(202);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const admission = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
  expect(admission).toMatchObject({ p_start: 2040, p_end: 2340, p_duration: 7200 });
  expect(fetcher.mock.calls.some(call => String(call[0]).startsWith('https://analyzer.example'))).toBe(false);
});
it('dispatches only newly claimed bounded cores and never forwards browser URLs or credentials', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ id: owner }))
    .mockResolvedValueOnce(Response.json({ trackId: track, jobs: [{ jobId: job, start: 2040, end: 2340 }] }))
    .mockResolvedValueOnce(Response.json({ callId: 'fc-real-call' }, { status: 202 })).mockResolvedValueOnce(new Response(null, { status: 204 }));
  expect((await handleBeatEventCache(request(), config)).status).toBe(202);
  expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body))).toEqual({ schemaVersion: 2, jobId: job });
  expect(fetcher.mock.calls[2][1]?.headers).toMatchObject({ Authorization: 'Bearer gateway-test' });
  expect(JSON.stringify(fetcher.mock.calls[2])).not.toContain('server-test');
});
it('rejects full-media/unbounded requests before claims and releases only the authenticated demand owner', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ id: owner }));
  expect((await handleBeatEventCache(request({ ...body, requestedRange: { start: 0, end: 7200 } }), config)).status).toBe(400);
  expect(fetcher).toHaveBeenCalledOnce();
  fetcher.mockResolvedValueOnce(Response.json({ id: owner })).mockResolvedValueOnce(new Response(null, { status: 204 }));
  expect((await handleBeatEventCache(request({ ...body, operation: 'end' }), config)).status).toBe(200);
  expect(String(fetcher.mock.calls.at(-1)![0])).toContain(`user_id=eq.${owner}`);
});
it('returns bounded ready coverage without materializing skipped media or private object paths', async () => {
  const revision = 'a'.repeat(64);
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json([{ id: track, duration: 7200 }]))
    .mockResolvedValueOnce(Response.json([{ chunk_index: 68, revision }])).mockResolvedValueOnce(Response.json([{ state: 'input_unavailable' }]));
  const result = await handleBeatEventCache(new Request(`https://kora.example/api/beat-events?provider=${asset.provider}&id=${asset.id}&start=2040&end=2340`), config);
  expect(await result.json()).toMatchObject({ schemaVersion: 2, analysisState: 'input_unavailable', requestedRange: { start: 2040, end: 2340 }, chunks: [{ index: 68, revision }] });
  expect(String(fetcher.mock.calls[1][0])).toContain('chunk_index=gte.68&chunk_index=lt.78');
});
