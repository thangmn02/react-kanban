import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createBeatEventEngine, type BeatEventOptions } from './beat-event-engine';
import { EventTrackServiceError, InvalidEventTrack, type EventTrackClient } from './event-track-client';
import type { BeatEvent } from './mediaBridge';
import { beatTelemetry } from '../../../extensions/kanban-music/beat-telemetry.js';
import type { TrackManifest, TrackChunk } from './event-track';
const asset = { provider: 'youtube' as const, id: 'abcdefghijk' };
const manifest: TrackManifest = { version: 1, asset, revision: 'r', analysisVersion: 'reference-v1', duration: 7200, chunkSeconds: 30, melodyPolicy: 'dominant-monophonic' };
const options: BeatEventOptions = { asset, duration: 7200, demand: true, capabilities: { tier: 'tab-capture', captureClock: 'output-clock-capable' } };
const clock = (position = 10) => ({ playing: true, paused: false, currentTime: position, sampledAt: Date.now(), playbackRate: 1 });
const chunk = (index: number, time = index * 30 + .25): TrackChunk => ({ version: 1, revision: 'r', index, events: [{ id: `n-${index}`, time, row: 'kick', confidence: .9 }] });
let stop: (() => void) | undefined;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10000); beatTelemetry.enable(); });
afterEach(() => { stop?.(); stop = undefined; beatTelemetry.enable(false); beatTelemetry.clear(); vi.useRealTimers(); });
const semantic = (events: BeatEvent[]) => events.filter(e => e.kind === 'onset' || e.kind === 'melody.state');
const setup = (client: EventTrackClient, config = options) => {
  const events: BeatEvent[] = [], recover = vi.fn();
  const engine = createBeatEventEngine(config, event => events.push(event), recover, () => client); stop = engine.stop;
  engine.accept({ kind: 'clock', clock: clock() });
  return { events, engine, recover };
};
it('ends and resumes analysis demand without replacing local playback ownership', async () => {
  const client: EventTrackClient = { manifest: vi.fn().mockResolvedValue(undefined), chunk: vi.fn(),
    requestAnalysis: vi.fn().mockResolvedValue('pending'), endDemand: vi.fn().mockResolvedValue(undefined) };
  const config = { ...options, demand: false };
  const { engine, events } = setup(client, config);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'local' });
  const owner = events.filter(e => e.kind === 'sync.state').at(-1)?.captureId;
  expect(client.requestAnalysis).not.toHaveBeenCalled();
  engine.setDemand(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(client.requestAnalysis).toHaveBeenCalledTimes(1);
  engine.setDemand(false);
  await vi.advanceTimersByTimeAsync(0);
  expect(client.endDemand).toHaveBeenCalledTimes(1);
  for (let second = 1; second <= 20; second++) {
    await vi.advanceTimersByTimeAsync(1000);
    engine.accept({ kind: 'clock', clock: clock(10 + second) });
    engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'local' });
  }
  expect(client.requestAnalysis).toHaveBeenCalledTimes(1);
  engine.setDemand(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(client.requestAnalysis).toHaveBeenCalledTimes(2);
  expect(events.filter(e => e.kind === 'sync.state').every(e => e.captureId === owner)).toBe(true);
  expect(config.demand).toBe(false);
});
it('keeps permanent access denial distinct from empty results and admission races',async()=>{
  const observe=vi.fn();
  const client:EventTrackClient={manifest:vi.fn().mockRejectedValue(new EventTrackServiceError(403)),chunk:vi.fn(),requestAnalysis:vi.fn().mockResolvedValue('unavailable')};
  const {engine}=setup(client,{...options,onLeadAvailability:observe});
  await vi.advanceTimersByTimeAsync(0);
  expect(observe).toHaveBeenLastCalledWith('blocked');
  for(let i=1;i<=20;i++){await vi.advanceTimersByTimeAsync(1000);engine.accept({kind:'clock',clock:clock(10+i)});}
  expect(client.manifest).toHaveBeenCalledTimes(1);
  expect(observe.mock.calls.flat()).not.toContain('empty');
});

