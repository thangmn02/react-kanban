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
beforeEach(() => { vi.resetAllMocks(); beatReceiver.receive = undefined; vi.mocked(sendBeatRequest).mockResolvedValue(undefined); localStorage.clear(); localStorage.setItem('floatingDock.style', 'island'); vi.stubEnv('VITE_MUSIC_EXTENSION_STORE_URL', ''); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.useRealTimers(); });
const task = { id: 'task', title: 'Focus task', boardId: 'board', boardTitle: 'Board' };
const focusProps: FloatingFocusProps = {
  activeTask: task, focusTasks: [task], cycleTotal: 4,
  timerState: { mode: 'focus', activeTaskId: task.id, isRunning: true, remainingSeconds: 90, endsAt: null, startedAt: 1, plannedSeconds: 1500 },
  remainingSeconds: 90, onStart: vi.fn(), onPause: vi.fn(), onReset: vi.fn(),
};
function renderPlayer() {
  const view = render(<I18nProvider><FloatingFocus {...focusProps} /></I18nProvider>);
  fireEvent.click(screen.getByRole('tab', { name: 'Music' }));
  return view;
}

it('offers a guided install without asking for an extension ID', async () => {
  vi.mocked(sendMusicRequest).mockRejectedValue(new MusicBridgeError('not-installed'));
  const view = renderPlayer();
  await screen.findByRole('link', { name: 'Add music controls' });
  expect(screen.queryByRole('heading', { name: session.title })).not.toBeInTheDocument();
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
  await screen.findByText('Could not open the music tab. Open it manually and click Kora Music Companion.');
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

it.each(['soundcloud.com', 'open.spotify.com', 'music.apple.com', 'www.deezer.com', 'listen.tidal.com'])('automatically follows playback from a toolbar-selected YouTube tab to %s and back', async (source) => {
  vi.useFakeTimers();
  const youtube = { ...session, playing: true, selectionToken: 'youtube-click' };
  const other = { ...session, id: 'other', title: 'Other song', source, playing: false, paused: true };
  vi.mocked(sendMusicRequest).mockResolvedValueOnce([youtube, other])
    .mockResolvedValueOnce([{ ...youtube, playing: false, paused: true }, { ...other, playing: true, paused: false }])
    .mockResolvedValue([youtube, other]);
  renderPlayer();
  await act(async () => {});
  expect(screen.getByRole('heading', { name: youtube.title })).toBeInTheDocument();
  const oldSubscription = vi.mocked(sendBeatRequest).mock.calls.find(([action]) => action === 'dock.beat.sync.start')?.[2];
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByRole('heading', { name: other.title })).toBeInTheDocument();
  expect(sendBeatRequest).toHaveBeenCalledWith('dock.beat.sync.stop', youtube.id, oldSubscription);
  expect(sendBeatRequest).toHaveBeenCalledWith('dock.beat.sync.start', other.id, expect.any(String));
  expect(sendMusicRequest).not.toHaveBeenCalledWith('media.focus', expect.anything());
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByRole('heading', { name: youtube.title })).toBeInTheDocument();
});

it('follows a newly playing tab even when the previous tab has not paused yet and stays stable afterward', async () => {
  vi.useFakeTimers();
  const other = { ...session, id: 'soundcloud', title: 'SoundCloud song', source: 'soundcloud.com', playing: false, paused: true };
  vi.mocked(sendMusicRequest).mockResolvedValueOnce([session, other])
    .mockResolvedValue([session, { ...other, playing: true, paused: false }]);
  renderPlayer();
  await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByRole('heading', { name: other.title })).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
  expect(screen.getByRole('heading', { name: other.title })).toBeInTheDocument();
});

it('preserves a manual paused selection across polls until another tab starts playback', async () => {
  vi.useFakeTimers();
  const chosen = { ...session, id: 'chosen', title: 'Chosen paused song', playing: false, paused: true };
  const other = { ...session, id: 'other', title: 'New playing song', source: 'soundcloud.com', playing: false, paused: true };
  vi.mocked(sendMusicRequest).mockResolvedValue([session, chosen, other]);
  renderPlayer();
  await act(async () => {});
  fireEvent.change(screen.getByRole('combobox', { name: 'Choose a music tab' }), { target: { value: chosen.id } });
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByRole('heading', { name: chosen.title })).toBeInTheDocument();
  vi.mocked(sendMusicRequest).mockResolvedValue([session, chosen, { ...other, playing: true, paused: false }]);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByRole('heading', { name: other.title })).toBeInTheDocument();
});

