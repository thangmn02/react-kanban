import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ITaskItem } from '../../types/task.type';
import { useTaskEditorState } from './useTaskEditorState';

const task: ITaskItem = { id: 't1', title: 'Task', description: '', assignees: [], labels: [], attachments: [], checklistItems: [] };

describe('useTaskEditorState', () => {
  it('keeps create and edit states mutually exclusive', () => {
    const { result } = renderHook(useTaskEditorState);
    act(() => result.current.openCreateTaskDialog('list-1'));
    expect(result.current.state).toMatchObject({ type: 'create', activeListId: 'list-1', editingTask: null });
    act(() => result.current.openEditTaskDialog(task));
    expect(result.current.state).toMatchObject({ type: 'edit', activeListId: null, editingTask: task });
    act(() => result.current.closeTaskDialog());
    expect(result.current.state.type).toBe('closed');
  });
});
