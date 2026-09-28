import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HomeDashboard from './HomeDashboard';
import { I18nProvider } from '../../i18n';
import { fetchHomeDashboardData, type HomeDashboardData } from '../../services/home.service';
import type { AppUser, WorkspaceSummary } from '../../types/auth.type';
import type { HomeFocusControls } from '../home/HomeFocusView';

vi.mock('../../services/home.service', () => ({ fetchHomeDashboardData: vi.fn() }));
const user: AppUser = { id: 'user', name: 'Alex', email: null, avatarUrl: '', isMock: true };
const workspace = (id: string): WorkspaceSummary => ({ id, name: id, role: 'owner', ownerId: user.id });
const data = (title: string): HomeDashboardData => ({ myTasks: [{ id: title, title, boardId: 'board', boardTitle: 'Project', dueDate: null, priority: null }], recentBoards: [], holidays: [] });
const props = { currentUser: user, activeWorkspace: workspace('a'), onOpenTask: vi.fn(), onOpenBoard: vi.fn(), onToggleFocusTask: vi.fn(), onStartFocusTask: vi.fn(), onPlanFocusTasks: vi.fn(), isFocusTask: () => false, onOpenQuickPlan: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); });
afterEach(cleanup);

it('discards a previous workspace retry and immediately clears old tasks', async () => {
  let finishRetry!: (value: HomeDashboardData) => void;
  vi.mocked(fetchHomeDashboardData).mockResolvedValueOnce(data('Old task'));
  const view = render(<I18nProvider><HomeDashboard {...props} /></I18nProvider>);
  await screen.findByText('Old task');
  vi.mocked(fetchHomeDashboardData).mockImplementationOnce(() => new Promise((resolve) => { finishRetry = resolve; }));
  view.rerender(<I18nProvider><HomeDashboard {...props} refreshKey /></I18nProvider>);
  vi.mocked(fetchHomeDashboardData).mockResolvedValueOnce(data('New task'));
  view.rerender(<I18nProvider><HomeDashboard {...props} activeWorkspace={workspace('b')} /></I18nProvider>);
  expect(screen.queryByText('Old task')).not.toBeInTheDocument();
  await screen.findByText('New task');
  await act(async () => finishRetry(data('Stale response')));
  expect(screen.queryByText('Stale response')).not.toBeInTheDocument();
  expect(screen.getByText('New task')).toBeInTheDocument();
});

it('delegates details, focus and planning to the real workflow callbacks', async () => {
  vi.mocked(fetchHomeDashboardData).mockResolvedValueOnce(data('Suggested task'));
  render(<I18nProvider><HomeDashboard {...props} /></I18nProvider>);
  await screen.findByText('Suggested task');
  fireEvent.click(screen.getByRole('button', { name: 'View details' }));
  expect(props.onOpenTask).toHaveBeenCalledWith('Suggested task', 'board');
  fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
  expect(props.onStartFocusTask).toHaveBeenCalledWith(data('Suggested task').myTasks[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Quick Plan' }));
  expect(props.onOpenQuickPlan).toHaveBeenCalledOnce();
});

it('adds the ranked plan to Today from Home', async () => {
  vi.mocked(fetchHomeDashboardData).mockResolvedValueOnce(data('Planned task'));
  render(<I18nProvider><HomeDashboard {...props} /></I18nProvider>);
  await screen.findByText('Planned task');
  fireEvent.click(screen.getByRole('button', { name: 'Plan my day' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add top 3 to Today' }));
  expect(props.onPlanFocusTasks).toHaveBeenCalledWith([expect.objectContaining({ id: 'Planned task' })]);
});

it('keeps focus mode dismissed after Home unmounts and mounts again', async () => {
  const task = data('Focused task').myTasks[0];
  const focusControls: HomeFocusControls = {
    session: {
      focusTasks: [{ id: task.id, title: task.title, boardId: task.boardId, boardTitle: task.boardTitle, listTitle: 'Doing' }],
      timerState: { mode: 'focus', activeTaskId: task.id, isRunning: false, remainingSeconds: 1200, startedAt: 42, endsAt: null, plannedSeconds: 1500 },
      remainingSeconds: 1200,
      dailyFocusStats: { focusedMinutes: 0, completedSessions: 0, interruptedSessions: 0, topTaskTitle: null },
      activeFocusIntention: null,
      setFocusIntention: vi.fn(),
      handleStartFocusTimer: vi.fn(),
      pauseTimer: vi.fn(),
      resetTimer: vi.fn(),
      setMode: vi.fn(),
      setIsFocusDockCollapsed: vi.fn(),
    },
    onMarkDone: vi.fn().mockResolvedValue(true),
  };
  vi.mocked(fetchHomeDashboardData).mockResolvedValue(data('Focused task'));

  const view = render(<I18nProvider><HomeDashboard {...props} focusControls={focusControls} /></I18nProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Exit focus' }));
  await screen.findByText('Suggested next step');
  view.unmount();

  render(<I18nProvider><HomeDashboard {...props} focusControls={focusControls} /></I18nProvider>);
  await screen.findByText('Suggested next step');
  expect(screen.queryByRole('button', { name: 'Exit focus' })).not.toBeInTheDocument();
});
