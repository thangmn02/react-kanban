import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import { notify } from '../../../components/organisms/toast/notify';
import { createBoardFromTemplate, fetchBoardSnapshot } from '../../../services/board.service';
import { createList } from '../../../services/list.service';
import type { AppUser, AuthMode, WorkspaceMember } from '../../../types/auth.type';
import type { BoardDeleteItem, ITaskItem } from '../../../types/task.type';
import type { CreateBoardDialogFormData } from '../model/boardFormTypes';
import { useBoardDataManagement } from '../../../hooks/useBoardDataManagement';
import { useTaskOperations } from '../../../hooks/useTaskOperations';
import { useBoardFileCommands } from './useBoardFileCommands';
import { useI18n } from '../../../i18n';

interface Params {
  authMode: AuthMode;
  activeView: string;
  workspaceId: string | null;
  user: AppUser | null;
  workspaceMembers: WorkspaceMember[];
  editingTask: ITaskItem | null;
  activeListId: string | null;
  openCreateTaskDialog: (listId: string) => void;
  openEditTaskDialog: (task: ITaskItem) => void;
  closeTaskDialog: () => void;
  closeGroupDialog: () => void;
  closeCreateBoardDialog: () => void;
  onTaskCompleted: () => void;
  navigate: NavigateFunction;
  t: ReturnType<typeof useI18n>['t'];
}

