import { afterEach, expect, it, vi } from 'vitest';
import { beatTelemetry, createBeatTelemetry, parseBeatTraces } from './beat-telemetry.js';

afterEach(() => { beatTelemetry.enable(false); beatTelemetry.clear(); vi.restoreAllMocks(); });
it('keeps compensation revocation evidence opt-in, numeric and free of PCM or source URLs',()=>{
  const log=createBeatTelemetry();const details={component:'beat-sync',captureId:'capture',configuredAudioDelayMs:170,
    trigger:'clock',clockAgeMs:12,playing:true,paused:false,buffering:true,captureHealthy:true,clockHealthy:false,
    outputOwned:true,singleSource:true,compensationEligible:false,pcm:[1,2],url:'private-source'};
  log.record('COMPENSATION_REVOKED',undefined,details);expect(log.snapshot().records).toHaveLength(0);
  log.enable();log.record('COMPENSATION_REVOKED',undefined,details);
  expect(log.snapshot().records[0]).toMatchObject({stage:'COMPENSATION_REVOKED',configuredAudioDelayMs:170,
    trigger:'clock',clockAgeMs:12,buffering:true,clockHealthy:false,compensationEligible:false});
  expect(log.snapshot().records[0]).not.toHaveProperty('pcm');expect(log.snapshot().records[0]).not.toHaveProperty('url');
});
it('preserves bounded original percussion head and mapping without guessing absent provenance',()=>{
  const log=createBeatTelemetry();log.enable();const trace=log.events('onset',['hat'])[0];
  expect(parseBeatTraces([trace])[0]).not.toHaveProperty('originalClassIndex');
  const original={...trace,originalClassIndex:4,percussionLabelMapping:'M0'};
  expect(parseBeatTraces([original])).toEqual([original]);log.record('EVENT_RECEIVED',original);
  expect(log.snapshot().records[0]).toMatchObject({originalClassIndex:4,percussionLabelMapping:'M0'});
  for(const index of [-1,5,3.5,NaN,'4'])expect(parseBeatTraces([{...trace,originalClassIndex:index,percussionLabelMapping:'shadow'}])[0]).not.toHaveProperty('originalClassIndex');
  expect(parseBeatTraces([{...trace,percussionLabelMapping:'shadow'}])[0]).not.toHaveProperty('percussionLabelMapping');
});
it('keeps detector timing numeric, opt-in and separate from raw model diagnostics', () => {
  const log = createBeatTelemetry();
  log.record('DETECTOR_TIMING', undefined, { inferenceStartedAt: 10 });
  expect(log.snapshot().records).toEqual([]);
  log.enable();
  log.record('DETECTOR_TIMING', undefined, {
    peakFeatureAvailableAudioTime: 1.02, modelInputAudioTime: 1.1,
    inferenceStartedAt: 100, inferenceEndedAt: 120, decisionAt: 170,
    featurePostedAt: NaN, workerReceivedAt: -1, scores: [.9], samples: [.1], url: 'private', title: 'private',
  });
  expect(log.snapshot().records[0]).toMatchObject({ modelInputAudioTime: 1.1, inferenceStartedAt: 100, decisionAt: 170 });
  expect(JSON.stringify(log.snapshot())).not.toMatch(/private|scores|samples|featurePostedAt|workerReceivedAt/);
});
it('records only bounded eligibility facts for a preview revocation',()=>{
 const log=createBeatTelemetry();log.enable();log.record('PREVIEW_REVOKED',undefined,{trigger:'clock',previewReason:'clock-unreliable',generation:2,clockAgeMs:12,playing:true,paused:false,buffering:true,sourceUrl:'https://private.test/song',subscriptionId:'private-subscription',arbitrary:'private'});
 expect(log.snapshot().records[0]).toMatchObject({stage:'PREVIEW_REVOKED',trigger:'clock',previewReason:'clock-unreliable',generation:2,clockAgeMs:12,buffering:true});
 expect(JSON.stringify(log.snapshot())).not.toContain('private');
});
it('preserves allowlisted event provenance and row/cell observations across transport', () => {
  const log = createBeatTelemetry(); log.enable();
  const trace = { ...log.events('onset', ['melody'], { origin: 'capture-engine' })[0], eventId: 'note-5', eventSource: 'local', targetPlaybackTime: 5 };
  expect(parseBeatTraces([trace])).toEqual([trace]);
  log.record('EVENT_RENDERED', trace, { row: 5, cell: 8, semantic: true });
  expect(log.snapshot().records[0]).toMatchObject({ eventId: 'note-5', origin: 'capture-engine', row: 5, cell: 8, semantic: true });
});

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
