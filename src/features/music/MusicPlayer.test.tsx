import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import FloatingFocus, { type FloatingFocusProps } from '../../components/focus/FloatingFocus';
import { MusicBridgeError, sendMusicRequest } from './mediaBridge';

vi.mock('./mediaBridge', async (importOriginal) => ({ ...await importOriginal<typeof import('./mediaBridge')>(), sendMusicRequest: vi.fn() }));
const session = { id: 'tab:doc:0', title: 'Real track title', artist: 'Artist', source: 'www.youtube.com', paused: false };
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); vi.stubEnv('VITE_MUSIC_EXTENSION_STORE_URL', ''); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.useRealTimers(); });
const task = { id: 'task', title: 'Focus task', boardId: 'board', boardTitle: 'Board' };
const focusProps: FloatingFocusProps = {
  activeTask: task, focusTasks: [task], cycleTotal: 4,
  timerState: { mode: 'focus', activeTaskId: task.id, isRunning: true, remainingSeconds: 90, endsAt: null, startedAt: 1, plannedSeconds: 1500 },
  remainingSeconds: 90, onStart: vi.fn(), onPause: vi.fn(), onReset: vi.fn(),
};
function renderPlayer() { return render(<I18nProvider><FloatingFocus {...focusProps} /></I18nProvider>); }

it('offers a guided install without asking for an extension ID', async () => {
  vi.mocked(sendMusicRequest).mockRejectedValue(new MusicBridgeError('not-installed'));
  const view = renderPlayer();
  await screen.findByRole('link', { name: 'Add music controls' });
  expect(screen.queryByRole('region', { name: 'Music' })).not.toBeInTheDocument();
  expect(view.container.querySelector('.music-dot')).toBeNull();
  expect(screen.getByRole('link', { name: 'Add music controls' })).toHaveAttribute('href', '/music-companion.html?lang=en');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(sendMusicRequest).toHaveBeenCalledWith('sessions.get');
});

it('renders actual metadata and sends pause to the selected music session', async () => {
  vi.mocked(sendMusicRequest).mockResolvedValueOnce([session]).mockResolvedValue([{ ...session, paused: true }]);
  renderPlayer();
  await screen.findByRole('heading', { name: 'Real track title' });
  fireEvent.click(screen.getByRole('button', { name: 'Pause music' }));
  await screen.findByRole('button', { name: 'Play music' });
  expect(sendMusicRequest).toHaveBeenCalledWith('media.pause', session.id);
});

it('explains how to reconnect when an installed extension becomes unavailable', async () => {
  vi.mocked(sendMusicRequest).mockRejectedValue(new MusicBridgeError('unavailable'));
  renderPlayer();
  await screen.findByText('Refresh your Kanban tab to reconnect music controls.');
  expect(screen.queryByRole('region', { name: 'Music' })).not.toBeInTheDocument();
});

it('detects the companion when the user checks again after installation', async () => {
  vi.mocked(sendMusicRequest).mockRejectedValueOnce(new MusicBridgeError('not-installed')).mockResolvedValue([session]);
  renderPlayer();
  await screen.findByRole('link', { name: 'Add music controls' });
  fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
  await screen.findByRole('heading', { name: 'Real track title' });
  expect(screen.queryByRole('link', { name: 'Add music controls' })).not.toBeInTheDocument();
});

it('provides a useful instruction if the music site blocks playback', async () => {
  vi.mocked(sendMusicRequest).mockResolvedValueOnce([{ ...session, paused: true }]).mockRejectedValue(new MusicBridgeError('playback'));
  renderPlayer();
  await screen.findByRole('heading', { name: 'Real track title' });
  fireEvent.click(screen.getByRole('button', { name: 'Play music' }));
  await screen.findByText('Press play in the music tab once, then try again.');
});

it('shows the heartbeat dot only while playing, keeps the paused panel, and hides both when the last session leaves', async () => {
  vi.useFakeTimers();
  vi.mocked(sendMusicRequest).mockResolvedValueOnce([]).mockResolvedValueOnce([session])
    .mockResolvedValueOnce([{ ...session, paused: true }]).mockResolvedValue([]);
  const view = renderPlayer();
  const dot = () => view.container.querySelector('.music-dot');
  expect(dot()).toBeNull();
  expect(screen.queryByRole('region', { name: 'Music' })).not.toBeInTheDocument();
  await act(async () => {});
  expect(dot()).toBeNull();
  expect(screen.queryByRole('region', { name: 'Music' })).not.toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(dot()).toHaveClass('music-dot', 'playing');
  expect(screen.getByRole('region', { name: 'Music' })).toBeInTheDocument();
  expect(view.container.querySelectorAll('.channel-icon')).toHaveLength(4);
  expect(view.container.querySelectorAll('.channel-icon.lit')).toHaveLength(0);
  expect(view.container.querySelectorAll('.beat-square.lit, .beat-square.onset')).toHaveLength(0);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(dot()).toBeNull();
  expect(screen.getByRole('region', { name: 'Music' })).toBeInTheDocument();
  expect(view.container.querySelectorAll('.channel-icon')).toHaveLength(4);
  expect(view.container.querySelectorAll('.channel-icon.lit')).toHaveLength(0);
  expect(view.container.querySelectorAll('.beat-square.hit')).toHaveLength(0);
  expect(view.container.querySelectorAll('.beat-square.lit, .beat-square.onset')).toHaveLength(0);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(dot()).toBeNull();
  expect(screen.queryByRole('region', { name: 'Music' })).not.toBeInTheDocument();
  expect(view.container.querySelectorAll('.beat-square')).toHaveLength(0);
  expect(screen.getByText('01:30')).toBeInTheDocument();
});

it('uses the selected track playback state, independently of the focus timer', async () => {
  vi.mocked(sendMusicRequest).mockResolvedValue([session, { ...session, id: 'paused', title: 'Paused track', paused: true }]);
  const view = renderPlayer();
  await screen.findByRole('heading', { name: session.title });
  expect(view.container.querySelector('.music-dot')).toHaveClass('music-dot', 'playing');
  fireEvent.change(screen.getByRole('combobox', { name: 'Choose a music tab' }), { target: { value: 'paused' } });
  expect(view.container.querySelector('.music-dot')).toBeNull();
  expect(screen.getByRole('region', { name: 'Music' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Choose a music tab' }), { target: { value: session.id } });
  view.rerender(<I18nProvider><FloatingFocus {...focusProps} timerState={{ ...focusProps.timerState, isRunning: false }} /></I18nProvider>);
  expect(view.container.querySelector('.music-dot')).toHaveClass('music-dot', 'playing');
});