it('reports temporary 503 availability and recovers to validated cached Lead',async()=>{
  const observe=vi.fn();
  const client:EventTrackClient={manifest:vi.fn().mockRejectedValueOnce(new EventTrackServiceError(503)).mockResolvedValue(manifest),
    chunk:vi.fn(async(_,index)=>({...chunk(index),events:[{id:'lead',row:'melody' as const,time:index*30+.25,confidence:.6}]})),requestAnalysis:vi.fn().mockResolvedValue('unavailable')};
  const {engine}=setup(client,{...options,onLeadAvailability:observe});
  await vi.advanceTimersByTimeAsync(0);expect(observe).toHaveBeenLastCalledWith('unavailable');
  for(let i=1;i<=16;i++){await vi.advanceTimersByTimeAsync(1000);engine.accept({kind:'clock',clock:clock(10+i)});}
  await vi.advanceTimersByTimeAsync(100);expect(observe).toHaveBeenLastCalledWith('ready');
});
it('distinguishes pending/unavailable/failed admission from validated empty coverage and recovers', async () => {
  const observe = vi.fn();
  const client: EventTrackClient = { manifest: vi.fn().mockResolvedValue(undefined), chunk: vi.fn(),
    requestAnalysis: vi.fn().mockResolvedValueOnce('pending').mockResolvedValueOnce('unavailable').mockRejectedValueOnce(new Error('offline')).mockResolvedValue('pending') };
  const { engine, events } = setup(client, { ...options, onLeadAvailability: observe });
  await vi.advanceTimersByTimeAsync(0); expect(observe).toHaveBeenLastCalledWith('pending');
  for (let i=1;i<=3;i++) {
    engine.accept({kind:'clock',clock:{...clock(i*40),generation:i}});
    await vi.advanceTimersByTimeAsync(0);
    if(i===1)expect(observe).toHaveBeenLastCalledWith('unavailable');
    if(i===2)expect(observe).toHaveBeenLastCalledWith('failed');
  }
  vi.mocked(client.manifest).mockResolvedValue(manifest);
  vi.mocked(client.chunk).mockImplementation(async (_,index)=>({version:1,revision:'r',index,events:[]}));
  engine.accept({kind:'clock',clock:{...clock(160),generation:4}});
  await vi.advanceTimersByTimeAsync(0);
  expect(observe).toHaveBeenLastCalledWith('empty'); expect(semantic(events)).toEqual([]);
});
it('does not let delayed admission or cache errors replace a new playback generation', async () => {
  const observe = vi.fn(); let finish!: (state:'unavailable')=>void, fail!: (error:Error)=>void;
  const client: EventTrackClient = { manifest: vi.fn().mockImplementationOnce(()=>new Promise((_,reject)=>{fail=reject;})).mockResolvedValue(manifest),
    chunk: vi.fn(async(_,index)=>({...chunk(index),events:[{id:'lead',row:'melody' as const,time:index*30+.25,confidence:.6}]})),
    requestAnalysis: vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue('pending') };
  const {engine}=setup(client,{...options,onLeadAvailability:observe});
  engine.accept({kind:'clock',clock:{...clock(60),generation:1}});
  finish('unavailable'); fail(new Error('old source error')); await vi.advanceTimersByTimeAsync(0);
  expect(observe.mock.calls.flat()).not.toContain('unavailable');expect(observe.mock.calls.flat()).not.toContain('failed');
  engine.accept({kind:'clock',clock:clock(60)});await vi.advanceTimersByTimeAsync(100);
  expect(observe).toHaveBeenLastCalledWith('ready');
  engine.stop(); const count=observe.mock.calls.length;await vi.advanceTimersByTimeAsync(100);expect(observe).toHaveBeenCalledTimes(count);
});
it('preserves five coincident semantic identities through cache merging and scheduling', async () => {
  const rows = ['kick', 'snare', 'hat', 'bass', 'melody'] as const;
  const cached: TrackChunk = { version: 1, revision: 'r', index: 0,
    events: rows.map(row => ({ id: `actual-${row}`, row, time: 10.25, confidence: .9 })) };
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn((_: TrackManifest, index: number) => Promise.resolve(index === 0 ? cached : undefined)),
    requestAnalysis: vi.fn().mockResolvedValue('unavailable') };
  const { events } = setup(client);
  await vi.advanceTimersByTimeAsync(300);
  const notes = semantic(events);
  expect(notes).toHaveLength(5);
  expect(new Set(notes.map(event => event.semanticKey)).size).toBe(5);
  expect(notes.flatMap(event => event.telemetry?.map(trace => trace.eventId) || [])).toEqual(rows.map(row => `actual-${row}`));
  expect(notes.flatMap(event => event.telemetry?.map(trace => trace.type) || [])).toEqual(['kick', 'snare', 'hat', 'bass', 'melodic']);
  expect(notes.every(event => event.telemetry?.[0].origin === 'event-track-cache')).toBe(true);
});
it('observes real local events when upstream diagnostics are disabled without inventing a detector stage', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(undefined), chunk: vi.fn(), requestAnalysis: vi.fn().mockResolvedValue('unavailable') };
  const { engine, events } = setup(client);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'local' });
  engine.accept({ kind: 'onset', captureId: 'local', sequence: 1, bands: ['hat'], targetPlaybackTime: 10.25, playbackClock: clock() });
  await vi.advanceTimersByTimeAsync(300);
  const trace = semantic(events)[0].telemetry![0];
  expect(trace).toMatchObject({ type: 'hat', eventSource: 'local', targetPlaybackTime: 10.25, origin: 'local-detector' });
  const stages = beatTelemetry.snapshot().records.filter(event => event.id === trace.id).map(event => event.stage);
  expect(stages).toContain('EVENT_RECEIVED'); expect(stages).not.toContain('EVENT_DETECTED');
});

