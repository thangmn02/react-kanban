import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BeatPattern from './BeatPattern';
import SemanticBeatPattern from './SemanticBeatPattern';
import { beatRowDiagnostics, flashAttributes, recordCellFlash, semanticRows } from './beat-row-diagnostics';
import { beatTelemetry } from '../../../extensions/kanban-music/beat-telemetry.js';
import type { MusicBeatState } from './useMusicBeatSync';

const session = { id: 'song', title: '', artist: '', source: '', paused: false, playing: true };
const live: MusicBeatState = { sessionId: 'song', captureId: 'capture', mode: 'capture', onsets: {} };
const trace = (type: string, time: number, eventSource: 'local' | 'cache' = 'cache') => ({
  ...beatTelemetry.events('onset', [type])![0], targetPlaybackTime: time, eventSource, captureId: 'capture',
  origin: eventSource === 'cache' ? 'event-track-cache' as const : 'capture-engine' as const,
});
afterEach(() => { cleanup(); beatRowDiagnostics.semanticOnly(false); beatTelemetry.clear(); beatTelemetry.enable(false); vi.useRealTimers(); });

it('keeps independent drum flashes visible when the next batch contains another row', async () => {
  vi.useFakeTimers(); beatRowDiagnostics.start();
  const view = render(<SemanticBeatPattern session={session} beat={live} melodyEnabled={false} />);
  const kick = trace('kick', 1), hat = trace('hat', 1.05);
  view.rerender(<SemanticBeatPattern session={session} beat={{ ...live, telemetry: { kick } }} melodyEnabled={false} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(5); });
  view.rerender(<SemanticBeatPattern session={session} beat={{ ...live, telemetry: { kick, hat } }} melodyEnabled={false} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(5); });
  expect(view.container.querySelector('[data-channel="kick"] [data-beat-trace]')).toHaveAttribute('data-beat-trace', kick.id);
  expect(view.container.querySelector('[data-channel="hat"] [data-beat-trace]')).toHaveAttribute('data-beat-trace', hat.id);
  expect(beatTelemetry.snapshot().records.filter(r => r.stage === 'EVENT_COMMITTED' && r.id === kick.id)).toHaveLength(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  expect(view.container.querySelector('[data-beat-trace]')).toBeNull();
});