it('keeps the last automatic source when all tabs pause and replaces it when that tab disappears', async () => {
  vi.useFakeTimers();
  const other = { ...session, id: 'other', title: 'Other song', playing: false, paused: true };
  vi.mocked(sendMusicRequest).mockResolvedValueOnce([session, other])
    .mockResolvedValueOnce([{ ...session, playing: false, paused: true }, other]).mockResolvedValue([other]);
  renderPlayer();
  await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByRole('heading', { name: session.title })).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByRole('heading', { name: other.title })).toBeInTheDocument();
});

it('discovers a newly opened playing tab and sends playback controls to it after the handoff', async () => {
  vi.useFakeTimers();
  const other = { ...session, id: 'new-tab', title: 'New tab song', source: 'soundcloud.com' };
  vi.mocked(sendMusicRequest).mockResolvedValueOnce([session]).mockResolvedValue([session, other]);
  renderPlayer();
  await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByRole('heading', { name: other.title })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Pause music' }));
  await act(async () => {});
  expect(sendMusicRequest).toHaveBeenCalledWith('media.pause', other.id);
});

it('releases the toolbar preference when a live clock pauses the source despite older playing discovery', async () => {
  vi.useFakeTimers();
  const youtube = { ...session, playing: true, sampledAt: 100, selectionToken: 'youtube-click' };
  const other = { ...session, id: 'other', title: 'Other playing song', source: 'soundcloud.com', playing: true, sampledAt: 100 };
  vi.mocked(sendMusicRequest).mockResolvedValue([youtube, other]);
  renderPlayer();
  await act(async () => {});
  act(() => beatReceiver.receive?.({ kind: 'clock', clock: { playing: false, paused: true, currentTime: 80, playbackRate: 1, sampledAt: 200 } }));
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByRole('heading', { name: other.title })).toBeInTheDocument();
});

it('does not select an unpaused session explicitly reported as not playing', async () => {
  vi.useFakeTimers();
  const unavailable = { ...session, id: 'unavailable', title: 'Not actually playing', playing: false };
  vi.mocked(sendMusicRequest).mockResolvedValueOnce([session]).mockResolvedValue([session, unavailable]);
  renderPlayer();
  await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByRole('heading', { name: session.title })).toBeInTheDocument();
});

it('keeps the dock empty when connected without a music session', async () => {
  vi.mocked(sendMusicRequest).mockResolvedValue([]);
  renderPlayer();
  await act(async () => {});
  expect(screen.queryByRole('heading', { name: session.title })).not.toBeInTheDocument();
  expect(screen.queryByText(/debug|detection \(dev\)/i)).not.toBeInTheDocument();
});

it('explains how to reconnect when an installed extension becomes unavailable', async () => {
  vi.mocked(sendMusicRequest).mockRejectedValue(new MusicBridgeError('unavailable'));
  renderPlayer();
  await screen.findByText('Refresh your Kora tab to reconnect music controls.');
  expect(screen.queryByRole('heading', { name: session.title })).not.toBeInTheDocument();
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
  expect(screen.queryByRole('heading', { name: session.title })).not.toBeInTheDocument();
  await act(async () => {});
  expect(dot()).toBeNull();
  expect(screen.queryByRole('heading', { name: session.title })).not.toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(dot()).toHaveClass('music-dot', 'playing');
  expect(screen.getByRole('heading', { name: session.title })).toBeInTheDocument();
  expect(view.container.querySelectorAll('.channel-icon')).toHaveLength(4);
  expect(view.container.querySelectorAll('.channel-icon.lit')).toHaveLength(0);
  expect(view.container.querySelectorAll('.beat-square.lit, .beat-square.onset')).toHaveLength(0);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(dot()).toBeNull();
  expect(screen.getByRole('heading', { name: session.title })).toBeInTheDocument();
  expect(view.container.querySelectorAll('.channel-icon')).toHaveLength(4);
  expect(view.container.querySelectorAll('.channel-icon.lit')).toHaveLength(0);
  expect(view.container.querySelectorAll('.beat-square.hit')).toHaveLength(0);
  expect(view.container.querySelectorAll('.beat-square.lit, .beat-square.onset')).toHaveLength(0);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(dot()).toBeNull();
  expect(screen.queryByRole('heading', { name: session.title })).not.toBeInTheDocument();
  expect(view.container.querySelectorAll('.beat-square')).toHaveLength(32);
  expect(view.container.querySelectorAll('.beat-square.onset, .melody-beat-flash')).toHaveLength(0);
  expect(screen.getByText('01:30')).toBeInTheDocument();
});