export function useBoardPageController(params: Params) {
  const {
    authMode,
    activeView,
    workspaceId,
    user,
    workspaceMembers,
    editingTask,
    activeListId,
    openCreateTaskDialog,
    openEditTaskDialog,
    closeTaskDialog,
    closeGroupDialog,
    closeCreateBoardDialog,
    onTaskCompleted,
    navigate,
    t,
  } = params;
  const board = useBoardDataManagement({ authMode, activeWorkspaceId: workspaceId, userId: user?.id });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterDueDate, setFilterDueDate] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<BoardDeleteItem | null>(null);
  const [isRetryingBoard, setIsRetryingBoard] = useState(false);

  const taskOperations = useTaskOperations({
    boardData: board.boardData,
    setBoardData: board.setBoardData,
    activeBoardId: board.activeBoardId,
    activeWorkspaceId: workspaceId,
    syncBoardCache: board.syncBoardCache,
    setIsSavingBoard: board.setIsSavingBoard,
    userId: user?.id,
    deleteItem,
    setDeleteItem,
    editingTask,
    activeListId,
    closeTaskDialog,
    refreshBoardData: board.refreshBoardData,
    onTaskCompleted,
  });

  const handleRetryBoard = useCallback(() => {
    setIsRetryingBoard(true);
    board.setIsBoardLoading(true);
    void board.refreshBoardData({ showErrorToast: true }).finally(() => setIsRetryingBoard(false));
  }, [board]);

  const onSubmitList = useCallback(async (formData: { title: string }) => {
    if (!board.activeBoardId) {
      notify.error(t('toast.boardNotReady'));
      return;
    }
    board.setIsSavingBoard(true);
    try {
      await createList({
        workspace_id: workspaceId ?? undefined,
        board_id: board.activeBoardId,
        title: formData.title,
        position: board.boardData.columns.length,
      });
      await board.refreshBoardData();
      closeGroupDialog();
      notify.success(t('toast.listAdded'));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t('toast.unableAddList'));
    } finally {
      board.setIsSavingBoard(false);
    }
  }, [board, closeGroupDialog, t, workspaceId]);

  const handleCreateBoard = useCallback(async (formData: CreateBoardDialogFormData) => {
    board.setIsSavingBoard(true);
    try {
      const createdBoard = await createBoardFromTemplate({
        ...formData,
        workspaceId,
        createdBy: user?.id,
      });
      await board.refreshBoardData({ boardId: createdBoard.id });
      await board.refreshBoardList();
      closeCreateBoardDialog();
      if (workspaceId) navigate(`/workspaces/${workspaceId}/boards/${createdBoard.id}`);
      notify.success(t('toast.boardCreated'));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t('toast.unableCreateBoard'));
    } finally {
      board.setIsSavingBoard(false);
    }
  }, [board, closeCreateBoardDialog, navigate, t, user?.id, workspaceId]);

  const handleQuickAddTask = useCallback(() => {
    const firstListId = board.boardData.columns[0];
    if (!board.activeBoardId || !firstListId) {
      notify.info(t('toast.createBoardBeforeTask'));
      return;
    }
    openCreateTaskDialog(firstListId);
  }, [board.activeBoardId, board.boardData.columns, openCreateTaskDialog, t]);

  const handleOpenBoardFromHome = useCallback(async (boardId: string) => {
    board.setIsBoardLoading(true);
    await board.refreshBoardData({ boardId, showErrorToast: true });
    if (workspaceId) navigate(`/workspaces/${workspaceId}/boards/${boardId}`);
  }, [board, navigate, workspaceId]);

  const handleOpenTaskFromHome = useCallback(async (taskId: string, boardId: string) => {
    board.setIsBoardLoading(true);
    try {
      const snapshot = await fetchBoardSnapshot(boardId, workspaceId, user?.id);
      board.activeBoardIdRef.current = snapshot.boardId;
      board.setActiveBoardId(snapshot.boardId);
      board.setBoardData(snapshot.boardData);
      board.syncBoardCache(snapshot.boardId, snapshot.boardData);
      const task = snapshot.boardData.task[taskId];
      if (task) openEditTaskDialog(task);
      if (workspaceId) navigate(`/workspaces/${workspaceId}/boards/${boardId}`);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t('toast.unableOpenTask'));
    } finally {
      board.setIsBoardLoading(false);
    }
  }, [board, navigate, openEditTaskDialog, t, user?.id, workspaceId]);

  const clearBoardFilters = useCallback(() => {
    setSearchQuery(''); setFilterPriority(''); setFilterAssignee(''); setFilterDueDate('');
  }, []);
  const filterHighPriority = useCallback(() => {
    setSearchQuery(''); setFilterPriority('High'); setFilterAssignee(''); setFilterDueDate('');
  }, []);
  const filterDueToday = useCallback(() => {
    setSearchQuery(''); setFilterPriority(''); setFilterAssignee(''); setFilterDueDate('today');
  }, []);
  const focusBoardSearch = useCallback(() => {
    window.setTimeout(() => document.getElementById('board-search-input')?.focus(), 0);
  }, []);
  const toggleMenu = useCallback((listId: string | null) => {
    setOpenMenuId((current) => current === listId ? null : listId);
  }, []);

  const fileCommands = useBoardFileCommands({
    activeView,
    boardData: board.boardData,
    activeBoardId: board.activeBoardId,
    activeBoardSummary: board.activeBoardSummary,
    workspaceId,
    user,
    workspaceMembers,
    setIsSavingBoard: board.setIsSavingBoard,
    refreshBoardData: board.refreshBoardData,
    t,
  });

  const route = {
    boardData: board.boardData,
    activeBoardId: board.activeBoardId,
    activeBoardSummary: board.activeBoardSummary,
    boardSummaries: board.boardSummaries,
    isBoardLoading: board.isBoardLoading,
    boardErrorMessage: board.boardErrorMessage,
    setIsBoardLoading: board.setIsBoardLoading,
    refreshBoardData: board.refreshBoardData,
    searchQuery,
    setSearchQuery,
    filterPriority,
    setFilterPriority,
    filterAssignee,
    setFilterAssignee,
    filterDueDate,
    setFilterDueDate,
    openMenuId,
    setDeleteItem,
    isRetryingBoard,
    handleRetryBoard,
    handleQuickAddTask,
    handleOpenBoardFromHome,
    handleOpenTaskFromHome,
    clearBoardFilters,
    toggleMenu,
    handleExportCsv: fileCommands.handleExportCsv,
    handleImportCsv: fileCommands.handleImportCsv,
    handleUpdateTask: taskOperations.handleUpdateTask,
    handleBoardPositionChange: taskOperations.handleBoardPositionChange,
  };

  return {
    ...board,
    ...taskOperations,
    ...fileCommands,
    searchQuery,
    setSearchQuery,
    filterPriority,
    setFilterPriority,
    filterAssignee,
    setFilterAssignee,
    filterDueDate,
    setFilterDueDate,
    openMenuId,
    deleteItem,
    setDeleteItem: setDeleteItem as Dispatch<SetStateAction<BoardDeleteItem | null>>,
    isRetryingBoard,
    handleRetryBoard,
    onSubmitList,
    handleCreateBoard,
    handleQuickAddTask,
    handleOpenBoardFromHome,
    handleOpenTaskFromHome,
    clearBoardFilters,
    filterHighPriority,
    filterDueToday,
    focusBoardSearch,
    toggleMenu,
    route,
  };
}
