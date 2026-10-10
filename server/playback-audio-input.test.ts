// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handlePlaybackAudioInput, registerPlaybackDemand } from './playback-audio-input';
import { createPlaybackAudioBuffer } from '../src/features/music/playback-audio-segment';
import { ANALYSIS_VERSION } from '../src/features/music/event-track-ranges';
import { LEAD_ANALYSIS_VERSION } from '../src/features/music/lead-events';
const owner = '10000000-0000-4000-8000-000000000001', track = '20000000-0000-4000-8000-000000000001';
const job = '30000000-0000-4000-8000-000000000001';
const asset = { provider: 'youtube' as const, id: 'abcdefghijk' };
const base = new URL('https://storage.example');
function request(audio: Uint8Array = new Uint8Array(1)) {
  const metadata = new URLSearchParams({ provider: asset.provider, id: asset.id, operation: 'segment',
    analysisVersion: ANALYSIS_VERSION, demandId: owner, duration: '90', start: '0', end: '30', inputStart: '0' });
  return new Request(`https://kora.example/api/beat-events?${metadata}`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: new Blob([audio as Uint8Array<ArrayBuffer>]) });
}
const database = () => vi.fn().mockResolvedValueOnce([{ track_id: track, range_start: 0, range_end: 90 }])
  .mockResolvedValueOnce([{ provider: asset.provider, media_asset_id: asset.id, analysis_version: ANALYSIS_VERSION, duration: 90 }])
  .mockResolvedValueOnce([]).mockResolvedValueOnce([]);
