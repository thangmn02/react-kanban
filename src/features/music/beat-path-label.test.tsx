import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { I18nProvider } from '../../i18n';
import { BeatRowLegend, MusicFeedback } from './MusicPlayer';
import type { BrowserMusicController } from './useBrowserMusic';

afterEach(cleanup);
function feedback(beat: Record<string, unknown>) {
  const music = { selected: { id: 's', title: 'Song' }, playing: true, busy: false, error: '', openMusicTab: async () => {},
    beat: { sessionId: 's', mode: 'capture', onsets: {}, ...beat } } as unknown as BrowserMusicController;
  render(<I18nProvider><MusicFeedback music={music} /></I18nProvider>);
  return screen.getByRole('status');
}

it('names only the rows that have fired instead of claiming the whole grid is live', () => {
  expect(feedback({ eventPath: 'local', onsets: { bass: 12 } })).toHaveTextContent('Live beats · Bass only');
  cleanup();
  expect(feedback({ eventPath: 'local', onsets: { kick: 3, bass: 4 } })).toHaveTextContent('Live beats · Kick, Bass');
  cleanup();
  expect(feedback({ eventPath: 'local', onsets: { kick: 1, clap: 1, hat: 1, bass: 1 } })).toHaveTextContent('Live beats · all 4 rows');
  cleanup();
  expect(feedback({ eventPath: 'local', onsets: {} })).toHaveTextContent(/^Live beats$/);
  cleanup();
  expect(feedback({ eventPath: 'cache', onsets: { bass: 2 } })).toHaveTextContent('Beats · saved analysis');
});

it('labels the four Beat grid rows', () => {
  render(<I18nProvider><BeatRowLegend /></I18nProvider>);
  expect(screen.getByLabelText('Beat grid rows')).toHaveTextContent(/Kick.*Snare.*Hat.*Bass/);
});
