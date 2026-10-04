import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BeatPattern from './BeatPattern';
import { effectNames, isShapeCell, momentDuration, shapeNames } from './beatVisuals';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
const session = { id: 'song', title: 'Song', artist: '', source: '', paused: false, playing: true, currentTime: 0, sampledAt: 1000, playbackRate: 1 };
const clock = { sessionId: 'song', mode: 'clock' as const, onsets: {} };
it('never invents beats from the clock and flashes only a band’s active squares on capture onsets', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1000);
  const view = render(<BeatPattern session={session} beat={clock} />);
  expect(view.container.querySelectorAll('.beat-square.hit, .beat-square.onset')).toHaveLength(0);
  view.rerender(<BeatPattern session={{ ...session, currentTime: 0.6, sampledAt: 1001 }} beat={clock} />);
  expect(view.container.querySelectorAll('.beat-square.hit, .beat-square.onset')).toHaveLength(0);
  const clapIcon = view.container.querySelector('[data-channel="clap"] .channel-icon');
  view.rerender(<BeatPattern session={session} beat={{ ...clock, mode: 'capture' }} />);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  view.rerender(<BeatPattern session={session} beat={{ ...clock, mode: 'capture', onsets: { clap: 1 } }} />);
  await waitFor(() => expect(view.container.querySelectorAll('[data-channel="clap"] .beat-square.onset').length).toBeGreaterThan(0));
  expect(view.container.querySelectorAll('.beat-square.hit')).toHaveLength(0);
  expect(view.container.querySelectorAll('.beat-square.onset:not([data-pattern-active="true"])')).toHaveLength(0);
  expect(view.container.querySelectorAll('.beat-square.lit')).toHaveLength(0);
  expect(view.container.querySelectorAll('[data-channel="drum"] .beat-square.onset')).toHaveLength(0);
  expect(view.container.querySelectorAll('.channel-icon.onset')).toHaveLength(0);
  expect(view.container.querySelector('[data-channel="clap"] .channel-icon')).toBe(clapIcon);
  const firstSquare = view.container.querySelector('[data-channel="clap"] .beat-square.onset');
  view.rerender(<BeatPattern session={session} beat={{ ...clock, mode: 'capture', onsets: { clap: 2 } }} />);
  await waitFor(() => expect(view.container.querySelector('[data-channel="clap"] .beat-square.onset')).not.toBe(firstSquare));
  expect(view.container.querySelector('[data-channel="clap"] .channel-icon')).toBe(clapIcon);
  view.rerender(<BeatPattern session={{ ...session, playing: false, paused: true }} beat={{ ...clock, mode: 'capture', onsets: { clap: 1 } }} />);
  expect(view.container.querySelectorAll('.beat-square.onset, .beat-square.hit')).toHaveLength(0);
  expect(view.container.querySelectorAll('.beat-square')).toHaveLength(40);
});

