import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import SemanticBeatPattern from '../SemanticBeatPattern';
import MelodyListeningGrid from './MelodyListeningGrid';
import { createMelodyFixtureClock, type FixtureSnapshot, type MelodyFixture } from './melody-fixture-clock';
import { beatRowDiagnostics } from '../beat-row-diagnostics';
import { beatTelemetry } from '../../../../extensions/kanban-music/beat-telemetry.js';

const fixture: MelodyFixture = { id: 'fixture', label: 'fixture', audioSha256: 'fixture-sha', version: 'v3',
  notes: [{ start: .2, end: .4, pitch: 64 }, { start: .8, end: .9, pitch: 67 }, { start: 1.2, end: 1.4, pitch: 69 }],
  sections: [{ start: 0, end: 2, source: 'vocals' }] };
let audio: HTMLAudioElement;
let drivers: ReturnType<typeof createMelodyFixtureClock>[];
function setup(changed: (state: FixtureSnapshot) => void = vi.fn()) {
  const driver = createMelodyFixtureClock(audio, changed); drivers.push(driver); driver.setFixture(fixture); return driver;
}
function media(paused: boolean, currentTime = audio.currentTime, type = paused ? 'pause' : 'play') {
  Object.defineProperty(audio, 'paused', { configurable: true, value: paused });
  audio.currentTime = currentTime; audio.dispatchEvent(new Event(type));
}
async function advance(milliseconds: number) {
  // Model one media clock advancing with timers, not a second production clock.
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 10) {
    if (!audio.paused) audio.currentTime += Math.min(10, milliseconds-elapsed)/1000 * audio.playbackRate;
    await vi.advanceTimersByTimeAsync(Math.min(10, milliseconds-elapsed));
  }
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(10000); drivers = [];
  audio = document.createElement('audio');
  Object.defineProperty(audio, 'readyState', { configurable: true, value: 4 });
  media(true, 0); beatTelemetry.enable(); beatTelemetry.clear();
});
afterEach(() => { drivers.forEach(d => d.dispose()); cleanup(); beatTelemetry.enable(false); vi.useRealTimers(); });

it('uses precomputed target timestamps and preserves source/pitch metadata', async () => {
  const driver = setup(); media(false); await advance(250);
  expect(driver.snapshot().played).toBe(1); expect(driver.snapshot().latest).toBe(.2);
  const id = driver.snapshot().beat.telemetry!['onset:melodic'].eventId!;
  expect(driver.detail(id)).toMatchObject({ midiPitch: 64, selectedSource: 'vocals', onset: .2, version: 'v3' });
  expect(driver.snapshot().beat.onsets).toEqual({ melody: 1 });
});

it('retains experimental detector provenance in simultaneous lanes on one media clock',async()=>{
  const baseline=setup(),candidate=setup();
  candidate.setFixture({...fixture,id:'fixture-fusion',version:'private-fusion',
    notes:[{start:.2,end:.4,pitch:64,source:'basic-pitch-piano',detector:'melodia-basic-pitch-fusion',
      experimental:true,verified:false,evidence:'isolated proposal'}]});
  media(false);await advance(250);
  expect(baseline.snapshot().latest).toBe(.2);expect(candidate.snapshot().latest).toBe(.2);
  const a=baseline.snapshot().beat.telemetry!['onset:melodic'],b=candidate.snapshot().beat.telemetry!['onset:melodic'];
  expect(a.eventId).not.toBe(b.eventId);
  expect(candidate.detail(b.eventId!)).toMatchObject({detector:'melodia-basic-pitch-fusion',experimental:true,
    verified:false,selectedSource:'basic-pitch-piano',midiPitch:64,onset:.2});
  candidate.setFixture({...fixture,id:'fixture-bp',version:'bp-only',notes:[]});
  await advance(650);expect(candidate.snapshot().played).toBe(0);expect(baseline.snapshot().latest).toBe(.8);
});

it('flushes pause then resumes without redispatching already passed notes', async () => {
  const driver = setup(); media(false); await advance(300); media(true);
  await advance(1000); expect(driver.snapshot().played).toBe(0);
  media(false); await advance(550); expect(driver.snapshot().played).toBe(1);
  expect(driver.snapshot().latest).toBe(.8);
});

it('flushes forward/backward seek and replay with fresh event identities', async () => {
  const driver = setup(); media(false); await advance(250);
  const first = driver.snapshot().beat.telemetry!['onset:melodic'].id;
  media(false, 1, 'seeking'); media(false, 1, 'seeked'); await advance(250);
  expect(driver.snapshot().played).toBe(1); expect(driver.snapshot().latest).toBe(1.2);
  media(false, 0, 'seeking'); media(false, 0, 'seeked'); await advance(250);
  expect(driver.snapshot().played).toBe(1); expect(driver.snapshot().latest).toBe(.2);
  expect(driver.snapshot().beat.telemetry!['onset:melodic'].id).not.toBe(first);
});

it('switches v3/candidate without releasing queued v3 notes', async () => {
  const driver = setup(); media(false); await advance(100);
  driver.setFixture({ ...fixture, version: 'candidate', notes: [{ start: .5, end: .6, pitch: 72 }] });
  await advance(800);
  expect(driver.snapshot().played).toBe(1); expect(driver.snapshot().latest).toBe(.5);
  expect(beatTelemetry.snapshot().records.filter(r => r.stage === 'EVENT_STATE_COMMITTED')).toHaveLength(1);
});

