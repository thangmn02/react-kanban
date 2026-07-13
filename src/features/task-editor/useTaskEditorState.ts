import { useCallback, useState } from 'react';

import type { ITaskItem } from '../../types/task.type';

export type TaskEditorState =
  | { type: 'closed'; mode: 'create'; activeListId: null; editingTask: null }
  | { type: 'create'; mode: 'create'; activeListId: string; editingTask: null }
  | { type: 'edit'; mode: 'edit'; activeListId: null; editingTask: ITaskItem };

const CLOSED: TaskEditorState = { type: 'closed', mode: 'create', activeListId: null, editingTask: null };

export function useTaskEditorState() {
  const [state, setState] = useState<TaskEditorState>(CLOSED);
  const openCreateTaskDialog = useCallback((listId: string) => {
    setState({ type: 'create', mode: 'create', activeListId: listId, editingTask: null });
  }, []);
  const openEditTaskDialog = useCallback((task: ITaskItem) => {
    setState({ type: 'edit', mode: 'edit', activeListId: null, editingTask: task });
  }, []);
  const closeTaskDialog = useCallback(() => setState(CLOSED), []);

  return { state, isOpen: state.type !== 'closed', openCreateTaskDialog, openEditTaskDialog, closeTaskDialog };
}
