import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import TodayTaskCard from './TodayTaskCard';
import type { TodayTaskSummary } from '../../services/today.service';

afterEach(cleanup);
beforeEach(() => { localStorage.clear(); localStorage.setItem('app.language', 'en'); });

const task: TodayTaskSummary = { id: 't1', boardId: 'b', boardTitle: 'Project', listId: 'l', listTitle: 'Doing', title: 'Send the quote',
  description: '', priority: null, dueDate: '2026-11-01', isDone: false, updatedAt: null };
const base = { task, isFocusTask: false, onOpenTask: vi.fn(), onStartFocus: vi.fn(), onToggleTodayFocus: vi.fn() };
const show = (props: Partial<Parameters<typeof TodayTaskCard>[0]> = {}) => render(<I18nProvider><TodayTaskCard {...base} {...props} /></I18nProvider>);

it('offers no reschedule or waiting controls unless asked', () => {
  show();
  expect(screen.queryByRole('button', { name: /Tomorrow/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Waiting on/ })).toBeNull();
});

it('moves an overdue task to tomorrow or drops its date', () => {
  const onReschedule = vi.fn();
  show({ onReschedule });
  fireEvent.click(screen.getByRole('button', { name: 'Tomorrow: Send the quote' }));
  fireEvent.click(screen.getByRole('button', { name: 'No date: Send the quote' }));
  expect(onReschedule.mock.calls).toEqual([[task, 'tomorrow'], [task, 'none']]);
});

it('disables the reschedule buttons while a change is being saved', () => {
  show({ onReschedule: vi.fn(), isRescheduling: true });
  expect(screen.getByRole('button', { name: 'Tomorrow: Send the quote' })).toHaveProperty('disabled', true);
});

it('marks a task as waiting on someone with a follow-up day', () => {
  const onWait = vi.fn();
  show({ onWait });
  fireEvent.click(screen.getByRole('button', { name: 'Waiting on…: Send the quote' }));
  fireEvent.change(screen.getByLabelText('Who are you waiting on?'), { target: { value: 'Linh' } });
  fireEvent.change(screen.getByLabelText('Follow up on'), { target: { value: '2030-01-15' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onWait).toHaveBeenCalledWith(task, 'Linh', '2030-01-15');
  expect(screen.queryByLabelText('Follow up on')).toBeNull();
});

it('shows who a task waits on, flags the follow-up day, and can stop waiting', () => {
  const onStopWaiting = vi.fn(), waiting = { who: 'Linh', followUpOn: '2026-11-14', setAt: '' };
  const view = show({ waiting, onStopWaiting, onWait: vi.fn() });
  expect(screen.getByText('Waiting on Linh · follow up 2026-11-14')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Waiting on…/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Stop waiting: Send the quote' }));
  expect(onStopWaiting).toHaveBeenCalledWith(task);
  view.unmount();
  show({ waiting, followUpDue: true });
  expect(screen.getByText('Follow up with Linh')).toBeTruthy();
});

it('sets a personal deadline before the real one, and clears it', () => {
  const onSetOwnDeadline = vi.fn(), future = { ...task, dueDate: '2999-06-10' };
  const view = show({ task: future, onSetOwnDeadline });
  fireEvent.click(screen.getByRole('button', { name: 'Aim earlier…: Send the quote' }));
  const input = screen.getByLabelText('Aim to finish by');
  expect(input.getAttribute('max')).toBe('2999-06-09');
  fireEvent.change(input, { target: { value: '2999-06-10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onSetOwnDeadline).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '2999-06-05' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onSetOwnDeadline).toHaveBeenCalledWith(future, '2999-06-05');
  view.unmount();
  show({ task: future, onSetOwnDeadline, ownDeadline: { on: '2999-06-05' } });
  expect(screen.getByText('Aiming for 2999-06-05')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear my deadline: Send the quote' }));
  expect(onSetOwnDeadline).toHaveBeenLastCalledWith(future, '');
});

it('offers no personal deadline when the task has no due date or it is already past', () => {
  const view = show({ task: { ...task, dueDate: null }, onSetOwnDeadline: vi.fn() });
  expect(screen.queryByRole('button', { name: /Aim earlier/ })).toBeNull();
  view.unmount();
  show({ onSetOwnDeadline: vi.fn() });
  expect(screen.queryByRole('button', { name: /Aim earlier/ })).toBeNull();
});
