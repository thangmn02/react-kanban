import { afterEach, expect, it, vi } from 'vitest';
import { beatTelemetry, createBeatTelemetry, parseBeatTraces } from './beat-telemetry.js';

afterEach(() => { beatTelemetry.enable(false); beatTelemetry.clear(); vi.restoreAllMocks(); });

it('is inert by default and bounds memory while keeping lifetime stage counts', () => {
  const now = vi.fn(() => 1000), log = createBeatTelemetry({ now, limit: 3 });
  expect(log.events('onset', ['kick'])).toBeUndefined();
  log.record('CAPTURE_START'); expect(now).not.toHaveBeenCalled();
  log.enable(); const trace = log.events('onset', ['kick'])[0];
  for (const stage of ['EVENT_DETECTED', 'EVENT_QUEUED', 'EVENT_SENT', 'EVENT_RENDERED']) log.at('capture-engine').record(stage, trace);
  expect(log.snapshot()).toMatchObject({ evicted: 1, counts: { EVENT_DETECTED: 1, EVENT_RENDERED: 1 } });
  expect(log.snapshot().records.map((e) => e.stage)).toEqual(['EVENT_QUEUED', 'EVENT_SENT', 'EVENT_RENDERED']);
  expect(log.snapshot().records.at(-1)).toMatchObject({ id: trace.id, component: 'capture-engine', renderedAt: 1000 });
  log.snapshot().records[0].stage = 'modified';
  expect(log.snapshot().records[0].stage).toBe('EVENT_QUEUED');
});

it('keeps tempo, onset and decoration distinct without consuming visual randomness or inventing confidence', () => {
  const random = vi.spyOn(Math, 'random');
  const log = createBeatTelemetry(); log.enable();
  const onset = log.events('onset', ['clap', 'melody']);
  const tempo = log.events('tempo', ['hat'], { confidence: .8, targetTime: 3.5, targetClock: 'audio-seconds' });
  const decoration = log.events('random', ['generic']);
  expect(onset.map((e) => e.type)).toEqual(['snare', 'melodic']);
  expect(onset[0].confidence).toBeNull();
  expect(tempo[0]).toMatchObject({ source: 'tempo', confidence: .8, targetClock: 'audio-seconds' });
  expect(decoration[0].source).toBe('random');
  expect(new Set([...onset, ...tempo, ...decoration].map((e) => e.id)).size).toBe(4);
  expect(random).not.toHaveBeenCalled();
});

it('strips private and unknown fields and rejects malformed sidecars without throwing', () => {
  const log = createBeatTelemetry(); log.enable();
  const [trace] = log.events('onset', ['bass']);
  const safe = parseBeatTraces([{ ...trace, title: 'private song', samples: [.1], url: 'https://private.example' }]);
  expect(safe).toEqual([trace]);
  expect(parseBeatTraces([{ ...trace, confidence: NaN }])).toBeUndefined();
  expect(parseBeatTraces([{ ...trace, id: 'https://private.example' }])).toBeUndefined();
  expect(parseBeatTraces(Array(6).fill(trace))).toBeUndefined();
  expect(parseBeatTraces([{ get id() { throw Error('malformed sidecar'); } }])).toBeUndefined();
  log.record('EVENT_DROPPED', trace, { reason: 'private song', url: 'private', queueDepth: 9, samples: [.1] });
  expect(log.snapshot().records[0]).toMatchObject({ queueDepth: 9 });
  expect(JSON.stringify(log.snapshot())).not.toMatch(/private|samples|url/);
  const broken = createBeatTelemetry({ now: () => { throw Error('clock'); } }); broken.enable();
  expect(() => broken.record('CAPTURE_START')).not.toThrow();
  expect(broken.events('onset', ['kick'])).toBeUndefined();
});
