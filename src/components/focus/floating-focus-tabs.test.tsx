import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import FloatingFocus, { type FloatingFocusProps } from './FloatingFocus';
import { I18nProvider } from '../../i18n';
import { DEFAULT_POMODORO_TIMER_SETTINGS } from '../../utils/pomodoroTime';

const music = vi.hoisted(() => ({ current: {
  sessions: [{ id: 'music', title: 'Selected browser track', artist: 'Artist', source: 'youtube.com', paused: false, playing: true }],
  selected: { id: 'music', title: 'Selected browser track', artist: 'Artist', source: 'youtube.com', paused: false, playing: true },
  playing: true, connected: true, checking: false, busy: false, toggle: vi.fn(), setSelectedId: vi.fn(),
  beat: { sessionId: 'music', mode: 'clock', onsets: {} },
} }));
vi.mock('../../features/music/useBrowserMusic', () => ({ useBrowserMusic: () => music.current }));
const task = { id: 'one', title: 'Current task', boardId: 'board', boardTitle: 'Personal Tasks' };
const other = { ...task, id: 'two', title: 'Next task' };
const props: FloatingFocusProps = {
  activeTask: task, focusTasks: [task, other], cycleTotal: 4, remainingSeconds: 1500,
  timerState: { mode: 'focus', activeTaskId: task.id, isRunning: false, remainingSeconds: 1500, startedAt: null, endsAt: null, plannedSeconds: null },
  timerSettings: DEFAULT_POMODORO_TIMER_SETTINGS, onTimerSettingsChange: vi.fn(),
  onStart: vi.fn(), onPause: vi.fn(), onReset: vi.fn(), onActiveTaskChange: vi.fn(), onMarkDoneAndNext: vi.fn(), onReturnToTab: vi.fn(),
};
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => cleanup());
const renderDock = (value = props) => render(<I18nProvider><FloatingFocus {...value} /></I18nProvider>);

it('defaults to glass Tabs with a persistent timer and real focus-task actions', () => {
  const view = renderDock();
  expect(view.container.querySelector('.floating-focus.glass')).toHaveAttribute('data-style', 'tabs');
  expect(screen.getByRole('tab', { name: 'Tasks' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(screen.getByRole('button', { name: /Next task.*Personal Tasks/ }));
  expect(props.onActiveTaskChange).toHaveBeenCalledWith('two');
  fireEvent.click(screen.getByRole('button', { name: 'Mark done: Next task' }));
  expect(props.onMarkDoneAndNext).toHaveBeenCalledWith('two');
  fireEvent.click(screen.getByRole('button', { name: 'Open Kora' }));
  expect(props.onReturnToTab).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(props.onStart).toHaveBeenCalledOnce();
});

it('keeps one timer/grid and music control when changing tabs, including keyboard selection', () => {
  const view = renderDock();
  const timer = view.container.querySelector('.dock-ring');
  const grid = view.container.querySelector('.music-pattern');
  fireEvent.click(screen.getByRole('button', { name: 'Pause music' }));
  expect(music.current.toggle).toHaveBeenCalledOnce();
  const work = screen.getByRole('tab', { name: 'Tasks' });
  fireEvent.keyDown(work, { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Music' })).toHaveFocus();
  expect(screen.getByRole('tabpanel', { name: 'Music' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Pause music' })).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Music' }), { key: 'End' });
  expect(screen.getByRole('tab', { name: 'Beat grid' })).toHaveFocus();
  expect(screen.getByRole('tabpanel', { name: 'Beat grid' })).toBeInTheDocument();
  expect(view.container.querySelectorAll('.dock-ring')).toHaveLength(1);
  expect(view.container.querySelectorAll('.music-pattern')).toHaveLength(1);
  expect(view.container.querySelector('.dock-ring')).toBe(timer);
  expect(view.container.querySelector('.music-pattern')).toBe(grid);
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Beat grid' }), { key: 'Home' });
  expect(work).toHaveFocus();
});

it('preserves saved layouts and completed task state without allowing a second completion', () => {
  localStorage.setItem('floatingDock.style', 'island');
  const view = renderDock({ ...props, focusTasks: [task, { ...other, isDone: true }] });
  expect(view.container.querySelector('.floating-focus')).toHaveAttribute('data-style', 'island');
  for (let index = 0; index < 3; index++) fireEvent.click(screen.getByRole('button', { name: 'Switch dock style' }));
  expect(screen.getByRole('button', { name: 'Mark done: Next task' })).toBeDisabled();
});
