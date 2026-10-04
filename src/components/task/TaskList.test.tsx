import { DndContext } from '@dnd-kit/core';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import type { ITaskItem } from '../../types/task.type';
import TaskList from './TaskList';

afterEach(cleanup);

const task: ITaskItem = {
  id: 'past-due', title: 'Finished work', description: '', dueDate: '2020-01-01',
  isDone: false, assignees: [], labels: [], attachments: [], checklistItems: [],
};

function renderList(title: string) {
  return render(<I18nProvider><DndContext><TaskList
    listItem={{ id: title, title, tasks: [task.id] }} tasks={[task]}
    toggleMenu={vi.fn()} handleEditTask={vi.fn()} openMenuId={null}
    setIsModalOpen={vi.fn()} setDeleteItem={vi.fn()}
    onUpdateTask={vi.fn()} onToggleFocusTask={vi.fn()} isFocusTask={() => false}
  /></DndContext></I18nProvider>);
}

it('does not show an overdue badge for a card in Done, even when its done flag is stale', () => {
  renderList('Done');
  expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '+ Add task' })).toBeInTheDocument();
});

it('keeps the overdue badge for active work', () => {
  renderList('Doing');
  expect(screen.getByText(/Overdue/)).toBeInTheDocument();
});
