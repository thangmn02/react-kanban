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
    timerSettings: { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4, autoStartBreaks: false, autoStartFocus: false, countUp: false },
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

it('keeps an explicitly enabled empty native dock available and hides the empty browser dock', () => {
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
  // The open panel replaces the pill, so there is one timer on screen.
  expect(startButtons).toHaveLength(1);
  expect(screen.queryByRole('button', { name: /Move island/ })).toBeNull();
  startButtons.forEach(button => {
    expect(button).toBeEnabled();
    fireEvent.click(button);
  });
  expect(props.onStartTimer).toHaveBeenCalledTimes(1);
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
  fireEvent.keyDown(screen.getByRole('button', { name: /Move island/ }), { key: 'ArrowRight' });
  expect(JSON.parse(localStorage.getItem('focus-island-position-v2')!)).toEqual({ corner: 'bottom-right' });
  cleanup();
  setup({ timerState: { ...props.timerState, isRunning: true }, onPauseTimer: props.onPauseTimer });
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(props.onPauseTimer).toHaveBeenCalledOnce();
});

it('shows where to pick a task up on its card, and nothing when there is no next step', () => {
  const first = setup({ isCollapsed: false, nextSteps: { task: { text: 'Add the budget table' } } });
  expect(screen.getByText('Next: Add the budget table')).toBeInTheDocument();
  first.unmount();
  setup({ isCollapsed: false, nextSteps: {} });
  expect(screen.queryByText(/^Next:/)).toBeNull();
});

it('never names a finished task as the current one, and counts only unfinished work', () => {
  const focusTasks = [{ id: 'done', boardId: 'board', boardTitle: 'Project', title: 'Finished', isDone: true }, { id: 'next', boardId: 'board', boardTitle: 'Project', title: 'Still open' }];
  const first = setup({ focusTasks, activeTaskId: 'done' });
  expect(screen.queryByText('Finished')).toBeNull();
  first.unmount();
  setup({ focusTasks, activeTaskId: 'done', isCollapsed: false });
  expect(screen.getByText('1 active task')).toBeInTheDocument();
});

const resize = (width: number, height: number) => {
  Object.assign(window, { innerWidth: width, innerHeight: height });
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: width });
  fireEvent(window, new Event('resize'));
};

it('keeps its corner when the window shrinks and grows, and never saves from a resize', () => {
  resize(1280, 800);
  localStorage.setItem('focus-island-position-v2', JSON.stringify({ corner: 'bottom-right' }));
  const { container } = setup();
  const island = container.querySelector<HTMLElement>('.focus-island')!;
  const place = () => [island.style.left, island.style.right, island.style.top, island.style.bottom];
  expect(place()).toEqual(['auto', '16px', 'auto', '16px']);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  resize(520, 580); resize(1920, 1080);
  expect(place()).toEqual(['auto', '16px', 'auto', '16px']);
  expect(write).not.toHaveBeenCalled();
  write.mockRestore();
});

it('reads an old pixel position once, as its nearest corner, and only in a window as large as the one it came from', () => {
  localStorage.setItem('focus-island-position-v1', JSON.stringify({ x: 900, y: 100 }));
  resize(520, 580);
  setup();
  expect(localStorage.getItem('focus-island-position-v1')).not.toBeNull();
  expect(localStorage.getItem('focus-island-position-v2')).toBeNull();
  resize(1280, 800);
  expect(JSON.parse(localStorage.getItem('focus-island-position-v2')!)).toEqual({ corner: 'top-right' });
  expect(localStorage.getItem('focus-island-position-v1')).toBeNull();
  cleanup(); localStorage.clear();
  localStorage.setItem('focus-island-position-v1', '"broken"');
  const { container } = setup();
  expect(localStorage.getItem('focus-island-position-v1')).toBeNull();
  expect(container.querySelector('.focus-island')).toHaveAttribute('data-corner', 'bottom-left');
});

it('measures nothing while the window is the native Dock', () => {
  document.documentElement.dataset.nativeSurface = 'dock';
  try {
    localStorage.setItem('focus-island-position-v1', JSON.stringify({ x: 900, y: 100 }));
    resize(1280, 800);
    const { container } = setup();
    expect(container.querySelector('.focus-island')).not.toHaveAttribute('data-corner');
    expect(localStorage.getItem('focus-island-position-v2')).toBeNull();
  } finally { delete document.documentElement.dataset.nativeSurface; }
});