it('leaves every square unlit without music, while paused, and without real onsets', () => {
  const capture = { ...clock, mode: 'capture' as const, onsets: { kick: 3, clap: 2, hat: 5, bass: 1 } };
  const view = render(<BeatPattern beat={capture} />);
  const expectIdle = () => {
    expect(view.container.querySelectorAll('.beat-square')).toHaveLength(40);
    expect(view.container.querySelectorAll('.beat-square.lit, .beat-square.onset, .beat-square.hit')).toHaveLength(0);
    expect(view.container.querySelectorAll('.channel-icon')).toHaveLength(5);
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
  expect(view.container.querySelectorAll('.channel-icon')).toHaveLength(5);
});

it('uses tempo ticks only after a real capture lock, and returns to raw accents after unlock', async () => {
  const locked = { ...clock, mode: 'capture' as const, captureId: 'live', tempo: { locked: true, bpm: 120, confidence: .8 }, ticks: {} };
  const view = render(<BeatPattern session={session} beat={locked} />);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  view.rerender(<BeatPattern session={session} beat={{ ...locked, onsets: { kick: 1 } }} />);
  expect(view.container.querySelectorAll('.beat-square.onset')).toHaveLength(0);
  view.rerender(<BeatPattern session={session} beat={{ ...locked, onsets: { kick: 1 }, ticks: { kick: 1, hat: 1 } }} />);
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

it('renders five distinct tracks and sustains Melody independently of the tempo grid', async () => {
  const locked = { ...clock, mode: 'capture' as const, captureId: 'five', tempo: { locked: true, bpm: 120, confidence: .8 }, ticks: {} };
  const view = render(<BeatPattern session={session} beat={locked} colorMode="pastel" />);
  expect([...view.container.querySelectorAll('.beat-channel')].map((row) => row.getAttribute('data-track')))
    .toEqual(['Drum (Kick)', 'Clap', 'Hi-hat', 'Bass', 'Melody']);
  expect(view.container.querySelectorAll('.beat-square')).toHaveLength(40);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  const melodic = { ...locked, melody: { active: true, level: .6, note: 1 }, rates: { kick: 1 } };
  view.rerender(<BeatPattern session={session} beat={melodic} colorMode="pastel" />);
  await waitFor(() => expect(view.container.querySelector('[data-channel="melody"] .beat-square.melody-held')).not.toBeNull());
  expect(view.container.querySelectorAll('[data-channel="clap"] .beat-square.onset, [data-channel="bass"] .beat-square.onset, .channel-icon.onset')).toHaveLength(0);
  view.rerender(<BeatPattern session={{ ...session, paused: true, playing: false }} beat={melodic} />);
  expect(view.container.querySelectorAll('.beat-square.onset, .moment-lit, .melody-held')).toHaveLength(0);
});

it('holds a steady breakdown shape for the real phrase, without invented flashes, then clears on silence or capture loss', async () => {
  vi.useFakeTimers();
  const live = { ...clock, mode: 'capture' as const, captureId: 'melodic', melody: { active: true, level: .6, note: 1 } };
  const view = render(<BeatPattern session={session} beat={live} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const square = view.container.querySelector('.melody-held');
  expect(square).not.toBeNull();
  expect(view.container.querySelector('.music-pattern')).toHaveAttribute('data-moment-source', 'melody');
  for (let second = 1; second <= 8; second++) {
    view.rerender(<BeatPattern session={{ ...session, currentTime: second }} beat={{ ...live, melody: { ...live.melody, level: .7 } }} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(view.container.querySelector('.melody-held')).toBe(square);
    expect(view.container.querySelectorAll('.beat-square.onset')).toHaveLength(0);
  }
  view.rerender(<BeatPattern session={session} beat={{ ...live, melody: { ...live.melody, active: false, level: 0 } }} />);
  expect(view.container.querySelectorAll('.melody-held, .moment-lit')).toHaveLength(0);
  view.rerender(<BeatPattern session={session} beat={{ ...live, mode: 'clock' }} />);
  expect(view.container.querySelectorAll('.melody-held, .moment-lit')).toHaveLength(0);
});

it('holds the five-row shape through its full sustain and delayed fade, then releases it', async () => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const live = { ...clock, mode: 'capture' as const, captureId: 'shape' };
  const view = render(<BeatPattern session={session} beat={live} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  view.rerender(<BeatPattern session={{ ...session, currentTime: 36 }} beat={{ ...live, onsets: { kick: 1 } }} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const pattern = view.container.querySelector('.music-pattern');
  expect(pattern).toHaveAttribute('data-moment', 'heart');
  expect(view.container.querySelector('[data-channel="melody"] .moment-lit')).not.toBeNull();
  expect(view.container.querySelector('.moment-lit')).toHaveStyle({ '--moment-duration': '8000ms' });
  const duration = momentDuration('cascade', Date.now());
  await act(async () => { await vi.advanceTimersByTimeAsync(duration - 1); });
  expect(pattern).toHaveClass('moment');
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(pattern).not.toHaveClass('moment');
});

it('reflashes a held shape on confident captured tempo ticks, never on clock ticks or silence', async () => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const live = { ...clock, mode: 'capture' as const, captureId: 'locked-shape', rates: { kick: 1 },
    tempo: { locked: true, bpm: 120, confidence: .8 }, ticks: {} };
  const view = render(<BeatPattern session={session} beat={live} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const playing = { ...session, currentTime: 36 };
  const hit = { ...live, onsets: { kick: 1 } };
  view.rerender(<BeatPattern session={playing} beat={hit} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const mask = [...view.container.querySelectorAll('.moment-lit')];
  const flash = view.container.querySelector('.shape-beat-flash');
  view.rerender(<BeatPattern session={playing} beat={{ ...hit, ticks: { kick: 1, hat: 1 } }} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect([...view.container.querySelectorAll('.moment-lit')]).toEqual(mask);
  expect(view.container.querySelector('.shape-beat-flash')).not.toBe(flash);
  expect(view.container.querySelectorAll('.shape-beat-flash')).toHaveLength(mask.length);
  view.rerender(<BeatPattern session={playing} beat={{ ...hit, ticks: { kick: 2 }, rates: {} }} />);
  expect(view.container.querySelectorAll('.moment-lit, .shape-beat-flash')).toHaveLength(0);
  view.rerender(<BeatPattern session={playing} beat={{ ...hit, ticks: { kick: 3 }, mode: 'clock' }} />);
  expect(view.container.querySelectorAll('.moment-lit, .shape-beat-flash')).toHaveLength(0);
});

it('immediately hides a sustained shape on pause or capture loss and never resurrects it on resume', async () => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const live = { ...clock, mode: 'capture' as const, captureId: 'pause-shape' };
  const view = render(<BeatPattern session={session} beat={live} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const playing = { ...session, currentTime: 36 };
  const hit = { ...live, onsets: { kick: 1 } };
  view.rerender(<BeatPattern session={playing} beat={hit} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(view.container.querySelector('.moment-lit')).not.toBeNull();
  view.rerender(<BeatPattern session={{ ...playing, paused: true, playing: false }} beat={hit} />);
  expect(view.container.querySelectorAll('.moment-lit, .beat-square.onset')).toHaveLength(0);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  view.rerender(<BeatPattern session={playing} beat={hit} />);
  expect(view.container.querySelectorAll('.moment-lit, .beat-square.onset')).toHaveLength(0);
});

it.each(shapeNames.flatMap((shape, shapeIndex) => effectNames.map((effect, effectIndex) => ({ shape, shapeIndex, effect, effectIndex }))))(
  'keeps $shape/$effect intact for eight seconds and reflashes only its mask on captured beats', async ({ shape, shapeIndex, effect, effectIndex }) => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(shapeIndex / 3)
      .mockReturnValueOnce(effectIndex / 3).mockReturnValue(0);
    const live = { ...clock, mode: 'capture' as const, captureId: 'repeat-shape', rates: { kick: 1 } };
    const view = render(<BeatPattern session={session} beat={live} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const playing = { ...session, currentTime: 36 };
    const hit = { ...live, onsets: { kick: 1 } };
    view.rerender(<BeatPattern session={playing} beat={hit} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(view.container.querySelector('.music-pattern')).toHaveAttribute('data-moment', shape);
    expect(view.container.querySelector('.music-pattern')).toHaveAttribute('data-moment-effect', effect);
    const mask = [...view.container.querySelectorAll('.moment-lit')];
    const flashes = [...view.container.querySelectorAll('.shape-beat-flash')];
    expect(flashes).toHaveLength(mask.length);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect([...view.container.querySelectorAll('.moment-lit')]).toEqual(mask);
    // A time-only update cannot replay the flash.
    view.rerender(<BeatPattern session={{ ...playing, currentTime: 41 }} beat={hit} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect([...view.container.querySelectorAll('.shape-beat-flash')]).toEqual(flashes);
    view.rerender(<BeatPattern session={playing} beat={{ ...hit, onsets: { kick: 2, clap: 1 } }} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect([...view.container.querySelectorAll('.moment-lit')]).toEqual(mask);
    expect(view.container.querySelector('.shape-beat-flash')).not.toBe(flashes[0]);
    [...view.container.querySelectorAll('.beat-channel')].forEach((row, rowIndex) => {
      [...row.querySelectorAll('.beat-square')].forEach((cell, step) => {
        expect(Boolean(cell.querySelector('.shape-beat-flash'))).toBe(isShapeCell(shape, rowIndex, step));
      });
    });
    // Explicit silence removes both the held mask and flash immediately.
    view.rerender(<BeatPattern session={playing} beat={{ ...hit, rates: {} }} />);
    expect(view.container.querySelectorAll('.moment-lit, .shape-beat-flash')).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    view.rerender(<BeatPattern session={playing} beat={hit} />);
    expect(view.container.querySelectorAll('.moment-lit, .shape-beat-flash')).toHaveLength(0);
  });
