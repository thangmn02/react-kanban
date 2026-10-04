import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { I18nProvider } from '../../i18n';
import FocusDock from './FocusDock';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup(overrides: Partial<ComponentProps<typeof FocusDock>> = {}) {
  const props: ComponentProps<typeof FocusDock> = {
    focusTasks: [{ id: 'task', boardId: 'board', boardTitle: 'Project', title: 'Write a first draft' }],
    activeTaskId: 'task', isCollapsed: true,
    timerState: { mode: 'focus', activeTaskId: 'task', isRunning: false, remainingSeconds: 89, endsAt: null, startedAt: null, plannedSeconds: 1500, completedCycleFocus: 1 },
    timerSettings: { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4, autoStartBreaks: false, autoStartFocus: false },
    dailyFocusStats: { focusedMinutes: 0, completedSessions: 0, interruptedSessions: 0, topTaskTitle: null },
    remainingSeconds: 89,
    onCollapseChange: vi.fn(), onActiveTaskChange: vi.fn(), onModeChange: vi.fn(), onTimerSettingsChange: vi.fn(),
    onStartTimer: vi.fn(), onPauseTimer: vi.fn(), onResetTimer: vi.fn(), onPopOutTimer: vi.fn(), onOpenShutdown: vi.fn(),
    onOpenTask: vi.fn(), onMarkDone: vi.fn(), onRemoveTask: vi.fn(), isPictureInPictureSupported: false, isPictureInPictureOpen: false,
    ...overrides,
  };
  const view = render(<I18nProvider><FocusDock {...props} /></I18nProvider>);
  return { props, ...view };
}

it('shows the real task, cycle and shared timer and delegates start', () => {
  const { props } = setup();
  expect(screen.getByText('Write a first draft')).toBeInTheDocument();
  expect(screen.getByText('2/4')).toBeInTheDocument();
  expect(screen.getByText('01:29')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(props.onStartTimer).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Expand Focus Dock' }));
  expect(props.onCollapseChange).toHaveBeenCalledWith(false);
});

it('does not expose music controls on the inline dock', () => {
  const { props } = setup();
  expect(screen.queryByRole('button', { name: 'Music' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Music' })).not.toBeInTheDocument();
  expect(props.onStartTimer).not.toHaveBeenCalled();
});

it('keeps an empty native dock available and opens its shared timer controls', () => {
  const { props } = setup({ focusTasks: [], activeTaskId: null, showWhenEmpty: true });
  fireEvent.click(screen.getByRole('button', { name: 'Timer settings' }));
  expect(props.onCollapseChange).toHaveBeenCalledWith(false);
  expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(props.onStartTimer).toHaveBeenCalledOnce();
  cleanup();
  setup({ focusTasks: [], activeTaskId: null });
  expect(screen.queryByRole('button', { name: 'Timer settings' })).toBeNull();
});

it('starts a standalone session and opens the native widget from the expanded empty dock', () => {
  const { props } = setup({ focusTasks: [], activeTaskId: null, showWhenEmpty: true, isCollapsed: false,
    isPictureInPictureSupported: true });
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  const startButtons = screen.getAllByRole('button', { name: 'Start' });
  expect(startButtons).toHaveLength(2);
  startButtons.forEach(button => {
    expect(button).toBeEnabled();
    fireEvent.click(button);
  });
  expect(props.onStartTimer).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Open floating focus timer' }));
  expect(props.onPopOutTimer).toHaveBeenCalledOnce();
});

it('offers a direct widget button only when the browser supports Document PiP', () => {
  setup();
  expect(screen.getByRole('button', { name: 'Pop out dock' })).toBeDisabled();
  cleanup();
  const { props } = setup({ isPictureInPictureSupported: true });
  fireEvent.click(screen.getByRole('button', { name: 'Pop out dock' }));
  expect(props.onPopOutTimer).toHaveBeenCalledOnce();
});

it('pauses through the existing controller and remembers keyboard movement', () => {
  const { props } = setup();
  fireEvent.keyDown(screen.getByRole('button', { name: /Move island/ }), { key: 'ArrowLeft' });
  expect(localStorage.getItem('focus-island-position-v1')).not.toBeNull();
  cleanup();
  setup({ timerState: { ...props.timerState, isRunning: true }, onPauseTimer: props.onPauseTimer });
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(props.onPauseTimer).toHaveBeenCalledOnce();
});