function capturedWav() {
  let wav: Uint8Array | undefined;
  const buffer = createPlaybackAudioBuffer(segment => { wav = segment.audio; });
  for (let index = 0; index < 300; index++) buffer.push(new Float32Array(8820).fill(.2),
    { currentTime: (index + 1) / 10, sampledAt: 10000, playbackRate: 1, playing: true, paused: false }, 10000);
  return wav!;
}
afterEach(() => vi.restoreAllMocks());
describe('protected captured-audio admission', () => {
  it('claims captured Lead input with the validated track version', async () => {
    const original = request(capturedWav());
    const url = new URL(original.url); url.searchParams.set('analysisVersion', LEAD_ANALYSIS_VERSION);
    const input = new Request(url, original);
    const db = vi.fn().mockResolvedValueOnce([{ track_id: track, range_start: 0, range_end: 90 }])
      .mockResolvedValueOnce([{ provider: asset.provider, media_asset_id: asset.id, analysis_version: LEAD_ANALYSIS_VERSION, duration: 90 }])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([])
      .mockResolvedValueOnce({ trackId: track, jobs: [] });
    vi.spyOn(globalThis, 'fetch');
    const dispatch = vi.fn();
    expect((await handlePlaybackAudioInput(input, asset, owner, base, 'server-test', new AbortController().signal, db, dispatch, true)).status).toBe(202);
    expect(JSON.parse(String(db.mock.calls.at(-1)?.[1]?.body)).p_version).toBe(LEAD_ANALYSIS_VERSION);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('registers demand without invoking a model or creating missing-future jobs', async () => {
    const db = vi.fn().mockResolvedValue(track);
    expect(await registerPlaybackDemand(db, owner, asset, owner, 90, 0, 90)).toBe(track);
    expect(db).toHaveBeenCalledOnce();
    expect(db.mock.calls[0][0]).toBe('rpc/register_beat_demand');
  });
  it('rejects ended demand and source mismatch before reading or storing raw audio', async () => {
    const storage = vi.spyOn(globalThis, 'fetch'), dispatch = vi.fn();
    const result = await handlePlaybackAudioInput(request(), asset, owner, base, 'server-test', new AbortController().signal,
      vi.fn().mockResolvedValue([]), dispatch);
    expect(result).toMatchObject({ status: 409, body: { error: 'demand_inactive' } });
    expect(storage).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled();
  });
  it('reuses ready cache with no storage write or analysis dispatch', async () => {
    const db = database(); db.mockReset().mockResolvedValueOnce([{ track_id: track, range_start: 0, range_end: 90 }])
      .mockResolvedValueOnce([{ provider: asset.provider, media_asset_id: asset.id, analysis_version: ANALYSIS_VERSION, duration: 90 }])
      .mockResolvedValueOnce([{ chunk_index: 0 }]);
    const storage = vi.spyOn(globalThis, 'fetch'), dispatch = vi.fn();
    const result = await handlePlaybackAudioInput(request(), asset, owner, base, 'server-test', new AbortController().signal, db, dispatch);
    expect(result.status).toBe(200); expect(storage).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled();
  });
  it('stores bounded captured PCM privately and dispatches only the claimed core', async () => {
    const wav = capturedWav();
    const db = database().mockResolvedValueOnce({ trackId: track, jobs: [{ jobId: job, start: 0, end: 30 }] });
    const storage = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({})), dispatch = vi.fn().mockResolvedValue(undefined);
    const result = await handlePlaybackAudioInput(request(wav), asset, owner, base, 'server-test', new AbortController().signal, db, dispatch);
    expect(result.status).toBe(202); expect(dispatch).toHaveBeenCalledWith({ trackId: track, jobs: [{ jobId: job, start: 0, end: 30 }] });
    expect(db.mock.calls.at(-1)?.[0]).toBe('rpc/claim_captured_beat_range');
    expect(String(storage.mock.calls[1][0])).toContain(`${job}.json`);
    const manifest = JSON.parse(String(storage.mock.calls[1][1]?.body));
    expect(manifest).toMatchObject({ start: 0, end: 30, playbackRate: 1 });
    expect(manifest.url).toBeUndefined();
    expect(manifest.inputPath).toMatch(/^[a-f0-9]{64}\/[0-9]{13}-[a-f0-9-]{36}\.wav$/);
    expect(JSON.stringify(result)).not.toContain('server-test');
    expect(JSON.stringify(result)).not.toContain(manifest.inputPath);
  });
  it('does not resurrect demand ended while an upload body was arriving', async () => {
    const storage = vi.spyOn(globalThis, 'fetch'), dispatch = vi.fn();
    const result = await handlePlaybackAudioInput(request(capturedWav()), asset, owner, base, 'server-test', new AbortController().signal,
      database().mockResolvedValueOnce(null), dispatch);
    expect(result.status).toBe(409); expect(storage).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled();
  });
  it('does not upload when another concurrent request already claimed the range', async () => {
    const storage = vi.spyOn(globalThis, 'fetch'), dispatch = vi.fn();
    const result = await handlePlaybackAudioInput(request(capturedWav()), asset, owner, base, 'server-test', new AbortController().signal,
      database().mockResolvedValueOnce({ trackId: track, jobs: [] }), dispatch);
    expect(result.status).toBe(202); expect(storage).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled();
  });
  it('removes only this job input and releases admission after storage failure', async () => {
    const db = database().mockResolvedValueOnce({ trackId: track, jobs: [{ jobId: job, start: 0, end: 30 }] }).mockResolvedValue(undefined);
    const storage = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(Response.json({}));
    await expect(handlePlaybackAudioInput(request(capturedWav()), asset, owner, base, 'server-test', new AbortController().signal, db, vi.fn())).rejects.toThrow();
    expect(db.mock.calls.at(-1)?.[0]).toContain(`id=eq.${job}&state=eq.pending`);
    const removed = JSON.parse(String(storage.mock.calls.at(-1)?.[1]?.body)).prefixes;
    expect(removed).toHaveLength(2); expect(removed[1]).toContain(`${job}.json`);
  });
  it('rejects malformed or oversized inputs before storage and dispatch', async () => {
    const storage = vi.spyOn(globalThis, 'fetch'), dispatch = vi.fn();
    const result = await handlePlaybackAudioInput(request(), asset, owner, base, 'server-test', new AbortController().signal, database(), dispatch);
    expect(result.status).toBe(400); expect(storage).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled();
  });
});
