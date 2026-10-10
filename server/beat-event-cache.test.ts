// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheKey, handleBeatEventCache } from './beat-event-cache';
import { LEAD_ANALYSIS_VERSION } from '../src/features/music/lead-events';
const asset = { provider: 'youtube' as const, id: 'abcdefghijk' };
it('rejects processing outside the private authorized asset without dispatching', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  const response = await handleBeatEventCache(new Request('https://app.example/api/beat-events?provider=youtube&id=abcdefghijk', {
    method: 'POST', body: JSON.stringify({ operation: 'demand', analysisVersion: LEAD_ANALYSIS_VERSION }),
  }), { leadEnabled: true, leadAuthorizedAsset: 'youtube:xxxxxxxxxxx' });
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: 'audio_scope_denied' });
  expect(fetch).not.toHaveBeenCalled();
});
const manifest = { version: 1, asset, revision: 'r', analysisVersion: 'reference-v1', duration: 60, chunkSeconds: 30, melodyPolicy: 'dominant-monophonic' };
let directory: string | undefined;
afterEach(async () => { vi.restoreAllMocks(); if (directory) await rm(directory, { recursive: true }); directory = undefined; });
const request = (suffix = '', method = 'GET', token?: string) => new Request(`https://kora.example/api/beat-events?provider=youtube&id=abcdefghijk${suffix}`, { method,
  headers: token ? { Authorization: `Bearer ${token}` } : {} });

it('requires server-controlled beta membership for Lead cache access',async()=>{
  const suffix='&analysisVersion='+LEAD_ANALYSIS_VERSION;
  const config={leadEnabled:true,leadAccess:'private-beta' as const,leadBetaUsers:'allowed-user',supabaseUrl:'https://auth.example',supabaseAnonKey:'test-key'};
  const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({id:'different-user'}));
  expect((await handleBeatEventCache(request(suffix),config)).status).toBe(401);
  expect(fetcher).not.toHaveBeenCalled();
  expect((await handleBeatEventCache(request(suffix,'GET','token'),config)).status).toBe(403);
  fetcher.mockResolvedValue(Response.json({id:'allowed-user'}));
  directory=await mkdtemp(join(tmpdir(),'kora-lead-cache-'));
  expect((await handleBeatEventCache(request(suffix,'GET','token'),{...config,cacheDirectory:directory})).status).toBe(404);
});

it('does not activate heavy Lead processing from a public UI or cache flag',async()=>{
  const fetcher=vi.spyOn(globalThis,'fetch');
  const suffix='&analysisVersion='+LEAD_ANALYSIS_VERSION+'&operation=segment';
  const config={leadEnabled:true,leadAccess:'public' as const,analysisUrl:'https://worker.example/jobs',analysisKey:'test-key'};
  expect((await handleBeatEventCache(request(suffix,'POST'),config)).status).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
  expect((await handleBeatEventCache(request(suffix),{...config,leadEnabled:false})).status).toBe(503);
});

it.each(['analysisVersion=legacy','operation=end'])('rejects conflicting query/body admission before authorization or processing: %s',async query=>{
  const fetcher=vi.spyOn(globalThis,'fetch');
  const submission=new Request(`https://kora.example/api/beat-events?provider=youtube&id=abcdefghijk&${query}`,{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer token'},
    body:JSON.stringify({schemaVersion:2,analysisVersion:LEAD_ANALYSIS_VERSION,operation:'demand'})});
  expect((await handleBeatEventCache(submission,{leadEnabled:true})).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});
it('reads real precomputed cache files, reports misses and validates the full asset contract', async () => {
  directory = await mkdtemp(join(tmpdir(), 'kora-beat-cache-'));
  const path = join(directory, cacheKey(asset)); await mkdir(path);
  expect((await handleBeatEventCache(request(), { cacheDirectory: directory })).status).toBe(404);
  await writeFile(join(path, 'manifest.json'), JSON.stringify(manifest));
  await writeFile(join(path, '0.json'), JSON.stringify({ version: 1, revision: 'r', index: 0, events: [{ id: 'kick-1', time: .25, row: 'kick', confidence: .9 }] }));
  expect(await (await handleBeatEventCache(request(), { cacheDirectory: directory })).json()).toEqual(manifest);
  expect((await handleBeatEventCache(request('&chunk=0'), { cacheDirectory: directory })).status).toBe(200);
  expect((await handleBeatEventCache(request('&chunk=../../etc'), { cacheDirectory: directory })).status).toBe(400);
  await writeFile(join(path, 'manifest.json'), JSON.stringify({ ...manifest, asset: { ...asset, id: 'wrong-track' } }));
  expect((await handleBeatEventCache(request(), { cacheDirectory: directory })).status).toBe(502);
});
it('does not pretend to enqueue analysis when no service is configured', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  expect((await handleBeatEventCache(request('', 'POST'), {})).status).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
});

