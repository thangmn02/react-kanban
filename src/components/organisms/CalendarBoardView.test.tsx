import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../i18n';
import type { BoardData, ITaskItem } from '../../types/task.type';
import CalendarBoardView from './CalendarBoardView';

const task: ITaskItem = {
  id: 'task-1',
  title: 'Ship calendar polish',
  description: '',
  dueDate: '2026-09-28',
  assignees: [],
  labels: [],
  attachments: [],
  checklistItems: [],
};

const boardData: BoardData = {
  columns: ['todo', 'nearly-done', 'done'],
  list: {
    todo: { id: 'todo', title: 'To do', tasks: ['task-1'] },
    'nearly-done': { id: 'nearly-done', title: 'Nearly done', tasks: [] },
    done: { id: 'done', title: 'Done', tasks: [] },
  },
  task: { 'task-1': task },
};

function renderCalendar(onOpenTask = vi.fn()) {
  render(
    <I18nProvider>
      <CalendarBoardView
        boardData={boardData}
        searchQuery=""
        filterPriority=""
        filterAssignee=""
        filterDueDate=""
        onOpenTask={onOpenTask}
      />
    </I18nProvider>,
  );
  return onOpenTask;
}

describe('CalendarBoardView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 28, 9));
    window.localStorage.setItem('app.language', 'en');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('fills today from task due dates and opens its task', () => {
    const onOpenTask = renderCalendar();
    expect(screen.getByText('1 due')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Ship calendar polish/ }));
    expect(onOpenTask).toHaveBeenCalledWith(task);
  });

  it('shows the quiet empty state when another day is selected', () => {
    renderCalendar();
    fireEvent.click(screen.getByRole('button', { name: 'Tuesday, September 29th, 2026' }));
    expect(screen.getByText('Nothing is due.')).toBeTruthy();
    expect(screen.queryByText(/Empty is good|No events to maintain|Automatic · no data entry/)).toBeNull();
  });
});
