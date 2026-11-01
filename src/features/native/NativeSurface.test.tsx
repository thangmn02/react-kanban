import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import type { FloatingFocusProps } from '../../components/focus/FloatingFocus';
import NativeSurface from './NativeSurface';
import nativeConfig from '../../../src-tauri/tauri.conf.json';
import nativeCapability from '../../../src-tauri/capabilities/widget.json';

const nativeWindow = vi.hoisted(() => ({ setSize: vi.fn().mockResolvedValue(undefined), setMinSize: vi.fn().mockResolvedValue(undefined),
  setAlwaysOnTop: vi.fn().mockResolvedValue(undefined),
  setEffects: vi.fn().mockResolvedValue(undefined), clearEffects: vi.fn().mockResolvedValue(undefined),
  minimize: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined), startDragging: vi.fn().mockResolvedValue(undefined),
  isMaximized: vi.fn().mockResolvedValue(false), toggleMaximize: vi.fn().mockResolvedValue(undefined),
  unmaximize: vi.fn().mockResolvedValue(undefined), onResized: vi.fn().mockResolvedValue(() => {}),
  onFocusChanged: vi.fn().mockResolvedValue(() => {}) }));
const nativeInvoke = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@tauri-apps/api/core', () => ({ invoke: nativeInvoke, isTauri: () => true }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => nativeWindow, currentMonitor: async () => null, Effect: { Blur: 'blur' },
  LogicalSize: class { width: number; height: number; constructor(width: number, height: number) { this.width = width; this.height = height; } } }));
const updater = vi.hoisted(() => ({ check: vi.fn().mockResolvedValue(null) }));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: updater.check }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock('../music/useBrowserMusic', () => ({ useBrowserMusic: () => ({ sessions: [], connected: true, checking: false,
  beat: { sessionId: '', mode: 'clock', onsets: {} } }) }));
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); nativeInvoke.mockResolvedValue(undefined); updater.check.mockResolvedValue(null); nativeWindow.isMaximized.mockResolvedValue(false);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const props: FloatingFocusProps = { activeTask: null, focusTasks: [], cycleTotal: 4, remainingSeconds: 1500,
  timerState: { mode: 'focus', activeTaskId: null, isRunning: false, remainingSeconds: 1500, startedAt: null, endsAt: null, plannedSeconds: null },
  onStart: vi.fn(), onPause: vi.fn(), onReset: vi.fn() };