it('preserves raw local row identities and unknown class confidence through merging', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(undefined), chunk: vi.fn(), requestAnalysis: vi.fn() };
  const { engine, events } = setup(client, { ...options, demand: false });
  const bands = ['kick', 'clap', 'hat', 'bass'] as const;
  const traces = beatTelemetry.events('onset', [...bands], { origin: 'local-detector' })!;
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'raw-local' });
  engine.accept({ kind: 'onset', captureId: 'raw-local', sequence: 1, bands: [...bands],
    targetPlaybackTime: 10.25, playbackClock: clock(), telemetry: traces });
  engine.accept({ kind: 'tempo.state', captureId: 'raw-local', tempo: { locked: true, bpm: 120, confidence: 1 } });
  engine.accept({ kind: 'tempo.tick', captureId: 'raw-local', targetPlaybackTime: 10.25, playbackClock: clock(),
    tick: { step: 0, phase: 0, beatPosition: 0, subdivision: 2 } });
  await vi.advanceTimersByTimeAsync(300);
  const output = events.filter(event => event.kind === 'onset');
  expect(output.map(event => event.bands)).toEqual(bands.map(band => [band]));
  expect(output.flatMap(event => event.telemetry?.map(trace => trace.id) || [])).toEqual(traces.map(trace => trace.id));
  expect(output.flatMap(event => event.telemetry || []).map(trace => ({ type: trace.type, confidence: trace.confidence, origin: trace.origin })))
    .toEqual(['kick', 'snare', 'hat', 'bass'].map(type => ({ type, confidence: null, origin: 'local-detector' })));
  expect(new Set(output.map(event => event.semanticKey)).size).toBe(4);
  expect(events.some(event => event.kind === 'melody.state')).toBe(false);
  expect(client.requestAnalysis).not.toHaveBeenCalled();
});
it('never performs cache or server work for music playback without visible Beat Grid demand', async () => {
  const client = { manifest: vi.fn(), chunk: vi.fn(), requestAnalysis: vi.fn(), endDemand: vi.fn() };
  const { engine } = setup(client, { ...options, demand: false });
  for (let i = 0; i < 60; i++) { engine.accept({ kind: 'clock', clock: clock(i) }); await vi.advanceTimersByTimeAsync(1000); }
  expect(client.manifest).not.toHaveBeenCalled(); expect(client.requestAnalysis).not.toHaveBeenCalled();
  expect(client.chunk).not.toHaveBeenCalled(); expect(client.endDemand).not.toHaveBeenCalled();
});
it('requests a seek destination directly and ends demand on pause/source shutdown', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(undefined), chunk: vi.fn(), requestAnalysis: vi.fn().mockResolvedValue('pending'), endDemand: vi.fn().mockResolvedValue(undefined) };
  const { engine } = setup(client);
  await vi.advanceTimersByTimeAsync(0);
  engine.accept({ kind: 'clock', clock: { ...clock(2060), generation: 1 } });
  await vi.advanceTimersByTimeAsync(0);
  expect(client.requestAnalysis.mock.calls.at(-1)![0]).toEqual({ start: 2040, end: 2340 });
  engine.accept({ kind: 'clock', clock: { ...clock(2060), generation: 1, paused: true, playing: false } });
  await vi.advanceTimersByTimeAsync(0);
  expect(client.endDemand).toHaveBeenCalledTimes(2);
  engine.accept({ kind: 'clock', clock: { ...clock(5000), generation: 2 } });
  await vi.advanceTimersByTimeAsync(0);
  expect(client.requestAnalysis.mock.calls.at(-1)![0]).toEqual({ start: 4980, end: 5280 });
  engine.stop(); await vi.advanceTimersByTimeAsync(0); expect(client.endDemand).toHaveBeenCalledTimes(3);
});
it('ends an in-flight demand after admission and uses a new identity after resume', async () => {
  let finish!: (value: 'pending') => void;
  const client = { manifest: vi.fn().mockResolvedValue(undefined), chunk: vi.fn(),
    requestAnalysis: vi.fn().mockImplementationOnce(() => new Promise<'pending'>(resolve => { finish = resolve; })).mockResolvedValue('pending'),
    endDemand: vi.fn().mockResolvedValue(undefined) };
  const { engine } = setup(client);
  const original = client.requestAnalysis.mock.calls[0][1];
  engine.accept({ kind: 'clock', clock: { ...clock(), paused: true, playing: false } });
  await vi.advanceTimersByTimeAsync(0); expect(client.endDemand).not.toHaveBeenCalled();
  finish('pending'); await vi.advanceTimersByTimeAsync(0);
  expect(client.endDemand).toHaveBeenCalledWith(original);
  engine.accept({ kind: 'clock', clock: clock() }); await vi.advanceTimersByTimeAsync(0);
  expect(client.requestAnalysis.mock.calls.at(-1)![1]).not.toBe(original);
});
it('renews the same bounded window until playback nears its edge', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(undefined), chunk: vi.fn(), requestAnalysis: vi.fn().mockResolvedValue('pending') };
  const { engine } = setup(client);
  for (let second = 0; second < 245; second++) {
    engine.accept({ kind: 'clock', clock: clock(10 + second) }); await vi.advanceTimersByTimeAsync(1000);
  }
  expect(client.requestAnalysis.mock.calls.slice(0, 16).every(call => call[0].start === 0 && call[0].end === 300)).toBe(true);
  expect(client.requestAnalysis.mock.calls.at(-1)![0]).toEqual({ start: 240, end: 540 });
});
it('keeps local onsets alive while asynchronous analysis is pending and never fabricates semantic fallback rows', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(undefined), chunk: vi.fn(), requestAnalysis: vi.fn().mockResolvedValue('pending') };
  const { events, engine } = setup(client);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'local' });
  engine.accept({ kind: 'onset', captureId: 'local', sequence: 1, bands: ['kick'], targetPlaybackTime: 10.25, playbackClock: clock() });
  await vi.advanceTimersByTimeAsync(250);
  expect(semantic(events)).toHaveLength(1); expect(client.requestAnalysis).toHaveBeenCalledOnce();
  engine.accept({ kind: 'sync.state', mode: 'clock', reason: 'capture-permission' });
  await vi.advanceTimersByTimeAsync(300);
  expect(engine.stats().path).toBe('degraded');
  expect(semantic(events)).toHaveLength(1);
  expect(events.some(e => e.kind === 'tempo.tick' && e.eventSource === 'degraded')).toBe(true);
});
it('replaces queued local events with cache authority and suppresses double flashes at handoff', async () => {
  let resolveChunk!: (value: TrackChunk) => void;
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn((_: TrackManifest, index: number) => index === 0
    ? new Promise<TrackChunk>(resolve => { resolveChunk = resolve; }) : Promise.resolve(chunk(index))), requestAnalysis: vi.fn().mockResolvedValue('unavailable') };
  const { engine, events } = setup(client);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'local' });
  engine.accept({ kind: 'onset', captureId: 'local', sequence: 1, bands: ['kick'], targetPlaybackTime: 10.5, playbackClock: clock() });
  await vi.advanceTimersByTimeAsync(0); resolveChunk(chunk(0, 10.5)); await vi.advanceTimersByTimeAsync(500);
  expect(semantic(events)).toHaveLength(1); expect(semantic(events)[0].eventSource).toBe('cache');
  expect(beatTelemetry.snapshot().counts.EVENT_REPLACED).toBeGreaterThan(0);
  engine.accept({ kind: 'onset', captureId: 'local', sequence: 2, bands: ['kick'], targetPlaybackTime: 10.5, playbackClock: clock() });
  await vi.advanceTimersByTimeAsync(50); expect(semantic(events)).toHaveLength(1);
});
it('does not reflash already delivered local events when a cache hit arrives just afterward', async () => {
  let resolveChunk!: (value: TrackChunk) => void;
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn((_: TrackManifest, index: number) => index === 0
    ? new Promise<TrackChunk>(resolve => { resolveChunk = resolve; }) : Promise.resolve(chunk(index))), requestAnalysis: vi.fn().mockResolvedValue('unavailable') };
  const { engine, events } = setup(client);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'local' });
  engine.accept({ kind: 'onset', captureId: 'local', sequence: 1, bands: ['kick'], targetPlaybackTime: 10.25, playbackClock: clock() });
  await vi.advanceTimersByTimeAsync(250); resolveChunk(chunk(0, 10.25)); await vi.advanceTimersByTimeAsync(20);
  expect(semantic(events)).toHaveLength(1);
});
it('bounds chunk memory across long media and cancels old requests and targets on small seeks', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn(async (_: TrackManifest, index: number) => chunk(index)), requestAnalysis: vi.fn().mockResolvedValue('unavailable') };
  const { engine, events } = setup(client);
  for (let index = 1; index < 120; index++) {
    engine.accept({ kind: 'clock', clock: { ...clock(index * 30), generation: index } });
    await vi.advanceTimersByTimeAsync(300);
    expect(engine.stats().chunks).toBeLessThanOrEqual(3); expect(engine.stats().requests).toBeLessThanOrEqual(2);
    expect(engine.stats().pending).toBeLessThanOrEqual(2048);
  }
  expect(semantic(events).length).toBeGreaterThan(100);
  const old = semantic(events).length;
  engine.accept({ kind: 'clock', clock: { ...clock(3570.05), generation: 200, paused: true, playing: false } });
  await vi.advanceTimersByTimeAsync(1000); expect(semantic(events)).toHaveLength(old);
  engine.stop(); expect(vi.getTimerCount()).toBe(0);
});
it('recovers a cache miss without freezing during server failure or stale clocks', async () => {
  const client = { manifest: vi.fn().mockRejectedValue(new Error('offline')), chunk: vi.fn(), requestAnalysis: vi.fn().mockResolvedValue('unavailable') };
  const { engine, events, recover } = setup(client);
  await vi.advanceTimersByTimeAsync(2000);
  expect(events.some(e => e.kind === 'tempo.tick')).toBe(true);
  await vi.advanceTimersByTimeAsync(2000); expect(recover).toHaveBeenCalled();
  engine.accept({ kind: 'clock', clock: clock(14) }); await vi.advanceTimersByTimeAsync(100);
  expect(engine.stats().path).toBe('degraded');
  expect(beatTelemetry.snapshot().counts.CACHE_MISS).toBeGreaterThan(0);
});

