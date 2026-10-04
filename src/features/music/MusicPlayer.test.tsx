import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import FloatingFocus, { type FloatingFocusProps } from '../../components/focus/FloatingFocus';
import { MusicBridgeError, sendMusicRequest, sendBeatRequest, type BeatEvent } from './mediaBridge';

const beatReceiver = vi.hoisted(() => ({ receive: undefined as undefined | ((event: BeatEvent) => void) }));
vi.mock('./mediaBridge', async (importOriginal) => ({ ...await importOriginal<typeof import('./mediaBridge')>(), sendMusicRequest: vi.fn(), sendBeatRequest: vi.fn(),
  subscribeBeatEvents: (_id: string, _subscription: string, receive: (event: BeatEvent) => void) => {
    beatReceiver.receive = receive;
    return () => { beatReceiver.receive = undefined; };
  },
}));
const session = { id: 'tab:doc:0', title: 'Real track title', artist: 'Artist', source: 'www.youtube.com', paused: false };
beforeEach(() => { vi.resetAllMocks(); beatReceiver.receive = undefined; vi.mocked(sendBeatRequest).mockResolvedValue(undefined); localStorage.clear(); vi.stubEnv('VITE_MUSIC_EXTENSION_STORE_URL', ''); });
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

it('shows visible capture-access guidance, opens the correct music tab, and hides it when capture starts', async () => {
  vi.mocked(sendMusicRequest).mockResolvedValue([{ ...session, playing: true }]);
  const view = renderPlayer();
  await screen.findByRole('heading', { name: session.title });
  await waitFor(() => expect(beatReceiver.receive).toBeTypeOf('function'));
  act(() => beatReceiver.receive?.({ kind: 'sync.state', mode: 'clock', reason: 'capture-permission' }));
  const enable = screen.getByRole('button', { name: 'Open music tab' });
  expect(screen.getByText('Enable live beats')).toBeVisible();
  expect(view.container.querySelectorAll('.beat-square.onset')).toHaveLength(0);
  fireEvent.click(enable);
  expect(sendMusicRequest).toHaveBeenCalledWith('media.focus', session.id);
  await act(async () => {});
  act(() => beatReceiver.receive?.({ kind: 'sync.state', mode: 'capture', captureId: 'live' }));
  expect(screen.queryByRole('button', { name: 'Open music tab' })).not.toBeInTheDocument();
  expect(screen.queryByText(/beat debug|music detection|sync lights to the music/i)).not.toBeInTheDocument();
});

it('does not request capture access for paused music or mislabel transient capture errors', async () => {
  vi.mocked(sendMusicRequest).mockResolvedValue([{ ...session, paused: true, playing: false }]);
  renderPlayer();
  await screen.findByRole('heading', { name: session.title });
  act(() => beatReceiver.receive?.({ kind: 'sync.state', mode: 'clock', reason: 'capture-permission' }));
  expect(screen.queryByRole('button', { name: 'Open music tab' })).not.toBeInTheDocument();
  act(() => beatReceiver.receive?.({ kind: 'sync.state', mode: 'clock', reason: 'capture-busy' }));
  expect(screen.queryByText('Enable live beats')).not.toBeInTheDocument();
});

it('guides users to update an old site-blocking companion without inventing beats or breaking controls', async () => {
  vi.mocked(sendMusicRequest).mockResolvedValue([{ ...session, source: 'music.apple.com', playing: true, syncState: { mode: 'clock', reason: 'drm-protected' } }]);
  const view = renderPlayer();
  await screen.findByRole('heading', { name: session.title });
  act(() => beatReceiver.receive?.({ kind: 'sync.state', mode: 'clock', reason: 'drm-protected' }));
  expect(screen.getByText('Update your music companion to try live beats on this player.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Open music tab' })).not.toBeInTheDocument();
  expect(screen.queryByText('Enable live beats')).not.toBeInTheDocument();
  expect(view.container.querySelectorAll('.beat-square.lit, .beat-square.onset')).toHaveLength(0);
  expect(view.container.querySelectorAll('.channel-icon.lit')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Pause music' }));
  expect(sendMusicRequest).toHaveBeenCalledWith('media.pause', session.id);
  expect(screen.queryByLabelText('Beat sync debug')).not.toBeInTheDocument();
});

it.each(['www.youtube.com', 'music.youtube.com', 'soundcloud.com', 'open.spotify.com', 'music.apple.com', 'www.deezer.com', 'listen.tidal.com'])('lights %s squares only on confirmed onsets and returns them to gray when capture is silent', async (source) => {
  vi.mocked(sendMusicRequest).mockResolvedValue([{ ...session, source, playing: true }]);
  const view = renderPlayer();
  await screen.findByRole('heading', { name: session.title });
  await act(async () => {});
  expect(view.container.querySelectorAll('.beat-square.onset')).toHaveLength(0);
  act(() => beatReceiver.receive?.({ kind: 'sync.state', mode: 'capture', captureId: 'spotify-live' }));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  act(() => beatReceiver.receive?.({ kind: 'onset', captureId: 'spotify-live', sequence: 1, bands: ['kick'] }));
  await waitFor(() => expect(view.container.querySelector('[data-channel="drum"] .beat-square.onset')).not.toBeNull());
  expect(view.container.querySelectorAll('.channel-icon.lit')).toHaveLength(0);
  act(() => beatReceiver.receive?.({ kind: 'sync.state', mode: 'clock', reason: 'silent' }));
  expect(screen.getByText('Live beats unavailable for this track.')).toBeVisible();
  expect(view.container.querySelectorAll('.beat-square.onset')).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Pause music' })).toBeEnabled();
});

