import { useCallback, useState } from 'react';

export function useBoardDialogState() {
  const [groupOpen, setGroupOpen] = useState(false);
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [quickPlanListId, setQuickPlanListId] = useState<string | null>(null);

  return {
    groupDialog: { isOpen: groupOpen },
    boardDialog: { isOpen: createBoardOpen },
    activityDialog: { isOpen: activityOpen },
    quickPlanDialog: { isOpen: quickPlanListId !== null, activeListId: quickPlanListId },
    openGroupDialog: useCallback(() => setGroupOpen(true), []),
    closeGroupDialog: useCallback(() => setGroupOpen(false), []),
    openCreateBoardDialog: useCallback(() => setCreateBoardOpen(true), []),
    closeCreateBoardDialog: useCallback(() => setCreateBoardOpen(false), []),
    openActivityDialog: useCallback(() => setActivityOpen(true), []),
    closeActivityDialog: useCallback(() => setActivityOpen(false), []),
    openQuickPlanDialog: useCallback((listId?: string | null) => setQuickPlanListId(listId ?? '__default__'), []),
    closeQuickPlanDialog: useCallback(() => setQuickPlanListId(null), []),
  };
}
