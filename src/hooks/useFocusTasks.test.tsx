import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { BoardData, BoardTaskItem } from '../types/task.type';
import type { FocusTask } from '../types/focus.type';
import { writeScopedJSON, type StorageScope } from '../shared/storage/storageAdapter';
import { useFocusTasks } from './useFocusTasks';

const task: BoardTaskItem = {
  id: 'task-1',
  title: 'Characterize focus',
  description: '',
  assignees: [],
  labels: [],
  attachments: [],
  checklistItems: [],
  isDone: false,
};
const boardData: BoardData = {
  columns: ['list-1'],
  list: { 'list-1': { id: 'list-1', title: 'Doing', tasks: [task.id] } },
  task: { [task.id]: task },
};
const scopeA: StorageScope = { userId: 'user-a', workspaceId: 'workspace-a' };
const scopeB: StorageScope = { userId: 'user-a', workspaceId: 'workspace-b' };

const storedFocusTask = (id: string, title: string): FocusTask => ({
  id,
  title,
  boardId: 'board-1',
  boardTitle: 'Board',
});

describe('useFocusTasks', () => {
  beforeEach(() => window.localStorage.clear());

  it('pins, activates, updates, and removes a focus task', () => {
    const { result } = renderHook(() => useFocusTasks(boardData, scopeA));

    act(() => {
      expect(result.current.pinFocusTask({
        task,
        boardId: 'board-1',
        boardTitle: 'Board',
        listId: 'list-1',
        listTitle: 'Doing',
      })).toBe(true);
    });

    expect(result.current.focusTasks).toHaveLength(1);
    expect(result.current.activeFocusTaskId).toBe(task.id);
    expect(result.current.isFocusTask(task.id)).toBe(true);

    act(() => result.current.updateFocusedTask(task.id, { isDone: true }));
    expect(result.current.focusTasks[0].isDone).toBe(false);

    act(() => result.current.removeFocusTask(task.id));
    expect(result.current.focusTasks).toEqual([]);
    expect(result.current.activeFocusTaskId).toBeNull();
  });

  it('rehydrates immediately when workspace scope changes without overwriting either scope', () => {
    writeScopedJSON(scopeA, 'focus_tasks', [storedFocusTask('a', 'Workspace A')]);
    writeScopedJSON(scopeA, 'active_focus_task', 'a');
    writeScopedJSON(scopeB, 'focus_tasks', [storedFocusTask('b', 'Workspace B')]);
    writeScopedJSON(scopeB, 'active_focus_task', 'b');

    const { result, rerender } = renderHook(
      ({ scope }) => useFocusTasks({ columns: [], list: {}, task: {} }, scope),
      { initialProps: { scope: scopeA } },
    );
    expect(result.current.focusTasks[0].id).toBe('a');

    rerender({ scope: scopeB });
    expect(result.current.focusTasks[0].id).toBe('b');
    expect(result.current.activeFocusTaskId).toBe('b');

    rerender({ scope: scopeA });
    expect(result.current.focusTasks[0].id).toBe('a');
    expect(result.current.activeFocusTaskId).toBe('a');
  });
});