it('flushes cached targets on buffering, pause, seek and interruption, then rebuilds at the new rate', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn(async (_: TrackManifest, index: number) => chunk(index, index * 30 + 10.5)), requestAnalysis: vi.fn().mockResolvedValue('unavailable') };
  const { engine, events } = setup(client);
  await vi.advanceTimersByTimeAsync(0);
  engine.accept({ kind: 'clock', clock: { ...clock(), buffering: true, playing: false } });
  await vi.advanceTimersByTimeAsync(600); expect(semantic(events)).toHaveLength(0);
  engine.accept({ kind: 'clock', clock: { ...clock(), playbackRate: 2 } });
  await vi.advanceTimersByTimeAsync(250); expect(semantic(events)).toHaveLength(1);
  engine.accept({ kind: 'clock', clock: { ...clock(40), generation: 1, paused: true, playing: false } });
  await vi.advanceTimersByTimeAsync(1000); expect(semantic(events)).toHaveLength(1);
  engine.accept({ kind: 'clock', clock: { ...clock(40), generation: 1 } });
  await vi.advanceTimersByTimeAsync(500); expect(semantic(events)).toHaveLength(2);
  engine.accept({ kind: 'sync.state', mode: 'clock', reason: 'expired' });
  engine.accept({ kind: 'clock', clock: { ...clock(10), generation: 2 } });
  await vi.advanceTimersByTimeAsync(500); expect(semantic(events)).toHaveLength(3);
  expect(engine.stats().path).toBe('cache');
});