it('switches to MELODIA while preserving exact note targets and explicit phrase rests', async () => {
  const driver = setup(); media(false); await advance(100);
  driver.setFixture({ ...fixture, version: 'essentia-melodia-defaults-v1',
    notes: [{ start: .5, end: .6, pitch: 70, source: 'original-mixture' }, { start: 1.1, end: 1.3, pitch: 70, source: 'original-mixture' }],
    sections: [{ start: .5, end: .6, source: 'predominant-mixture' }, { start: 1.1, end: 1.3, source: 'predominant-mixture' }] });
  await advance(450);
  expect(driver.snapshot().latest).toBe(.5);
  expect(driver.snapshot().owner).toBe('predominant-mixture');
  expect(driver.snapshot().currentPitch).toBe(70);
  await advance(300);
  expect(driver.snapshot().played).toBe(1); expect(driver.snapshot().owner).toBeNull();
  expect(driver.snapshot().currentPitch).toBeNull();
  await advance(300); expect(driver.snapshot().latest).toBe(1.1);
  const detail = driver.detail(driver.snapshot().beat.telemetry!['onset:melodic'].eventId!);
  expect(detail).toMatchObject({ midiPitch: 70, selectedSource: 'original-mixture', onset: 1.1, offset: 1.3, version: 'essentia-melodia-defaults-v1' });
});

it('keeps bounded stem and mixture analysis onsets on the original media clock', async () => {
  const driver = setup(); media(true, 16);
  driver.setFixture({ ...fixture, version: 'melodia:input-ab:mix',
    notes: [{ start: 16.2, end: 16.5, pitch: 65, source: 'diagnostic-full-mixture', analysisAudioSha256: 'crop-mix-sha' }],
    sections: [{ start: 16, end: 26, source: 'diagnostic-full-mixture' }] });
  media(false, 16); await advance(100);
  driver.setFixture({ ...fixture, version: 'melodia:input-ab:stem',
    notes: [{ start: 16.3, end: 16.6, pitch: 67, source: 'diagnostic-manual-vocals', analysisAudioSha256: 'crop-vocals-sha' }],
    sections: [{ start: 16, end: 26, source: 'diagnostic-manual-vocals' }] });
  await advance(250);
  expect(driver.snapshot().played).toBe(1); expect(driver.snapshot().latest).toBe(16.3);
  const detail = driver.detail(driver.snapshot().beat.telemetry!['onset:melodic'].eventId!);
  expect(detail).toMatchObject({ audioSha256: fixture.audioSha256, analysisAudioSha256: 'crop-vocals-sha',
    selectedSource: 'diagnostic-manual-vocals', onset: 16.3, offset: 16.6 });
  expect(beatTelemetry.snapshot().records.filter(r => r.stage === 'EVENT_STATE_COMMITTED')).toHaveLength(1);
});

it('rebuilds after buffering and rate changes against the sampled media clock', async () => {
  const driver = setup(); media(false); await advance(100);
  Object.defineProperty(audio, 'readyState', { configurable: true, value: 2 }); audio.dispatchEvent(new Event('waiting'));
  await advance(500); expect(driver.snapshot().played).toBe(0);
  Object.defineProperty(audio, 'readyState', { configurable: true, value: 4 });
  audio.playbackRate = 2; audio.dispatchEvent(new Event('playing')); audio.dispatchEvent(new Event('ratechange'));
  await advance(140); expect(driver.snapshot().latest).toBe(.8);
});

it('routes the adapter through the existing forty-cell renderer and row recorder', async () => {
  let state: FixtureSnapshot | undefined;
  const driver = setup(next => { state = next; });
  const view = render(<SemanticBeatPattern session={state!.session} beat={state!.beat} melodyEnabled />);
  beatRowDiagnostics.start(30, 0); media(false);
  view.rerender(<SemanticBeatPattern key={driver.snapshot().generation} session={driver.snapshot().session} beat={driver.snapshot().beat} melodyEnabled />);
  await act(async () => { await advance(250); });
  view.rerender(<SemanticBeatPattern key={driver.snapshot().generation} session={driver.snapshot().session} beat={driver.snapshot().beat} melodyEnabled />);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(view.container.querySelectorAll('.beat-square')).toHaveLength(40);
  expect(view.container.querySelectorAll('[data-beat-trace]')).toHaveLength(1);
  expect(view.container.querySelector('[data-beat-trace]')).toHaveAttribute('data-beat-row', '5');
  const trace = beatRowDiagnostics.snapshot('semantic-only');
  expect(trace.rows.melody).toHaveLength(1); expect(trace.rows.kick).toHaveLength(0);
});

it('rejects invalid/unbounded fixture data and releases owned timers on disposal', () => {
  const driver = setup();
  expect(() => driver.setFixture({ ...fixture, notes: [{ start: -1, end: 1, pitch: 60 }] })).toThrow();
  expect(() => driver.setFixture({ ...fixture, notes: Array(4097).fill(fixture.notes[0]) })).toThrow();
  driver.dispose(); expect(vi.getTimerCount()).toBe(0);
});

it('arms a paused recording after Play establishes its new run, using the same audio element', async () => {
  const play = vi.spyOn(audio, 'play').mockImplementation(() => { media(false); return Promise.resolve(); });
  const view = render(<MelodyListeningGrid audio={audio} />);
  act(() => document.dispatchEvent(new CustomEvent('kora-melody-fixture', { detail: fixture })));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Record 30 seconds' })); });
  expect(play).toHaveBeenCalledOnce();
  expect(screen.getByText(/Recording up to 30 media seconds/)).toBeInTheDocument();
  await act(async () => { await advance(250); });
  expect(screen.getByLabelText('Five-row event counters')).toHaveTextContent('Melody: 1');
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(beatRowDiagnostics.snapshot().rows.melody).toHaveLength(1);
  act(() => media(true));
  expect(screen.getByText(/Recording stopped/)).toBeInTheDocument();
  view.unmount(); expect(vi.getTimerCount()).toBe(0); play.mockRestore();
});
