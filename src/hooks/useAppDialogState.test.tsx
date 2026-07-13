import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { BoardTaskItem } from '../types/task.type';
import { useAppDialogState } from './useAppDialogState';

const task: BoardTaskItem = {
  id: 'task-1',
  title: 'Edit me',
  description: '',
  assignees: [],
  labels: [],
  attachments: [],
  checklistItems: [],
};

describe('useAppDialogState task dialog', () => {
  it('opens create mode for a list and clears selection on close', () => {
    const { result } = renderHook(useAppDialogState);
    act(() => result.current.openCreateTaskDialog('list-1'));
    expect(result.current.dialogState.taskDialog).toEqual({
      isOpen: true,
      mode: 'create',
      activeListId: 'list-1',
      editingTask: null,
    });
    act(() => result.current.closeTaskDialog());
    expect(result.current.dialogState.taskDialog.isOpen).toBe(false);
    expect(result.current.dialogState.taskDialog.activeListId).toBeNull();
  });

  it('opens edit mode with the selected task and clears it on close', () => {
    const { result } = renderHook(useAppDialogState);
    act(() => result.current.openEditTaskDialog(task));
    expect(result.current.dialogState.taskDialog.editingTask).toBe(task);
    expect(result.current.dialogState.taskDialog.mode).toBe('edit');
    act(() => result.current.closeTaskDialog());
    expect(result.current.dialogState.taskDialog.editingTask).toBeNull();
  });
});