it('allows the hosted Beat cache in both native connection policies', () => {
  for (const policy of [nativeConfig.app.security.csp, nativeConfig.app.security.devCsp]) {
    const connections = policy.split(';').find((directive) => directive.trim().startsWith('connect-src '))!.trim().split(/\s+/);
    expect(connections).toContain('https://koraspace.online');
    expect(connections).toContain('https://kanthangboard.netlify.app');
    expect(connections).not.toContain('*');
  }
});
it('opens Tabs at its ring size once and keeps the timer and user resizing across tab changes', async () => {
  const view = render(<I18nProvider><NativeSurface dock focusProps={props}>Workspace</NativeSurface></I18nProvider>);
  expect(view.queryByRole('checkbox')).toBeNull();
  expect(view.queryByText('System audio beats')).toBeNull();
  const shadow = view.container.querySelector('.native-dock-host')!.shadowRoot!;
  const start = shadow.querySelector('.dock-start')!;
  const ring = shadow.querySelector('.dock-ring')!;
  await waitFor(() => expect(nativeWindow.setSize).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ width: 520, height: 580 })));
  expect(nativeWindow.setMinSize).toHaveBeenCalledWith(expect.objectContaining({ width: 320, height: 360 }));
  fireEvent.click(shadow.querySelectorAll('[role="tab"]')[2]);
  expect(shadow.querySelectorAll('.beat-channel')).toHaveLength(4);
  expect(shadow.querySelectorAll('.beat-square')).toHaveLength(32);
  expect(shadow.querySelector('[aria-label="Lead availability"]')).toBeNull();
  expect(shadow.querySelector('.dock-start')).toBe(start);
  expect(shadow.querySelector('.dock-ring')).toBe(ring);
  expect(nativeWindow.setSize).toHaveBeenCalledOnce();
  fireEvent.pointerDown(shadow.querySelector('.dock-toolbar')!, { button: 0 });
  expect(nativeWindow.startDragging).toHaveBeenCalledOnce();
  fireEvent.click(start); expect(props.onStart).toHaveBeenCalledOnce();
  fireEvent.click(shadow.querySelector('[aria-label="Minimize"]')!); expect(nativeWindow.minimize).toHaveBeenCalledOnce();
  fireEvent.click(shadow.querySelector('[aria-label="Close app"]')!); expect(nativeWindow.close).toHaveBeenCalledOnce();
});
it('returns to the same workspace controller without displaying a second dock', async () => {
  const swap = vi.fn();
  const view = render(<I18nProvider><NativeSurface dock={false} onToggle={swap} focusProps={props}>Workspace</NativeSurface></I18nProvider>);
  expect(view.getByText('Workspace')).toBeVisible();
  expect(view.container.querySelector('.native-dock-host')).toBeNull();
  expect(view.getByText('Kora')).toBeVisible();
  fireEvent.click(view.getByRole('button', { name: 'Dock' })); await waitFor(() => expect(swap).toHaveBeenCalledOnce());
});
it('pins only Dock, unpins Tasks, and starts with a normal native window', async () => {
  expect(nativeConfig.app.windows[0].alwaysOnTop).toBe(false);
  expect(nativeCapability.permissions).toContain('core:window:allow-set-always-on-top');
  const surface = (dock: boolean) => <I18nProvider><NativeSurface dock={dock} focusProps={props}>Workspace</NativeSurface></I18nProvider>;
  const view = render(surface(false));
  await waitFor(() => expect(nativeWindow.setAlwaysOnTop).toHaveBeenLastCalledWith(false));
  expect(nativeWindow.clearEffects).not.toHaveBeenCalled();
  view.rerender(surface(true));
  await waitFor(() => expect(nativeWindow.setAlwaysOnTop).toHaveBeenLastCalledWith(true));
  expect(nativeWindow.clearEffects).not.toHaveBeenCalled();
  expect(nativeWindow.setEffects).not.toHaveBeenCalled();
  await waitFor(() => expect(nativeInvoke).toHaveBeenCalledWith('native_dock_shape', { rounded: true }));
  view.rerender(surface(false));
  await waitFor(() => expect(nativeWindow.setAlwaysOnTop).toHaveBeenLastCalledWith(false));
  expect(nativeWindow.setAlwaysOnTop.mock.calls.map(([enabled]) => enabled)).toEqual([false, true, false]);
  expect(nativeWindow.clearEffects).not.toHaveBeenCalled();
  await waitFor(() => expect(nativeInvoke).toHaveBeenLastCalledWith('native_dock_shape', { rounded: false }));
  expect(nativeCapability.permissions).toContain('core:window:allow-set-effects');
});
it('maximizes and restores the workspace with an accessible window control', async () => {
  const view = render(<I18nProvider><NativeSurface dock={false} focusProps={props}>Workspace</NativeSurface></I18nProvider>);
  await act(async () => {});
  nativeWindow.isMaximized.mockResolvedValue(true);
  fireEvent.click(view.getByRole('button', { name: 'Maximize' }));
  await waitFor(() => expect(view.getByRole('button', { name: 'Restore' })).toBeVisible());
  expect(nativeWindow.toggleMaximize).toHaveBeenCalledOnce();
  nativeWindow.isMaximized.mockResolvedValue(false);
  fireEvent.click(view.getByRole('button', { name: 'Restore' }));
  await waitFor(() => expect(view.getByRole('button', { name: 'Maximize' })).toBeVisible());
  expect(nativeWindow.toggleMaximize).toHaveBeenCalledTimes(2);
});
it('leaves material ownership with the native command and reapplies its shape on resize', async () => {
  render(<I18nProvider><NativeSurface dock focusProps={props}>Workspace</NativeSurface></I18nProvider>);
  await waitFor(() => expect(nativeInvoke).toHaveBeenCalledWith('native_dock_shape', { rounded: true }));
  expect(nativeWindow.clearEffects).not.toHaveBeenCalled();
  nativeInvoke.mockClear();
  act(() => nativeWindow.onResized.mock.calls[0][0]());
  await waitFor(() => expect(nativeInvoke).toHaveBeenCalledWith('native_dock_shape', { rounded: true }));
});
it('matches compositor corners without clearing the native frost on legacy Windows', async () => {
  nativeInvoke.mockResolvedValue(8);
  const view = render(<I18nProvider><NativeSurface dock focusProps={props}>Workspace</NativeSurface></I18nProvider>);
  await waitFor(() => expect(document.documentElement.style.getPropertyValue('--native-dock-radius')).toBe('8px'));
  expect(nativeWindow.clearEffects).not.toHaveBeenCalled();
  nativeInvoke.mockResolvedValue(22);
  act(() => nativeWindow.onResized.mock.calls[0][0]());
  await waitFor(() => expect(document.documentElement.style.getPropertyValue('--native-dock-radius')).toBe('22px'));
  expect(nativeWindow.clearEffects).not.toHaveBeenCalled();
  view.unmount();
  expect(document.documentElement.style.getPropertyValue('--native-dock-radius')).toBe('');
  nativeInvoke.mockResolvedValue(undefined);
});
it('updates Companion from dock settings and shows progress and the confirmed version', async () => {
  let finish!: (value: unknown) => void;
  nativeInvoke.mockImplementation((command) => command === 'native_music_setup'
    ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(22));
  const view = render(<I18nProvider><NativeSurface dock focusProps={props}>Workspace</NativeSurface></I18nProvider>);
  await act(async () => {});
  const shadow = view.container.querySelector('.native-dock-host')!.shadowRoot!;
  fireEvent.click(shadow.querySelector('[aria-haspopup="dialog"]')!);
  const setup = [...shadow.querySelectorAll('button')].find((button) => button.textContent === 'Install or update Companion');
  expect(setup).toBeDefined();
  fireEvent.click(setup!);
  await waitFor(() => expect(nativeInvoke).toHaveBeenCalledWith('native_music_setup'));
  expect(setup).toBeDisabled();
  expect(setup).toHaveTextContent('Updating Companion');
  fireEvent.click(setup!);
  expect(nativeInvoke.mock.calls.filter(([command]) => command === 'native_music_setup')).toHaveLength(1);
  await act(async () => { finish({ version: '0.3.23', status: 'ready', folder: 'C:\\Companion\\extension', browsersReady: 1, folderOpened: false }); });
  await waitFor(() => expect(shadow.querySelector('[role="status"]')).toHaveTextContent(`Companion ${__KORA_VERSION__} is ready`));
  expect(setup).not.toBeDisabled();
});
it('does not let dock auto-sizing undo maximize, and restores before swapping surfaces', async () => {
  const swap = vi.fn();
  nativeWindow.isMaximized.mockResolvedValue(true);
  const view = render(<I18nProvider><NativeSurface dock onToggle={swap} focusProps={props}>Workspace</NativeSurface></I18nProvider>);
  const shadow = view.container.querySelector('.native-dock-host')!.shadowRoot!;
  fireEvent.click(shadow.querySelector('button')!);
  await act(async () => {});
  expect(nativeWindow.setSize).not.toHaveBeenCalled();
  expect(shadow.querySelector('[aria-label="Restore"]')).not.toBeNull();
  view.rerender(<I18nProvider><NativeSurface dock={false} onToggle={swap} focusProps={props}>Workspace</NativeSurface></I18nProvider>);
  fireEvent.click(view.getByRole('button', { name: 'Dock' }));
  await waitFor(() => expect(swap).toHaveBeenCalledOnce());
  expect(nativeWindow.unmaximize).toHaveBeenCalledOnce();
  expect(nativeWindow.unmaximize.mock.invocationCallOrder[0]).toBeLessThan(swap.mock.invocationCallOrder[0]);
});