it('does not allow seek-aborted fetches or old capture owners to reinsert scheduled work', async () => {
  let finish!: (value: TrackChunk) => void;
  let oldSignal: AbortSignal | undefined;
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn((_m: TrackManifest, index: number, signal?: AbortSignal) => {
    if (index === 0) { oldSignal = signal; return new Promise<TrackChunk>(resolve => { finish = resolve; }); }
    return Promise.resolve(chunk(index));
  }), requestAnalysis: vi.fn().mockResolvedValue('unavailable') };
  const { engine, events } = setup(client);
  await vi.advanceTimersByTimeAsync(0);
  engine.accept({ kind: 'clock', clock: { ...clock(90), generation: 1 } });
  expect(oldSignal?.aborted).toBe(true); finish(chunk(0, 10.25));
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'old' });
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'fresh' });
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'old' });
  engine.accept({ kind: 'onset', bands: ['hat'], sequence: 1, captureId: 'old', targetPlaybackTime: 90.1, playbackClock: clock(90) });
  await vi.advanceTimersByTimeAsync(300);
  expect(semantic(events)).toHaveLength(1); expect(semantic(events)[0].eventSource).toBe('cache');
  expect(engine.stats().chunks).toBeLessThanOrEqual(2);
});

it('keeps explicit silence dark and resumes local notes without reviving disabled future melody', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(undefined), chunk: vi.fn(), requestAnalysis: vi.fn().mockResolvedValue('unavailable') };
  const { engine, events } = setup(client);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'local' });
  engine.accept({ kind: 'melody.state', captureId: 'local', melody: { active: true, level: .8, note: 1 }, targetPlaybackTime: 10.5, playbackClock: clock() });
  engine.accept({ kind: 'melody.state', captureId: 'local', melody: { active: false, level: 0, note: 0 } });
  engine.accept({ kind: 'sync.state', mode: 'clock', reason: 'silent' });
  const before = events.length;
  await vi.advanceTimersByTimeAsync(1000); expect(events).toHaveLength(before);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'fresh' });
  engine.accept({ kind: 'onset', captureId: 'fresh', sequence: 1, bands: ['kick'], targetPlaybackTime: 11.1, playbackClock: clock(11) });
  await vi.advanceTimersByTimeAsync(100);
  expect(events.filter(e => e.kind === 'melody.state' && e.melody.active)).toHaveLength(0);
  expect(events.filter(e => e.kind === 'onset')).toHaveLength(1);
});

