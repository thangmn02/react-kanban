import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import type { FloatingFocusProps } from '../../components/focus/FloatingFocus';
import NativeSurface from './NativeSurface';
import { enableNativeAudio } from './nativeMusic';

const nativeWindow = vi.hoisted(() => ({ setSize: vi.fn().mockResolvedValue(undefined), setMinSize: vi.fn().mockResolvedValue(undefined),
  minimize: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined), startDragging: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => nativeWindow, currentMonitor: async () => null,
  LogicalSize: class { width: number; height: number; constructor(width: number, height: number) { this.width = width; this.height = height; } } }));
vi.mock('./nativeMusic', () => ({ enableNativeAudio: vi.fn().mockResolvedValue(true) }));
vi.mock('../../components/focus/FloatingFocus', () => ({ default: (props: FloatingFocusProps) => <div>
  <button onClick={() => props.onLayoutChange?.('split', false)}>Split</button><button onClick={props.onStart}>Start native timer</button>{props.nativeControls}
</div> }));
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const props: FloatingFocusProps = { activeTask: null, focusTasks: [], cycleTotal: 4, remainingSeconds: 1500,
  timerState: { mode: 'focus', activeTaskId: null, isRunning: false, remainingSeconds: 1500, startedAt: null, endsAt: null, plannedSeconds: null },
  onStart: vi.fn(), onPause: vi.fn(), onReset: vi.fn() };
it('starts with audio listening off, remembers explicit consent, and keeps the dock tree across layout changes', async () => {
  const view = render(<I18nProvider><NativeSurface dock focusProps={props}>Workspace</NativeSurface></I18nProvider>);
  await waitFor(() => expect(enableNativeAudio).toHaveBeenCalledWith(false));
  const toggle = view.getByRole('checkbox');
  expect(toggle).not.toBeChecked(); fireEvent.click(toggle);
  await waitFor(() => expect(enableNativeAudio).toHaveBeenCalledWith(true));
  expect(localStorage.getItem('native.systemAudio')).toBe('true');
  const shadow = view.container.querySelector('.native-dock-host')!.shadowRoot!;
  const start = shadow.querySelectorAll('button')[1];
  act(() => fireEvent.click(shadow.querySelector('button')!));
  expect(shadow.querySelectorAll('button')[1]).toBe(start);
  expect(nativeWindow.setSize).toHaveBeenCalledWith(expect.objectContaining({ width: 760 }));
  fireEvent.click(start); expect(props.onStart).toHaveBeenCalledOnce();
  fireEvent.click(shadow.querySelector('[aria-label="Minimize"]')!); expect(nativeWindow.minimize).toHaveBeenCalledOnce();
  fireEvent.click(shadow.querySelector('[aria-label="Close app"]')!); expect(nativeWindow.close).toHaveBeenCalledOnce();
});
it('returns to the same workspace controller without displaying a second dock', () => {
  const swap = vi.fn();
  const view = render(<I18nProvider><NativeSurface dock={false} onToggle={swap} focusProps={props}>Workspace</NativeSurface></I18nProvider>);
  expect(view.getByText('Workspace')).toBeVisible();
  expect(view.container.querySelector('.native-dock-host')).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Dock' })); expect(swap).toHaveBeenCalledOnce();
});