it('badges the update button and offers one quiet note for a Kora update, then for an older browser Companion', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    const close = vi.fn().mockResolvedValue(undefined);
    updater.check.mockResolvedValue({ version: '0.1.44', close });
    nativeInvoke.mockImplementation(async (command: string, args?: { action?: string }) => command === 'native_music_request' && args?.action === 'companion.status'
      ? { ok: true, companions: [{ peerId: 'peer', version: '0.3.30', verified: true }] } : undefined);
    const view = render(<I18nProvider><NativeSurface dock focusProps={props}>Workspace</NativeSurface></I18nProvider>);
    const shadow = view.container.querySelector('.native-dock-host')!.shadowRoot!;
    // Nothing is checked at launch; the Companion check runs after 5 s and the app check after 15 s.
    expect(updater.check).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(5_100); });
    await waitFor(() => expect(view.getByRole('status')).toHaveTextContent('Music Companion has an update'));
    await act(async () => { vi.advanceTimersByTime(10_000); });
    await waitFor(() => expect(shadow.querySelector('[aria-label="Kora update ready"]')).toHaveClass('dock-update-badge'));
    expect(close).toHaveBeenCalled();
    expect(view.getByRole('status')).toHaveTextContent('A Kora update is ready.');
    // Later hides this version's note; the Companion note is next, and the badge stays.
    fireEvent.click(view.getByRole('button', { name: 'Later' }));
    expect(view.getByRole('status')).toHaveTextContent('Music Companion has an update');
    fireEvent.click(view.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(nativeInvoke).toHaveBeenCalledWith('native_music_setup'));
    expect(view.queryByRole('status')).toBeNull();
    expect(shadow.querySelector('.dock-update-badge')).not.toBeNull();
  } finally { vi.useRealTimers(); }
});

it('pins the dock above other windows again when focus moves away and every minute, and only while docked', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    let focusChanged: ((event: { payload: boolean }) => void) | undefined;
    nativeWindow.onFocusChanged.mockImplementation(async (listener: (event: { payload: boolean }) => void) => { focusChanged = listener; return () => {}; });
    const view = render(<I18nProvider><NativeSurface dock focusProps={props}>Workspace</NativeSurface></I18nProvider>);
    await waitFor(() => expect(focusChanged).toBeTypeOf('function'));
    const pins = () => nativeWindow.setAlwaysOnTop.mock.calls.filter(([enabled]) => enabled === true).length;
    expect(pins()).toBe(1);
    act(() => focusChanged!({ payload: true }));
    expect(pins()).toBe(1);
    act(() => focusChanged!({ payload: false }));
    expect(pins()).toBe(2);
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(pins()).toBe(3);
    view.rerender(<I18nProvider><NativeSurface dock={false} focusProps={props}>Workspace</NativeSurface></I18nProvider>);
    await waitFor(() => expect(nativeWindow.setAlwaysOnTop).toHaveBeenLastCalledWith(false));
    await act(async () => { vi.advanceTimersByTime(120_000); });
    expect(nativeWindow.setAlwaysOnTop).toHaveBeenLastCalledWith(false);
  } finally { vi.useRealTimers(); }
});