it('observes late semantic targets and recovers to fresh events rather than replaying a backlog', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(undefined), chunk: vi.fn(), requestAnalysis: vi.fn().mockResolvedValue('unavailable') };
  const { engine, events, recover } = setup(client);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'local' });
  const trace = beatTelemetry.events('onset', ['kick']);
  engine.accept({ kind: 'onset', captureId: 'local', sequence: 1, bands: ['kick'], targetPlaybackTime: 9, playbackClock: clock(), telemetry: trace });
  await vi.advanceTimersByTimeAsync(0);
  expect(recover).toHaveBeenCalled(); expect(semantic(events)).toHaveLength(0);
  expect(beatTelemetry.snapshot().counts.EVENT_LATE).toBeGreaterThan(0);
  engine.accept({ kind: 'onset', captureId: 'local', sequence: 2, bands: ['kick'], targetPlaybackTime: 10.1, playbackClock: clock() });
  await vi.advanceTimersByTimeAsync(100); expect(semantic(events)).toHaveLength(1);
});

it('cancels queued cached flashes when muted and rebuilds after unmuting', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn(async (_: TrackManifest, index: number) => chunk(index, index * 30 + 10.5)), requestAnalysis: vi.fn().mockResolvedValue('unavailable') };
  const { engine, events } = setup(client);
  await vi.advanceTimersByTimeAsync(0);
  engine.accept({ kind: 'sync.state', mode: 'clock', reason: 'muted' });
  await vi.advanceTimersByTimeAsync(500); expect(semantic(events)).toHaveLength(0);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'unmuted' });
  engine.accept({ kind: 'clock', clock: { ...clock(10), generation: 1 } });
  await vi.advanceTimersByTimeAsync(500); expect(semantic(events)).toHaveLength(1);
});

