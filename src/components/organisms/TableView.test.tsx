import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import TableView from './TableView';
import type { BoardData } from '../../types/task.type';
import { buildTaskFieldUpdatePayload } from '../../utils/boardDataMapper';

vi.mock('../../app/view-context', async () => {
  const { useState } = await import('react');
  return { useRetainedViewState: (_key: string, initial: () => unknown) => useState(initial) };
});
afterEach(cleanup);
beforeEach(() => { localStorage.clear(); localStorage.setItem('app.language', 'en'); });

const boardData: BoardData = {
  columns: ['l1'],
  list: { l1: { id: 'l1', title: 'Doing', tasks: ['t1'] } },
  task: { t1: { id: 't1', title: 'Send the quote', description: '', assignees: [], priority: 'Low', startDate: '2026-11-10', dueDate: '2026-11-20', labels: [], attachments: [], checklistItems: [] } },
};
const show = (onUpdateTask?: (id: string, fields: object) => void) => {
  const onOpenTask = vi.fn();
  render(<I18nProvider><TableView boardData={boardData} searchQuery="" filterPriority="" filterAssignee="" filterDueDate="" onOpenTask={onOpenTask} onUpdateTask={onUpdateTask} /></I18nProvider>);
  return onOpenTask;
};

it('stays read-only without an update handler', () => {
  show();
  expect(screen.queryByLabelText('Priority: Send the quote')).toBeNull();
  expect(screen.queryByLabelText('Due date: Send the quote')).toBeNull();
});

it('edits priority and due date in the row without opening the task', () => {
  const onUpdateTask = vi.fn(), onOpenTask = show(onUpdateTask);
  const priority = screen.getByLabelText('Priority: Send the quote'), due = screen.getByLabelText('Due date: Send the quote');
  fireEvent.click(priority);
  fireEvent.change(priority, { target: { value: 'High' } });
  fireEvent.change(priority, { target: { value: '' } });
  fireEvent.click(due);
  fireEvent.change(due, { target: { value: '2026-11-25' } });
  fireEvent.change(due, { target: { value: '' } });
  expect(onUpdateTask.mock.calls).toEqual([
    ['t1', { priority: 'High' }], ['t1', { priority: undefined }],
    ['t1', { dueDate: '2026-11-25' }], ['t1', { dueDate: undefined }],
  ]);
  expect(onOpenTask).not.toHaveBeenCalled();
});

it('refuses a due date before the start date', () => {
  const onUpdateTask = vi.fn();
  show(onUpdateTask);
  fireEvent.change(screen.getByLabelText('Due date: Send the quote'), { target: { value: '2026-11-01' } });
  expect(onUpdateTask).not.toHaveBeenCalled();
});

it('writes a changed or cleared due date to the task row', () => {
  expect(buildTaskFieldUpdatePayload({ dueDate: '2026-11-25' })).toEqual({ due_date: '2026-11-25' });
  expect(buildTaskFieldUpdatePayload({ dueDate: undefined })).toEqual({ due_date: null });
  expect(buildTaskFieldUpdatePayload({ priority: 'High' })).toEqual({ priority: 'High' });
});