it('does not let an earlier expiry erase a replacement attack or change Bass presentation', async () => {
  vi.useFakeTimers(); beatRowDiagnostics.start();
  const view = render(<SemanticBeatPattern session={session} beat={live} melodyEnabled={false} />);
  const first = trace('snare', 1), bass = trace('bass', 1), next = trace('snare', 1.1);
  view.rerender(<SemanticBeatPattern session={session} beat={{ ...live, telemetry: { first, bass } }} melodyEnabled={false} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  view.rerender(<SemanticBeatPattern session={session} beat={{ ...live, telemetry: { next, bass } }} melodyEnabled={false} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(55); });
  expect(view.container.querySelector('[data-channel="snare"] [data-beat-trace]')).toHaveAttribute('data-beat-trace', next.id);
  expect(view.container.querySelector('[data-channel="bass"] [data-beat-trace]')).toBeNull();
  view.rerender(<SemanticBeatPattern session={{ ...session, paused: true }} beat={live} melodyEnabled={false} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(view.container.querySelector('[data-beat-trace]')).toBeNull();
});

it('isolates four-row baseline hits without a fifth-row placeholder or decoration', async () => {
  vi.useFakeTimers(); beatRowDiagnostics.start();
  const view = render(<SemanticBeatPattern session={session} beat={live} melodyEnabled={false} />);
  const events = semanticRows.map(type => trace(type, 1));
  view.rerender(<SemanticBeatPattern session={session} beat={{ ...live,
    telemetry: Object.fromEntries(events.map(t => [`onset:${t.type}`, t])) }} melodyEnabled={false} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(view.container.querySelectorAll('.beat-square')).toHaveLength(32);
  expect(view.container.querySelectorAll('.onset')).toHaveLength(4);
  expect(view.container.querySelector('[data-channel="melody"] [data-beat-trace]')).toBeNull();
  expect(view.container.querySelector('.flow,.moment,.decorative-tempo-pulse,.shape-beat-flash')).toBeNull();
  const snapshot = beatRowDiagnostics.snapshot();
  expect(snapshot.rows.melody).toHaveLength(0);
  semanticRows.slice(0, 4).forEach((row, index) => expect(snapshot.rows[row][0]).toMatchObject({
    eventId: events[index].id, type: row, row: index + 1, semantic: true, targetPlaybackTime: 1,
  }));
});

it.each(semanticRows)('renders %s in exactly its own row with no filler, flow or shape animations', async type => {
  vi.useFakeTimers(); beatRowDiagnostics.semanticOnly(); beatRowDiagnostics.start();
  const view = render(<BeatPattern melodyEnabled session={session} beat={live} colorMode="flow" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const event = trace(type, 1);
  view.rerender(<BeatPattern melodyEnabled session={session} beat={{ ...live, telemetry: { [`onset:${event.type}`]: event } }} colorMode="flow" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const cells = view.container.querySelectorAll('[data-beat-trace]');
  expect(cells).toHaveLength(1); expect(cells[0]).toHaveAttribute('data-beat-row', String(semanticRows.indexOf(type) + 1));
  expect(view.container.querySelectorAll('.beat-square')).toHaveLength(40);
  expect(view.container.querySelector('.flow,.moment,.shape-beat-flash')).toBeNull();
  expect(beatRowDiagnostics.snapshot().rows[type][0]).toMatchObject({ type, semantic: true, source: 'server-cache', targetPlaybackTime: 1, row: semanticRows.indexOf(type) + 1 });
});

it('keeps coincident identities separate, records each cell and never rebroadcasts tempo or envelope updates', async () => {
  vi.useFakeTimers(); beatRowDiagnostics.semanticOnly(); beatRowDiagnostics.start();
  const view = render(<BeatPattern melodyEnabled session={session} beat={live} />);
  const events = semanticRows.map(type => trace(type, 2));
  const telemetry = Object.fromEntries(events.map(t => [`onset:${t.type}`, t]));
  view.rerender(<BeatPattern melodyEnabled session={session} beat={{ ...live, telemetry }} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(view.container.querySelectorAll('.onset')).toHaveLength(5);
  expect(new Set(beatRowDiagnostics.snapshot().flashes.map(e => e.eventId)).size).toBe(5);
  const before = beatRowDiagnostics.snapshot().flashes.length;
  const tempo = beatTelemetry.events('tempo', ['generic'])![0];
  const random = beatTelemetry.events('random', ['generic'])![0];
  view.rerender(<BeatPattern melodyEnabled session={{ ...session, currentTime: 45 }} beat={{ ...live, telemetry: { ...telemetry, 'tempo:generic': tempo, 'random:generic': random },
    tempo: { locked: true, bpm: 120, confidence: 0 }, tickCount: 10, eventPath: 'degraded', melody: { active: true, level: .7, note: 10 } }} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(beatRowDiagnostics.snapshot().flashes).toHaveLength(before);
  expect(beatRowDiagnostics.snapshot().coincidence[0]).toMatchObject({ counts: [1, 1], matched: [1, 1] });
  view.rerender(<BeatPattern melodyEnabled session={{ ...session, paused: true, playing: false }} beat={live} />);
  expect(view.container.querySelector('[data-beat-trace]')).toBeNull();
  view.rerender(<BeatPattern melodyEnabled session={session} beat={{ ...live, captureId: 'new-owner', telemetry }} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(view.container.querySelector('[data-beat-trace]')).toBeNull();
});

it('does not lose an attack when diagnostic metadata updates before its DOM commit', async () => {
  vi.useFakeTimers(); beatRowDiagnostics.semanticOnly();
  const view = render(<BeatPattern melodyEnabled session={session} beat={live} />);
  const event = trace('hat', 1, 'local');
  view.rerender(<BeatPattern melodyEnabled session={session} beat={{ ...live, telemetry: { 'onset:hat': event } }} />);
  view.rerender(<BeatPattern melodyEnabled session={session} beat={{ ...live, telemetry: { 'onset:hat': { ...event } } }} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(view.container.querySelector('[data-beat-trace]')).toHaveAttribute('data-beat-trace', event.id);
});

it('bounds the recording window, retains decoration as nonsemantic and dedupes cell animations for row coincidence', () => {
  vi.useFakeTimers(); beatTelemetry.enable(); beatRowDiagnostics.start();
  const event = trace('kick', 2);
  const element = document.createElement('span');
  for (const [key, value] of Object.entries(flashAttributes(event, 0, 0))) if (value !== undefined) element.setAttribute(key, String(value));
  recordCellFlash(element, 'commit'); recordCellFlash(element, 'commit'); recordCellFlash(element, 'animation');
  const decoration = beatTelemetry.events('random', ['generic'])![0];
  for (const [key, value] of Object.entries(flashAttributes(decoration, 4, 0))) if (value !== undefined) element.setAttribute(key, String(value));
  recordCellFlash(element, 'commit');
  expect(beatRowDiagnostics.snapshot().timestamps.kick).toEqual([2]);
  expect(beatRowDiagnostics.snapshot().rows.melody).toHaveLength(0);
  expect(beatRowDiagnostics.snapshot().flashes).toHaveLength(3);
  vi.advanceTimersByTime(30000); recordCellFlash(element, 'animation');
  expect(beatRowDiagnostics.snapshot()).toMatchObject({ complete: true, overflow: 0 });
  expect(beatRowDiagnostics.snapshot().flashes).toHaveLength(3);
});
it('records a complete requested media range despite bounded playback startup latency', () => {
  vi.useFakeTimers(); beatTelemetry.enable(); beatRowDiagnostics.start(30, 0);
  const element = document.createElement('span');
  const event = trace('hat', 29.99);
  for (const [key, value] of Object.entries(flashAttributes(event, 2, 0))) if (value !== undefined) element.setAttribute(key, String(value));
  vi.advanceTimersByTime(30700); recordCellFlash(element, 'commit');
  expect(beatRowDiagnostics.snapshot().timestamps.hat).toEqual([29.99]);
  element.dataset.beatTrace = 'out-of-range'; element.dataset.targetPlaybackTime = '30'; recordCellFlash(element, 'commit');
  expect(beatRowDiagnostics.snapshot().flashes).toHaveLength(1);
  beatRowDiagnostics.stop(); expect(beatRowDiagnostics.snapshot().complete).toBe(true);
});
it('suppresses legacy untimed signals instead of presenting them as normalized semantic proof', async () => {
  vi.useFakeTimers(); beatRowDiagnostics.semanticOnly();
  const view = render(<BeatPattern melodyEnabled session={session} beat={live} />);
  const event = { ...beatTelemetry.events('onset', ['kick'])![0], eventSource: 'local' as const };
  view.rerender(<BeatPattern melodyEnabled session={session} beat={{ ...live, telemetry: { 'onset:kick': event } }} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(view.container.querySelector('[data-beat-trace]')).toBeNull();
});

it('keeps all five simultaneous cache attacks typed in normal rendering', async () => {
  vi.useFakeTimers(); beatRowDiagnostics.start();
  const view = render(<BeatPattern melodyEnabled session={session} beat={{ ...live, eventPath: 'cache' }} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const events = semanticRows.map(type => trace(type, 2));
  view.rerender(<BeatPattern melodyEnabled session={session} beat={{ ...live, eventPath: 'cache',
    onsets: { kick: 1, clap: 1, hat: 1, bass: 1, melody: 1 }, melody: { active: true, level: .8, note: 1 },
    telemetry: Object.fromEntries(events.map(t => [`onset:${t.type}`, t])) }} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const snapshot = beatRowDiagnostics.snapshot('normal');
  for (const [index, type] of semanticRows.entries()) {
    expect(snapshot.rows[type]).toHaveLength(1);
    expect(snapshot.rows[type][0]).toMatchObject({ eventId: events[index].id, type, row: index + 1,
      semantic: true, targetPlaybackTime: 2, source: 'server-cache', presentation: 'semantic-hit' });
  }
  expect(snapshot.flashes.some(e => !e.semantic)).toBe(false);
});

it('records tempo decoration globally with no instrument row, detector stage or semantic counters', async () => {
  vi.useFakeTimers(); beatRowDiagnostics.start();
  const degraded = { ...live, eventPath: 'degraded' as const, rates: {},
    tempo: { locked: true, bpm: 120, confidence: 0 }, tickCount: 0 };
  const view = render(<BeatPattern melodyEnabled session={session} beat={degraded} colorMode="flow" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const tempo = { ...beatTelemetry.events('tempo', ['generic'])![0], targetPlaybackTime: 2 };
  const next = { ...degraded, tickCount: 1, telemetry: { 'tempo:generic': tempo } };
  view.rerender(<BeatPattern melodyEnabled session={session} beat={next} colorMode="flow" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(view.container.querySelector('.flow,.onset,.semantic-beat-flash,.melody-beat-flash')).toBeNull();
  const snapshot = beatRowDiagnostics.snapshot('normal');
  expect(snapshot.flashes).toHaveLength(1);
  expect(snapshot.flashes[0]).toMatchObject({ semantic: false, row: null, cell: null, type: 'generic',
    origin: 'tempo-fallback', targetPlaybackTime: 2, parentId: tempo.id, presentation: 'decorative-global' });
  expect(semanticRows.every(type => snapshot.rows[type].length === 0)).toBe(true);
  expect(next.onsets).toEqual({});
  const pulse = view.container.querySelector('.decorative-tempo-pulse');
  view.rerender(<BeatPattern melodyEnabled session={session} beat={{ ...next, telemetry: { ...next.telemetry } }} colorMode="flow" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(view.container.querySelector('.decorative-tempo-pulse')).toBe(pulse);
  expect(beatRowDiagnostics.snapshot('normal').flashes).toHaveLength(1);
  act(() => beatRowDiagnostics.semanticOnly());
  expect(view.container.querySelector('.decorative-tempo-pulse')).toBeNull();
});