it('refreshes a mismatched cache revision with bounded backoff while local analysis continues', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn().mockRejectedValue(new InvalidEventTrack('replaced revision')), requestAnalysis: vi.fn().mockResolvedValue('unavailable') };
  const { engine, events } = setup(client);
  engine.accept({ kind: 'sync.state', mode: 'capture', captureId: 'local' });
  await vi.advanceTimersByTimeAsync(0);
  engine.accept({ kind: 'onset', captureId: 'local', sequence: 1, bands: ['kick'], targetPlaybackTime: 10.1, playbackClock: clock() });
  await vi.advanceTimersByTimeAsync(100); expect(semantic(events)).toHaveLength(1);
  expect(engine.stats().manifest).toBe(false); expect(client.manifest).toHaveBeenCalledOnce();
  client.chunk.mockImplementation(async (_: TrackManifest, index: number) => chunk(index, index * 30 + 25.25));
  for (let i = 1; i <= 15; i++) {
    engine.accept({ kind: 'clock', clock: clock(10 + i) }); await vi.advanceTimersByTimeAsync(1000);
  }
  // An explicit clock discontinuity triggers one fresh lookup; sparse views
  // subsequently poll every 15 seconds even while some chunks are ready.
  expect(client.manifest).toHaveBeenCalledTimes(3); expect(engine.stats().path).toBe('cache');
});

it('keeps cached quiet ranges leased across two hours of continuous playback with bounded chunks', async () => {
  const client = { manifest: vi.fn().mockResolvedValue(manifest), chunk: vi.fn(async (_: TrackManifest, index: number) => chunk(index)), requestAnalysis: vi.fn().mockResolvedValue('unavailable') };
  const { engine, events } = setup(client);
  engine.accept({ kind: 'clock', clock: { ...clock(0), generation: 1 } });
  for (let second = 0; second < 7200; second++) {
    engine.accept({ kind: 'clock', clock: { ...clock(second), generation: 1 } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(engine.stats().chunks).toBeLessThanOrEqual(3);
  }
  expect(semantic(events)).toHaveLength(240);
  expect(events.filter(e => e.kind === 'sync.state' && e.eventPath === 'cache').length).toBeGreaterThan(3000);
  expect(client.chunk).toHaveBeenCalledTimes(240);
  expect(engine.stats().pending).toBe(0);
});
