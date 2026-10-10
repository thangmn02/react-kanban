import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MusicGrid } from './MusicPlayer';
import { beatRowDiagnostics } from './beat-row-diagnostics';
import type { BrowserMusicController } from './useBrowserMusic';

const originalLocation = location.href;
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); history.replaceState(null, '', originalLocation); });
const music = {
  source: 'extension-direct', selected: { id: 'song', title: 'Track', playing: true, paused: false,
    syncState: { mode: 'capture' } },
  beat: { sessionId: 'song', mode: 'capture', eventPath: 'local', onsets: { kick: 12, clap: 1, hat: 18, bass: 3 } },
} as BrowserMusicController;

it('keeps retained Lead readiness in private diagnostics without an ordinary fifth-row strip', () => {
  history.replaceState(null, '', '?musicDebug=1');
  vi.stubEnv('DEV', true); vi.stubEnv('VITE_LEAD_PULSE_PROCESSING_ENABLED', 'false');
  const controller = { ...music, beat: { ...music.beat, leadAvailability: 'unavailable' as const } };
  const view = render(<MusicGrid music={controller} />);
  expect(screen.queryByLabelText('Lead availability')).toBeNull();
  expect(screen.getByLabelText('Lead pipeline status')).toHaveTextContent('new audio analysis is disabled');
  expect(screen.getByLabelText('Lead pipeline status')).not.toHaveTextContent('retrying');
  expect(view.container.querySelector('.melody-beat-flash')).toBeNull();
  vi.stubEnv('VITE_LEAD_PULSE_PROCESSING_ENABLED', 'true');
  view.rerender(<MusicGrid music={controller} />);
  expect(screen.getByLabelText('Lead pipeline status')).toHaveTextContent('retrying');
});

it('makes normal live playback traceable without switching to a four-row fixture', () => {
  history.replaceState(null, '', '?musicDebug=1&view=app'); vi.stubEnv('DEV', true);
  const start = vi.spyOn(beatRowDiagnostics, 'start');
  const snapshot = vi.spyOn(beatRowDiagnostics, 'snapshot');
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:private-trace');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const view = render(<MusicGrid music={music} />);
  expect(screen.getByLabelText('Live event counters')).toHaveTextContent('Snare / Clap: 1');
  expect(screen.getByLabelText('Live event counters')).toHaveTextContent('Lead: 0');
  expect(screen.getByLabelText('Lead pipeline status')).toHaveTextContent('checking for analyzed Lead events');
  expect(view.container.querySelectorAll('.beat-square')).toHaveLength(32);
  fireEvent.click(screen.getByRole('button', { name: 'Record 30 seconds' }));
  expect(start).toHaveBeenCalledWith(30);
  fireEvent.click(screen.getByRole('button', { name: 'Export row trace' }));
  expect(snapshot).toHaveBeenCalledWith(undefined);
});

it('does not claim that enabling Lead supplies an analyzed live track', () => {
  history.replaceState(null, '', '?musicDebug=1&musicLead=1'); vi.stubEnv('DEV', true);
  render(<MusicGrid music={music} />);
  expect(screen.getByLabelText('Lead pipeline status')).toHaveTextContent('checking for analyzed Lead events');
  expect(screen.getByLabelText('Live event counters')).toHaveTextContent('Lead: 0');
});

it.each(['pending','unavailable','failed','blocked','empty','ready'] as const)('hides ordinary Lead presentation while retaining internal availability: %s', status => {
  history.replaceState(null,'','?musicLead=1');vi.stubEnv('DEV',true);
  const view=render(<MusicGrid music={{...music,beat:{...music.beat,leadAvailability:status}}} />);
  expect(screen.queryByLabelText('Lead availability')).toBeNull();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.queryByText('Beat debug')).not.toBeInTheDocument();
  expect(view.container.querySelectorAll('.beat-square')).toHaveLength(32);
});
