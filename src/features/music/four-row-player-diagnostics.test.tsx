import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MusicGrid } from './MusicPlayer';
import BeatPattern from './BeatPattern';
import { beatRowDiagnostics } from './beat-row-diagnostics';
import type { BrowserMusicController } from './useBrowserMusic';

vi.mock('./beat-row-diagnostics', async importOriginal => ({
  ...await importOriginal<typeof import('./beat-row-diagnostics')>(),
  fourRowBaseline: true, getSemanticMode: () => true,
}));
const locationBefore = location.href;
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); history.replaceState(null, '', locationBefore); });

const music = {
  source: 'extension-direct', selected: { id: 'song', title: '', artist: '', source: '', paused: false,
    playing: true, canAnalyze: true, syncState: { mode: 'clock', reason: 'capture-permission' } },
  beat: { sessionId: 'song', mode: 'capture', onsets: { kick: 3, clap: 4, hat: 5, bass: 2 }, eventPath: 'degraded' },
} as BrowserMusicController;

it('exposes typed counters and the underlying capture failure without presenting tempo as detections', () => {
  history.replaceState(null, '', '?musicDebug=1&musicFourRows=1');
  vi.stubEnv('DEV', true);
  const record = vi.spyOn(beatRowDiagnostics, 'start');
  const view = render(<MusicGrid music={music} />);
  expect(screen.getByLabelText('Four-row event counters')).toHaveTextContent('Kick: 3 · Snare: 4 · Hat: 5 · Bass: 2');
  expect(screen.getByLabelText('Beat sync debug')).toHaveTextContent('capture-permission');
  expect(view.container.querySelectorAll('.beat-square')).toHaveLength(32);
  expect(view.container.querySelector('[data-channel="melody"] [data-beat-trace]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Record 30 seconds' }));
  expect(record).toHaveBeenCalledWith(30);
});

it('keeps temporary diagnostic controls out of the production player', () => {
  history.replaceState(null, '', '?musicDebug=1&musicFourRows=1');
  vi.stubEnv('DEV', false);
  render(<MusicGrid music={music} />);
  expect(screen.queryByLabelText('Four-row event counters')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Record 30 seconds' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Open saved Lead listening demo' })).toBeNull();
});

it('lets an explicit private Lead preview retain five rows from the four-row debug route', () => {
  const view = render(<BeatPattern session={music.selected} beat={music.beat} melodyEnabled semanticOnly />);
  expect(view.container.querySelectorAll('.beat-channel')).toHaveLength(5);
  expect(view.container.querySelectorAll('.beat-square')).toHaveLength(40);
  expect(view.container.querySelector('[data-channel="melody"]')).not.toBeNull();
});
