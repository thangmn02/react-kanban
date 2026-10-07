import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HomeDashboard from './HomeDashboard';
import { I18nProvider } from '../../i18n';
import { fetchHomeDashboardData, type HomeDashboardData } from '../../services/home.service';
import type { AppUser, WorkspaceSummary } from '../../types/auth.type';
import type { HomeFocusControls } from '../home/HomeFocusView';

vi.mock('../../services/home.service', () => ({ fetchHomeDashboardData: vi.fn() }));
// These dashboard fixtures use the local store even in connected-build CI.
// Remote service behavior is covered separately by the service integration tests.
vi.mock('../../lib/supabase', () => ({ default: null, authMode: 'mock', isLocalDemoMode: true,
  requireSupabaseClient: () => { throw new Error('Unexpected remote client in local dashboard test'); } }));
const user: AppUser = { id: 'user', name: 'Alex', email: null, avatarUrl: '', isMock: true };
const workspace = (id: string): WorkspaceSummary => ({ id, name: id, role: 'owner', ownerId: user.id });
const data = (title: string): HomeDashboardData => ({ myTasks: [{ id: title, title, boardId: 'board', boardTitle: 'Project', dueDate: null, priority: null }], recentBoards: [], holidays: [] });
const props = { currentUser: user, activeWorkspace: workspace('a'), onOpenTask: vi.fn(), onOpenBoard: vi.fn(), onToggleFocusTask: vi.fn(), onStartFocusTask: vi.fn(), onPlanFocusTasks: vi.fn(), isFocusTask: () => false, onOpenQuickPlan: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); });
afterEach(cleanup);

it('keeps the public Home layout without fetching private data and gates local planning', () => {
  const onRequireSignIn = vi.fn().mockReturnValue(false);
  render(<I18nProvider><HomeDashboard {...props} currentUser={null} activeWorkspace={null} onRequireSignIn={onRequireSignIn} /></I18nProvider>);
  expect(screen.getByRole('heading', { level: 1, name: 'Kora' })).toBeInTheDocument();
  expect(screen.getByText('Needs attention')).toBeInTheDocument();
  expect(screen.getByText('Recent boards')).toBeInTheDocument();
  expect(fetchHomeDashboardData).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Order today’s tasks' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pin a thread' }));
  expect(onRequireSignIn).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(props.onPlanFocusTasks).not.toHaveBeenCalled();
});

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
  render(<I18nProvider><HomeDashboard {...props} isFocusTask={() => true} /></I18nProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'View details: Suggested task' }));
  expect(props.onOpenTask).toHaveBeenCalledWith('Suggested task', 'board');
  fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
  expect(props.onStartFocusTask).toHaveBeenCalledWith(expect.objectContaining(data('Suggested task').myTasks[0]));
  fireEvent.click(screen.getByRole('button', { name: 'Add multiple tasks' }));
  expect(props.onOpenQuickPlan).toHaveBeenCalledOnce();
});

it('adds the ranked plan to Today from Home', async () => {
  vi.mocked(fetchHomeDashboardData).mockResolvedValueOnce(data('Planned task'));
  render(<I18nProvider><HomeDashboard {...props} /></I18nProvider>);
  await screen.findByText('Planned task');
  fireEvent.click(screen.getByRole('button', { name: 'Order today’s tasks' }));
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
  vi.mocked(fetchHomeDashboardData).mockResolvedValue(data('Assigned task'));

  const view = render(<I18nProvider><HomeDashboard {...props} focusControls={focusControls} /></I18nProvider>);
  // Restoring a paused timer must not enter full focus by itself.
  await screen.findByText('Needs attention');
  expect(screen.queryByRole('button', { name: 'Exit focus' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
  expect(screen.getByRole('timer')).toHaveTextContent('20:00');
  fireEvent.click(screen.getByRole('button', { name: 'Exit focus' }));
  await screen.findByText('Needs attention');
  expect(focusControls.session.pauseTimer).not.toHaveBeenCalled();
  expect(focusControls.session.resetTimer).not.toHaveBeenCalled();
  view.unmount();
  // A fresh tab/browser run has no dismissal marker in sessionStorage.
  sessionStorage.clear();

  const nextView = render(<I18nProvider><HomeDashboard {...props} focusControls={focusControls} /></I18nProvider>);
  await screen.findByText('Needs attention');
  expect(screen.queryByRole('button', { name: 'Exit focus' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'View details: Focused task' })).toBeInTheDocument();
  expect(screen.getByText('Assigned task')).toBeInTheDocument();
  // Starting/resuming in the dock creates a different timer session, not a
  // request to reopen full Home focus.
  nextView.rerender(<I18nProvider><HomeDashboard {...props} focusControls={{ ...focusControls, session: { ...focusControls.session, timerState: { ...focusControls.session.timerState, startedAt: 84, isRunning: true } } }} /></I18nProvider>);
  expect(screen.queryByRole('button', { name: 'Exit focus' })).not.toBeInTheDocument();
  // Explicit entry still works after a previous exit.
  fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
  expect(screen.getByRole('button', { name: 'Exit focus' })).toBeInTheDocument();
});
