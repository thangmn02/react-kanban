import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import TodayPage from './TodayPage';
import type { TodayPageData, TodayTaskSummary } from '../../services/today.service';

const data = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('../../services/today.service', () => ({ fetchTodayPageData: vi.fn(async () => data.current) }));
vi.mock('../../hooks/use-summary-completion', () => ({ useSummaryCompletion: () => ({ completed: new Set(), pending: new Set(), message: '', run: vi.fn() }) }));
afterEach(cleanup);

const task = (id: string, title: string, extra: Partial<TodayTaskSummary> = {}): TodayTaskSummary => ({ id, boardId: 'b', boardTitle: 'Project', listId: 'l', listTitle: 'Doing',
  title, description: '', priority: null, dueDate: null, isDone: false, updatedAt: new Date().toISOString(), ...extra });
const late = task('late', 'Send the quote', { dueDate: '2020-01-01' });
const old = task('old', 'Old idea', { updatedAt: '2020-01-01T00:00:00Z' });
const fresh = task('fresh', 'Fresh idea');

beforeEach(() => {
  localStorage.clear(); localStorage.setItem('app.language', 'en');
  data.current = { overdueTasks: [late], dueTodayTasks: [], assignedTasks: [late, old, fresh], recentlyActiveTasks: [fresh, old] } satisfies TodayPageData;
});

const show = (onRescheduleTask?: (task: TodayTaskSummary, dueDate: string | null) => Promise<boolean>) => render(<I18nProvider><TodayPage
  currentUser={{ id: 'u', name: 'U' } as never} activeWorkspace={{ id: 'w' } as never} focusTasks={[]}
  dailyFocusStats={{ focusedMinutes: 0, completedSessions: 0, interruptedSessions: 0, topTaskTitle: null }}
  isFocusTask={() => false} onOpenTask={vi.fn()} onStartFocus={vi.fn()} onToggleTodayFocus={vi.fn()} onQuickCreateTask={vi.fn()}
  onRescheduleTask={onRescheduleTask} /></I18nProvider>);
const overdue = async () => (await screen.findByRole('heading', { name: 'Overdue' })).closest('[data-task-section]') as HTMLElement;

it('asks one gentle question about overdue work and moves a task to tomorrow', async () => {
  const onRescheduleTask = vi.fn().mockResolvedValue(true);
  show(onRescheduleTask);
  const section = await overdue();
  expect(within(section).getByText('Do today, move to tomorrow, or drop the date?')).toBeTruthy();
  fireEvent.click(within(section).getByRole('button', { name: 'Tomorrow: Send the quote' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Moved to tomorrow: Send the quote'));
  const [, dueDate] = onRescheduleTask.mock.calls[0];
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  expect(dueDate).toBe(`${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`);
});

it('drops the date and reports a failed save without pretending it worked', async () => {
  const onRescheduleTask = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  show(onRescheduleTask);
  fireEvent.click(within(await overdue()).getByRole('button', { name: 'No date: Send the quote' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Date removed: Send the quote'));
  expect(onRescheduleTask.mock.calls[0][1]).toBeNull();
  fireEvent.click(within(await overdue()).getByRole('button', { name: 'Tomorrow: Send the quote' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Could not change the date: Send the quote'));
});

it('moves a waiting task out of Overdue into its own group, and back', async () => {
  show(vi.fn());
  const section = await overdue();
  fireEvent.click(within(section).getByRole('button', { name: 'Waiting on…: Send the quote' }));
  fireEvent.change(within(section).getByLabelText('Who are you waiting on?'), { target: { value: 'Linh' } });
  fireEvent.change(within(section).getByLabelText('Follow up on'), { target: { value: '2999-01-01' } });
  fireEvent.click(within(section).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Overdue' })).toBeNull());
  const waiting = screen.getByRole('heading', { name: 'Waiting on' }).closest('[data-task-section]') as HTMLElement;
  expect(within(waiting).getByText('Waiting on Linh · follow up 2999-01-01')).toBeTruthy();
  // Cards leaving the other groups finish their exit animation first.
  await waitFor(() => expect(screen.getAllByText('Send the quote')).toHaveLength(1));
  fireEvent.click(within(waiting).getByRole('button', { name: 'Stop waiting: Send the quote' }));
  expect(await screen.findByRole('heading', { name: 'Overdue' })).toBeTruthy();
});

it('says when the follow-up day has arrived', async () => {
  localStorage.setItem('kora.taskFollowUps.v1:u:w', JSON.stringify({ late: { who: 'Linh', followUpOn: '2020-01-02', setAt: '2020-01-01T00:00:00Z' } }));
  show();
  expect(await screen.findByText('Follow up with Linh')).toBeTruthy();
});

it('lists each task once under More tasks and folds the untouched ones', async () => {
  show();
  await overdue();
  expect(screen.getByText('More tasks (3)')).toBeTruthy();
  expect(screen.getByText('1 not touched in 2 weeks')).toBeTruthy();
  const folded = screen.getByRole('heading', { name: 'Not touched in 2 weeks' }).closest('[data-task-section]') as HTMLElement;
  expect(within(folded).getByText('Old idea')).toBeTruthy();
  const more = screen.getByText('More tasks (3)').closest('details') as HTMLElement;
  expect(within(more).getAllByText('Old idea')).toHaveLength(1);
  expect(within(more).getAllByText('Fresh idea')).toHaveLength(1);
  expect(within(more).getAllByText('Send the quote')).toHaveLength(1);
});
