import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BeatPattern from './BeatPattern';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const session = { id: 'song', title: 'Song', artist: '', source: '', paused: false, playing: true, currentTime: 0, sampledAt: 1000, playbackRate: 1 };
const clock = { sessionId: 'song', mode: 'clock' as const, onsets: {} };
it('never invents beats from the clock and flashes only a band’s active squares on capture onsets', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1000);
  const view = render(<BeatPattern session={session} beat={clock} />);
  expect(view.container.querySelectorAll('.beat-square.hit, .beat-square.onset')).toHaveLength(0);
  view.rerender(<BeatPattern session={{ ...session, currentTime: 0.6, sampledAt: 1001 }} beat={clock} />);
  expect(view.container.querySelectorAll('.beat-square.hit, .beat-square.onset')).toHaveLength(0);
  const snareIcon = view.container.querySelector('[data-channel="snare"] .channel-icon');
  view.rerender(<BeatPattern session={session} beat={{ ...clock, mode: 'capture' }} />);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  view.rerender(<BeatPattern session={session} beat={{ ...clock, mode: 'capture', onsets: { snare: 1 } }} />);
  await waitFor(() => expect(view.container.querySelectorAll('[data-channel="snare"] .beat-square.onset').length).toBeGreaterThan(0));
  expect(view.container.querySelectorAll('.beat-square.hit')).toHaveLength(0);
  expect(view.container.querySelectorAll('.beat-square.onset:not([data-pattern-active="true"])')).toHaveLength(0);
  expect(view.container.querySelectorAll('.beat-square.lit')).toHaveLength(0);
  expect(view.container.querySelectorAll('[data-channel="drum"] .beat-square.onset')).toHaveLength(0);
  expect(view.container.querySelectorAll('.channel-icon.onset')).toHaveLength(0);
  expect(view.container.querySelector('[data-channel="snare"] .channel-icon')).toBe(snareIcon);
  const firstSquare = view.container.querySelector('[data-channel="snare"] .beat-square.onset');
  view.rerender(<BeatPattern session={session} beat={{ ...clock, mode: 'capture', onsets: { snare: 2 } }} />);
  await waitFor(() => expect(view.container.querySelector('[data-channel="snare"] .beat-square.onset')).not.toBe(firstSquare));
  expect(view.container.querySelector('[data-channel="snare"] .channel-icon')).toBe(snareIcon);
  view.rerender(<BeatPattern session={{ ...session, playing: false, paused: true }} beat={{ ...clock, mode: 'capture', onsets: { snare: 1 } }} />);
  expect(view.container.querySelectorAll('.beat-square.onset, .beat-square.hit')).toHaveLength(0);
  expect(view.container.querySelectorAll('.beat-square')).toHaveLength(32);
});

it('leaves every square unlit without music, while paused, and without real onsets', () => {
  const capture = { ...clock, mode: 'capture' as const, onsets: { kick: 3, snare: 2, hat: 5, bass: 1 } };
  const view = render(<BeatPattern beat={capture} />);
  const expectIdle = () => {
    expect(view.container.querySelectorAll('.beat-square')).toHaveLength(32);
    expect(view.container.querySelectorAll('.beat-square.lit, .beat-square.onset, .beat-square.hit')).toHaveLength(0);
    expect(view.container.querySelectorAll('.channel-icon')).toHaveLength(4);
  };
  expectIdle();
  view.rerender(<BeatPattern session={{ ...session, playing: false, paused: true }} beat={capture} />);
  expectIdle();
  view.rerender(<BeatPattern session={session} beat={{ ...capture, sessionId: 'another-song' }} />);
  expectIdle();
  view.rerender(<BeatPattern session={session} beat={{ ...capture, onsets: {} }} />);
  expectIdle();
  view.rerender(<BeatPattern session={session} beat={{ ...capture, mode: 'clock' }} />);
  expectIdle();
});

it('flashes each row independently, including simultaneous hits, and stops on capture loss', async () => {
  const view = render(<BeatPattern session={session} beat={{ ...clock, mode: 'capture' }} />);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  view.rerender(<BeatPattern session={session} beat={{ ...clock, mode: 'capture', onsets: { kick: 1, hat: 1 } }} />);
  await waitFor(() => expect(view.container.querySelectorAll('[data-channel="drum"] .beat-square.onset').length).toBeGreaterThan(0));
  expect(view.container.querySelectorAll('[data-channel="hat"] .beat-square.onset').length).toBeGreaterThan(0);
  expect(view.container.querySelectorAll('[data-channel="bass"] .beat-square.onset')).toHaveLength(0);
  const drumSquare = view.container.querySelector('[data-channel="drum"] .beat-square.onset');
  view.rerender(<BeatPattern session={session} beat={{ ...clock, mode: 'capture', onsets: { kick: 1, hat: 2, bass: 1 } }} />);
  await waitFor(() => expect(view.container.querySelectorAll('[data-channel="bass"] .beat-square.onset').length).toBeGreaterThan(0));
  expect(view.container.querySelector('[data-channel="drum"] .beat-square.onset')).not.toBe(drumSquare);
  view.rerender(<BeatPattern session={session} beat={clock} />);
  expect(view.container.querySelectorAll('.beat-square.onset')).toHaveLength(0);
  expect(view.container.querySelectorAll('.channel-icon')).toHaveLength(4);
});

it('uses tempo ticks only after a real capture lock, and returns to raw accents after unlock', async () => {
  const locked = { ...clock, mode: 'capture' as const, captureId: 'live', tempo: { locked: true, bpm: 120, confidence: .8 }, ticks: {} };
  const view = render(<BeatPattern session={session} beat={locked} />);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  view.rerender(<BeatPattern session={session} beat={{ ...locked, onsets: { bass: 1 } }} />);
  expect(view.container.querySelectorAll('.beat-square.onset')).toHaveLength(0);
  view.rerender(<BeatPattern session={session} beat={{ ...locked, onsets: { bass: 1 }, ticks: { kick: 1, hat: 1 } }} />);
  await waitFor(() => expect(view.container.querySelectorAll('[data-channel="drum"] .beat-square.onset').length).toBeGreaterThan(0));
  expect(view.container.querySelectorAll('[data-channel="hat"] .beat-square.onset').length).toBeGreaterThan(0);
  expect(view.container.querySelectorAll('[data-channel="bass"] .beat-square.onset')).toHaveLength(0);
  const accent = { ...locked, tempo: { locked: false, bpm: null, confidence: .1 }, onsets: { bass: 1 }, ticks: {} };
  view.rerender(<BeatPattern session={session} beat={accent} />);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  view.rerender(<BeatPattern session={session} beat={{ ...accent, onsets: { bass: 2 } }} />);
  await waitFor(() => expect(view.container.querySelectorAll('[data-channel="bass"] .beat-square.onset').length).toBeGreaterThan(0));
  view.rerender(<BeatPattern session={session} beat={{ ...accent, mode: 'clock' }} />);
  expect(view.container.querySelectorAll('.beat-square.onset')).toHaveLength(0);
});