it('offers manual recovery if opening the music tab fails', async () => {
  vi.mocked(sendMusicRequest).mockResolvedValue([{ ...session, playing: true }]);
  renderPlayer();
  await screen.findByRole('heading', { name: session.title });
  await act(async () => {});
  act(() => beatReceiver.receive?.({ kind: 'sync.state', mode: 'clock', reason: 'capture-permission' }));
  vi.mocked(sendMusicRequest).mockRejectedValueOnce(new MusicBridgeError('unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Open music tab' }));
  await screen.findByText('Could not open the music tab. Open it manually and click Kanban Music Companion.');
});

it('selects the toolbar-clicked song but preserves manual choices until a new toolbar click', async () => {
  vi.useFakeTimers();
  const clicked = { ...session, id: 'clicked', title: 'Clicked track', playing: true, selectionToken: 'first-click' };
  vi.mocked(sendMusicRequest).mockResolvedValueOnce([session, clicked]).mockResolvedValueOnce([session, clicked])
    .mockResolvedValue([session, { ...clicked, selectionToken: 'next-click' }]);
  renderPlayer();
  await act(async () => {});
  expect(screen.getByRole('heading', { name: 'Clicked track' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Choose a music tab' }), { target: { value: session.id } });
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByRole('heading', { name: session.title })).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByRole('heading', { name: 'Clicked track' })).toBeInTheDocument();
});

it('does not let a stale paused YouTube toolbar selection displace playing SoundCloud on a fresh dock', async () => {
  const paused = { ...session, paused: true, playing: false, selectionToken: 'old-click' };
  const playing = { ...session, id: 'soundcloud', source: 'soundcloud.com', title: 'SoundCloud song', playing: true };
  vi.mocked(sendMusicRequest).mockResolvedValue([paused, playing]);
  renderPlayer();
  await screen.findByRole('heading', { name: playing.title });
  fireEvent.change(screen.getByRole('combobox', { name: 'Choose a music tab' }), { target: { value: paused.id } });
  expect(screen.getByRole('heading', { name: paused.title })).toBeInTheDocument();
});

it('keeps the dock empty when connected without a music session', async () => {
  vi.mocked(sendMusicRequest).mockResolvedValue([]);
  renderPlayer();
  await act(async () => {});
  expect(screen.queryByRole('region', { name: 'Music' })).not.toBeInTheDocument();
  expect(screen.queryByText(/debug|detection \(dev\)/i)).not.toBeInTheDocument();
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

it('cycles glass layouts without remounting shared elements or losing the chosen style', async () => {
  vi.mocked(sendMusicRequest).mockResolvedValue([{ ...session, playing: true }]);
  const view = renderPlayer();
  await screen.findByRole('heading', { name: session.title });
  const shared = ['.dock-ring', '.music-pattern', '.dock-session-row', '.timer-island'].map((selector) => view.container.querySelector(selector));
  expect(view.container.querySelector('.floating-focus.glass')).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Dock style' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Switch dock style' }));
  expect(view.container.querySelector('.dock-mixer')).toBeInTheDocument();
  expect(view.container.querySelector('.music-pattern.vertical')).toBeInTheDocument();
  expect(localStorage.getItem('floatingDock.style')).toBe('mixer');
  fireEvent.click(screen.getByRole('button', { name: 'Switch dock style' }));
  expect(view.container.querySelector('.dock-split')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Switch dock style' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Beat' }));
  expect(screen.getByRole('region', { name: 'Beat' })).not.toHaveAttribute('aria-hidden', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Switch dock style' }));
  expect(view.container.querySelector('.dock-deck')).toHaveAttribute('data-state', 'stacked');
  fireEvent.click(screen.getByRole('button', { name: 'Fan out cards' }));
  expect(view.container.querySelector('.dock-deck')).toHaveAttribute('data-state', 'fanned');
  ['.dock-ring', '.music-pattern', '.dock-session-row', '.timer-island'].forEach((selector, index) => expect(view.container.querySelector(selector)).toBe(shared[index]));
  fireEvent.click(screen.getByRole('button', { name: 'Switch dock style' }));
  expect(view.container.querySelector('.dock-island')).toBeInTheDocument();
});

it('keeps color and palette pickers in an accessible settings popover', async () => {
  vi.mocked(sendMusicRequest).mockResolvedValue([session]);
  renderPlayer();
  await screen.findByRole('heading', { name: session.title });
  expect(screen.queryByRole('combobox', { name: 'Beat colors' })).not.toBeInTheDocument();
  const settings = screen.getByRole('button', { name: 'Dock settings' });
  fireEvent.click(settings);
  expect(settings).toHaveAttribute('aria-expanded', 'true');
  fireEvent.change(screen.getByRole('combobox', { name: 'Beat colors' }), { target: { value: 'flow' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Palette' }), { target: { value: 'ultraviolet' } });
  expect(localStorage.getItem('floatingDock.colors')).toBe('flow');
  expect(localStorage.getItem('floatingDock.palette')).toBe('ultraviolet');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(settings).toHaveAttribute('aria-expanded', 'false');
  expect(settings).toHaveFocus();
});
