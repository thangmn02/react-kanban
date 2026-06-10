import { useCallback, useState } from 'react';

import type { ITaskItem } from '../types/task.type';

export type TaskDialogMode = 'create' | 'edit';

export interface AppDialogState {
  taskDialog: {
    isOpen: boolean;
    mode: TaskDialogMode;
    activeListId: string | null;
    editingTask: ITaskItem | null;
  };
  groupDialog: { isOpen: boolean };
  quickPlanDialog: {
    isOpen: boolean;
    activeListId: string | null;
  };
  boardDialog: { isOpen: boolean };
  activityDialog: { isOpen: boolean };
  membersDialog: { isOpen: boolean };
}

export interface UseAppDialogStateResult {
  dialogState: AppDialogState;
  openCreateTaskDialog: (listId: string) => void;
  openEditTaskDialog: (task: ITaskItem) => void;
  closeTaskDialog: () => void;
  openGroupDialog: () => void;
  closeGroupDialog: () => void;
  openQuickPlanDialog: (listId?: string | null) => void;
  closeQuickPlanDialog: () => void;
  openCreateBoardDialog: () => void;
  closeCreateBoardDialog: () => void;
  openActivityDialog: () => void;
  closeActivityDialog: () => void;
  openMembersDialog: () => void;
  closeMembersDialog: () => void;
}

const INITIAL_DIALOG_STATE: AppDialogState = {
  taskDialog: {
    isOpen: false,
    mode: 'create',
    activeListId: null,
    editingTask: null,
  },
  groupDialog: { isOpen: false },
  quickPlanDialog: {
    isOpen: false,
    activeListId: null,
  },
  boardDialog: { isOpen: false },
  activityDialog: { isOpen: false },
  membersDialog: { isOpen: false },
};

/**
 * Consolidates the App-level dialog open/close state (task create/edit, add group,
 * create board, board activity, workspace members) into one structured object with
 * named open/close helpers. The helpers are stable (empty-dependency `useCallback`
 * with functional updates) so they can be passed to memoized consumers without
 * invalidating their memoization.
 */
export function useAppDialogState(): UseAppDialogStateResult {
  const [dialogState, setDialogState] = useState<AppDialogState>(INITIAL_DIALOG_STATE);

  const openCreateTaskDialog = useCallback((listId: string) => {
    setDialogState((prev) => ({
      ...prev,
      taskDialog: {
        isOpen: true,
        mode: 'create',
        activeListId: listId,
        editingTask: null,
      },
    }));
  }, []);

  const openEditTaskDialog = useCallback((task: ITaskItem) => {
    setDialogState((prev) => ({
      ...prev,
      taskDialog: {
        isOpen: true,
        mode: 'edit',
        activeListId: null,
        editingTask: task,
      },
    }));
  }, []);

  const closeTaskDialog = useCallback(() => {
    setDialogState((prev) => ({
      ...prev,
      taskDialog: {
        ...prev.taskDialog,
        isOpen: false,
        activeListId: null,
        editingTask: null,
      },
    }));
  }, []);

  const openGroupDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, groupDialog: { isOpen: true } }));
  }, []);

  const closeGroupDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, groupDialog: { isOpen: false } }));
  }, []);

  const openQuickPlanDialog = useCallback((listId?: string | null) => {
    setDialogState((prev) => ({
      ...prev,
      quickPlanDialog: {
        isOpen: true,
        activeListId: listId ?? null,
      },
    }));
  }, []);

  const closeQuickPlanDialog = useCallback(() => {
    setDialogState((prev) => ({
      ...prev,
      quickPlanDialog: {
        isOpen: false,
        activeListId: null,
      },
    }));
  }, []);

  const openCreateBoardDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, boardDialog: { isOpen: true } }));
  }, []);

  const closeCreateBoardDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, boardDialog: { isOpen: false } }));
  }, []);

  const openActivityDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, activityDialog: { isOpen: true } }));
  }, []);

  const closeActivityDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, activityDialog: { isOpen: false } }));
  }, []);

  const openMembersDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, membersDialog: { isOpen: true } }));
  }, []);

  const closeMembersDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, membersDialog: { isOpen: false } }));
  }, []);

  return {
    dialogState,
    openCreateTaskDialog,
    openEditTaskDialog,
    closeTaskDialog,
    openGroupDialog,
    closeGroupDialog,
    openQuickPlanDialog,
    closeQuickPlanDialog,
    openCreateBoardDialog,
    closeCreateBoardDialog,
    openActivityDialog,
    closeActivityDialog,
    openMembersDialog,
    closeMembersDialog,
  };
}
