import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BeatPattern from './BeatPattern';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const session = { id: 'instrument', title: 'Instrument test', artist: '', source: '', paused: false, playing: true, currentTime: 0, sampledAt: 1000, playbackRate: 1 };
const live = { sessionId: session.id, mode: 'capture' as const, captureId: 'capture', onsets: {}, rates: { kick: 1 } };
const settle = async (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

it('keeps the instrumental row dark on real or estimated hi-hats', async () => {
  vi.useFakeTimers();
  const view = render(<BeatPattern session={session} beat={live} />);
  await settle();
  view.rerender(<BeatPattern session={session} beat={{ ...live, onsets: { hat: 1 }, tempo: { locked: true, bpm: 120, confidence: .9 }, ticks: { hat: 1 } }} />);
  await settle();
  expect(view.container.querySelectorAll('[data-channel="melody"] .melody-beat-flash, [data-channel="melody"] .active')).toHaveLength(0);
});

it('flashes its own detected note once and stays dark during sustain', async () => {
  vi.useFakeTimers();
  const view = render(<BeatPattern session={session} beat={live} />);
  await settle();
  const note = { ...live, melody: { active: true, level: .7, note: 1 } };
  view.rerender(<BeatPattern session={session} beat={note} />);
  await settle();
  expect(view.container.querySelectorAll('[data-channel="melody"] .melody-beat-flash').length).toBeGreaterThan(0);
  expect(view.container.querySelectorAll('[data-channel]:not([data-channel="melody"]) .melody-beat-flash, .moment-lit')).toHaveLength(0);
  await settle(150);
  view.rerender(<BeatPattern session={session} beat={{ ...note, melody: { ...note.melody, level: .8 } }} />);
  await settle();
  expect(view.container.querySelectorAll('[data-channel="melody"] .active, .melody-held, .melody-beat-flash')).toHaveLength(0);
});

it('never lights the instrumental row from a decorative percussion shape', async () => {
  vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0);
  const view = render(<BeatPattern session={session} beat={live} />);
  await settle();
  view.rerender(<BeatPattern session={{ ...session, currentTime: 36 }} beat={{ ...live, onsets: { kick: 1 } }} />);
  await settle();
  expect(view.container.querySelector('.moment-lit')).not.toBeNull();
  expect(view.container.querySelectorAll('[data-channel="melody"] .moment-lit, [data-channel="melody"] .shape-beat-flash')).toHaveLength(0);
});