it('keeps first-party development identities unavailable to public and unscoped gateways', async () => {
  const id = 'a'.repeat(64), fetcher = vi.spyOn(globalThis, 'fetch');
  const request = new Request(`https://kora.example/api/beat-events?provider=kora-development&id=${id}&analysisVersion=${LEAD_ANALYSIS_VERSION}`);
  for (const config of [{}, { leadAccess: 'development' as const },
    { leadAccess: 'public' as const, leadAuthorizedAsset: `kora-development:${id}` }]) {
    expect((await handleBeatEventCache(request, config)).status).toBe(403);
  }
  expect(fetcher).not.toHaveBeenCalled();
  expect((await handleBeatEventCache(request, { leadAccess: 'development', leadAuthorizedAsset: `kora-development:${id}` })).status).toBe(503);
});
it('authenticates asynchronous submissions and requires a real accepted job acknowledgement', async () => {
  const config = { analysisUrl: 'https://worker.example/jobs', analysisKey: 'test-service-key', supabaseUrl: 'https://auth.example', supabaseAnonKey: 'test-public-key' };
  expect((await handleBeatEventCache(request('', 'POST'), config)).status).toBe(401);
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ id: 'test-user' }))
    .mockResolvedValueOnce(Response.json({ jobId: 'job-1' }, { status: 202 }));
  const result = await handleBeatEventCache(request('', 'POST', 'test-user-token'), config);
  expect(result.status).toBe(202); expect(await result.json()).toMatchObject({ status: 'pending', jobId: 'job-1' });
  expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ 'Idempotency-Key': cacheKey(asset) });
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual(expect.objectContaining({ asset, cacheKey: cacheKey(asset) }));
  fetcher.mockResolvedValueOnce(Response.json({ id: 'test-user' }));
  expect((await handleBeatEventCache(request('', 'POST', 'test-user-token'), config)).status).toBe(429);
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('supports bearer-authenticated desktop preflight and public cache access without cookies', async () => {
  const preflight = await handleBeatEventCache(new Request('https://kora.example/api/beat-events', {
    method: 'OPTIONS', headers: { Origin: 'http://tauri.localhost', 'Access-Control-Request-Headers': 'authorization' } }), {});
  expect(preflight.status).toBe(200);
  expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('*');
  expect(preflight.headers.get('Access-Control-Allow-Headers')).toBe('Authorization, Content-Type');
  expect(preflight.headers.has('Access-Control-Allow-Credentials')).toBe(false);
});

it('rejects invalid auth and unacknowledged jobs, and bounds per-user analysis submissions', async () => {
  const config = { analysisUrl: 'https://worker.example/jobs', analysisKey: 'test', supabaseUrl: 'https://auth.example', supabaseAnonKey: 'test' };
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({}, { status: 401 }));
  expect((await handleBeatEventCache(request('', 'POST', 'invalid'), config)).status).toBe(401);
  fetcher.mockResolvedValueOnce(Response.json({ id: 'no-job-user' })).mockResolvedValueOnce(Response.json({}, { status: 200 }));
  expect((await handleBeatEventCache(request('', 'POST', 'valid'), config)).status).toBe(503);
  fetcher.mockImplementation(async (url) => String(url).includes('/auth/v1/user') ? Response.json({ id: 'bounded-user' })
    : Response.json({ jobId: 'real-ack' }, { status: 202 }));
  for (let i = 0; i < 6; i++) {
    const req = new Request(`https://kora.example/api/beat-events?provider=deezer&id=${i}`, { method: 'POST', headers: { Authorization: 'Bearer valid' } });
    expect((await handleBeatEventCache(req, config)).status).toBe(i < 5 ? 202 : 429);
  }
});
