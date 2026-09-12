import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HomeDashboard from './HomeDashboard';
import { I18nProvider } from '../../i18n';
import { fetchHomeDashboardData, type HomeDashboardData } from '../../services/home.service';
import type { AppUser, WorkspaceSummary } from '../../types/auth.type';

vi.mock('../../services/home.service', () => ({ fetchHomeDashboardData: vi.fn() }));
const user: AppUser = { id: 'user', name: 'Alex', email: null, avatarUrl: '', isMock: true };
const workspace = (id: string): WorkspaceSummary => ({ id, name: id, role: 'owner', ownerId: user.id });
const data = (title: string): HomeDashboardData => ({ myTasks: [{ id: title, title, boardId: 'board', boardTitle: 'Project', dueDate: null, priority: null }], recentBoards: [], holidays: [] });
const props = { currentUser: user, activeWorkspace: workspace('a'), onOpenTask: vi.fn(), onOpenBoard: vi.fn(), onToggleFocusTask: vi.fn(), onStartFocusTask: vi.fn(), isFocusTask: () => false, onOpenQuickPlan: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
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