it('uses the selected track playback state, independently of the focus timer', async () => {
  vi.mocked(sendMusicRequest).mockResolvedValue([session, { ...session, id: 'paused', title: 'Paused track', paused: true }]);
  const view = renderPlayer();
  await screen.findByRole('heading', { name: session.title });
  expect(view.container.querySelector('.music-dot')).toHaveClass('music-dot', 'playing');
  fireEvent.change(screen.getByRole('combobox', { name: 'Choose a music tab' }), { target: { value: 'paused' } });
  expect(view.container.querySelector('.music-dot')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Paused track' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Choose a music tab' }), { target: { value: session.id } });
  view.rerender(<I18nProvider><FloatingFocus {...focusProps} timerState={{ ...focusProps.timerState, isRunning: false }} /></I18nProvider>);
  expect(view.container.querySelector('.music-dot')).toHaveClass('music-dot', 'playing');
});

it('changes glass tabs without remounting the live music, grid or timer', async () => {
  vi.mocked(sendMusicRequest).mockResolvedValue([{ ...session, playing: true }]);
  const view = renderPlayer();
  await screen.findByRole('heading', { name: session.title });
  const shared = ['.dock-ring', '.music-pattern', '.dock-session-row', '.timer-island'].map((selector) => view.container.querySelector(selector));
  expect(view.container.querySelector('.floating-focus.glass')).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Dock style' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Switch dock style' })).toBeNull();
  expect(localStorage.getItem('floatingDock.style')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Beat grid' }));
  expect(screen.getByRole('tabpanel', { name: 'Beat grid' })).not.toHaveAttribute('aria-hidden', 'true');
  fireEvent.click(screen.getByRole('tab', { name: 'Tasks' }));
  expect(screen.getByRole('tabpanel', { name: 'Tasks' })).toBeInTheDocument();
  ['.dock-ring', '.music-pattern', '.dock-session-row', '.timer-island'].forEach((selector, index) => expect(view.container.querySelector(selector)).toBe(shared[index]));
  fireEvent.click(screen.getByRole('tab', { name: 'Music' }));
  expect(screen.getByRole('heading', { name: session.title })).toBeInTheDocument();
  expect(view.container.querySelector('.floating-focus')).toHaveAttribute('data-style', 'tabs');
});

it('shows a real timeline and volume, and routes committed changes to the selected track', async () => {
  vi.mocked(sendMusicRequest).mockResolvedValue([{ ...session, currentTime: 30, duration: 180, volume: .6, canSeek: true, canPrevious: true, canNext: true }]);
  renderPlayer();
  const seek = await screen.findByRole('slider', { name: 'Seek music' });
  expect(screen.getByText('0:30')).toBeInTheDocument();
  expect(screen.getByText('3:00')).toBeInTheDocument();
  fireEvent.change(seek, { target: { value: '90' } });
  expect(sendMusicRequest).not.toHaveBeenCalledWith('media.seek', session.id, 90);
  fireEvent.pointerUp(seek);
  await waitFor(() => expect(sendMusicRequest).toHaveBeenCalledWith('media.seek', session.id, 90));
  const volume = screen.getByRole('slider', { name: 'Music volume' });
  fireEvent.change(volume, { target: { value: '.25' } }); fireEvent.keyUp(volume, { key: 'ArrowLeft' });
  await waitFor(() => expect(sendMusicRequest).toHaveBeenCalledWith('media.volume', session.id, .25));
  fireEvent.click(screen.getByRole('button', { name: 'Next track' }));
  await waitFor(() => expect(sendMusicRequest).toHaveBeenCalledWith('media.next', session.id, undefined));
  fireEvent.click(screen.getByRole('button', { name: 'Previous track' }));
  await waitFor(() => expect(sendMusicRequest).toHaveBeenCalledWith('media.previous', session.id, undefined));
});

it('keeps unsupported controls disabled and shows only a strip outside Music while playing', async () => {
  vi.mocked(sendMusicRequest).mockResolvedValue([session]);
  const view = renderPlayer(); await screen.findByRole('heading', { name: session.title });
  expect(screen.getByRole('slider', { name: 'Seek music' })).toBeDisabled();
  expect(screen.getByRole('slider', { name: 'Music volume' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Previous track' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next track' })).toBeDisabled();
  expect(view.container.querySelector('.dock-now-playing')).toHaveAttribute('hidden');
  fireEvent.click(screen.getByRole('tab', { name: 'Beat grid' }));
  expect(view.container.querySelector('.dock-now-playing')).not.toHaveAttribute('hidden');
  expect(screen.queryByRole('slider', { name: 'Seek music' })).toBeNull();
  expect(view.container.querySelectorAll('.beat-channel')).toHaveLength(4);
  expect(view.container.querySelectorAll('.beat-square')).toHaveLength(32);
  vi.mocked(sendMusicRequest).mockResolvedValue([{ ...session, paused: true }]);
  fireEvent.click(screen.getByRole('button', { name: 'Pause music' }));
  await waitFor(() => expect(view.container.querySelector('.dock-now-playing')).toHaveAttribute('hidden'));
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
