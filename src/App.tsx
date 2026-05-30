import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { data } from './data';
import type { BoardData, BoardDeleteItem, ITaskItem, TaskDialogFormData } from './types/task.type';
import type { BoardRow } from './types/supabase.type';
import AddGroupDialog from './components/organisms/dialog/AddGroupDialog';
import CreateBoardDialog from './components/organisms/dialog/CreateBoardDialog';
import DeleteDialog from './components/organisms/dialog/DeleteDialog';
import CalendarBoardView from './components/organisms/CalendarBoardView';
import HomeDashboard from './components/organisms/HomeDashboard';
import KanbanBoard from './components/organisms/KanbanBoard';
import TaskDialog from './components/organisms/dialog/TaskDialog';
import QuickSearch from './components/organisms/QuickSearch';
import AuthPage from './components/auth/AuthPage';
import BoardEmptyState from './components/board/BoardEmptyState';
import CommandPalette from './components/command/CommandPalette';
import OnboardingPage from './components/onboarding/OnboardingPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuth } from './hooks/useAuth';
import { useDueDateReminder } from './hooks/useDueDateReminder';
import { useGlobalKeyboardShortcuts } from './hooks/useGlobalKeyboardShortcuts';
import { useWorkspaceSession } from './hooks/useWorkspaceSession';
import { useWorkspaceMembers } from './hooks/useWorkspaceMembers';
import { useTaskRealtime } from './hooks/useTaskRealtime';
import { createBoardFromTemplate, fetchBoardSnapshot, fetchBoards } from './services/board.service';
import { replaceTaskChecklistItems } from './services/checklist.service';
import { replaceTaskLabels } from './services/label.service';
import { createList, deleteList, updateListPositions } from './services/list.service';
import {
  createTask,
  deleteTask,
  deleteTasksByListId,
  updateTask,
  updateTaskPositions,
} from './services/task.service';
import { readBoardCache, writeBoardCache } from './utils/boardCache';
import {
  buildTaskFieldUpdatePayload,
  buildTaskInsertPayload,
  buildTaskUpdatePayload,
} from './utils/boardDataMapper';
import { isLocalDemoMode } from './lib/supabase';
import { createActivity } from './services/activity.service';
import BoardActivityDialog from './components/organisms/dialog/BoardActivityDialog';
import FocusDock from './components/focus/FocusDock';
import FocusLimitToast from './components/focus/FocusLimitToast';
import WorkspaceMembersDialog from './components/workspace/WorkspaceMembersDialog';
import { useFocusTasks } from './hooks/useFocusTasks';
import { usePomodoroTimer } from './hooks/usePomodoroTimer';
import type { FocusTask, FocusTaskInput, PomodoroMode } from './types/focus.type';
import type { HomeTaskSummary } from './services/home.service';
import type { OnboardingSetupValues } from './types/onboarding.type';
import type { CommandPaletteAction } from './types/command.type';

type BoardViewMode = 'auth' | 'onboarding' | 'home' | 'board' | 'calendar';

interface CreateBoardDialogFormData {
  title: string;
  description: string;
  templateId: string;
}

interface BoardChangeActivity {
  taskId: string;
  description: string;
}

function App() {
  const {
    authMode,
    user,
    isAuthLoading,
    signOut,
  } = useAuth();
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    isWorkspaceLoading,
    workspaceErrorMessage,
    setActiveWorkspaceId,
    createWorkspace,
  } = useWorkspaceSession(user);
  const {
    members: workspaceMembers,
    isLoadingMembers,
    memberErrorMessage,
    addMember,
    changeMemberRole,
    removeMember,
  } = useWorkspaceMembers(activeWorkspaceId);

  const getInitialView = (): BoardViewMode => {
    if (typeof window === 'undefined') {
      return 'home';
    }

    if (window.location.pathname.startsWith('/auth')) {
      return 'auth';
    }

    if (window.location.pathname.startsWith('/onboarding')) {
      return 'onboarding';
    }

    if (window.location.pathname.startsWith('/board')) {
      return 'board';
    }

    if (window.location.pathname.startsWith('/calendar')) {
      return 'calendar';
    }

    return 'home';
  };

  const cachedBoard = useMemo(() => readBoardCache(), []);
  const initialBoardId = cachedBoard?.boardId || null;
  const [boardData, setBoardData] = useState<BoardData>(() => cachedBoard?.boardData || data);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(() => initialBoardId);
  const [boardSummaries, setBoardSummaries] = useState<BoardRow[]>([]);
  const [activeView, setActiveView] = useState<BoardViewMode>(() => getInitialView());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState(false);
  const [isBoardActivityModalOpen, setIsBoardActivityModalOpen] = useState(false);
  const [isWorkspaceMembersDialogOpen, setIsWorkspaceMembersDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterDueDate, setFilterDueDate] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<BoardDeleteItem | null>(null);
  const [editingTask, setEditingTask] = useState<ITaskItem | null>(null);
  const [isBoardLoading, setIsBoardLoading] = useState(true);
  const [isSavingBoard, setIsSavingBoard] = useState(false);
  const [boardErrorMessage, setBoardErrorMessage] = useState<string | null>(null);
  const [isFocusDockCollapsed, setIsFocusDockCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const activeBoardIdRef = useRef<string | null>(initialBoardId);
  const activeBoardSummary = useMemo(() => (
    boardSummaries.find((boardSummary) => boardSummary.id === activeBoardId) || null
  ), [boardSummaries, activeBoardId]);

  const setActiveViewWithPath = useCallback((nextView: BoardViewMode) => {
    setActiveView(nextView);

    if (typeof window === 'undefined') {
      return;
    }

    const nextPath = nextView === 'home'
      ? '/home'
      : nextView === 'auth'
        ? '/auth'
        : nextView === 'onboarding'
          ? '/onboarding'
      : nextView === 'calendar'
        ? '/calendar'
        : '/board';

    if (window.location.pathname !== nextPath) {
      window.history.pushState({ view: nextView }, '', nextPath);
    }
  }, []);

  const syncBoardCache = useCallback((nextBoardId: string | null, nextBoardData: BoardData) => {
    writeBoardCache({
      boardId: nextBoardId,
      boardData: nextBoardData,
    });
  }, []);

  const refreshBoardList = useCallback(async () => {
    const boardRows = await fetchBoards(activeWorkspaceId);
    setBoardSummaries(boardRows);
    return boardRows;
  }, [activeWorkspaceId]);

  const refreshBoardData = useCallback(async ({
    boardId,
    showErrorToast = false,
  }: {
    boardId?: string | null;
    showErrorToast?: boolean;
  } = {}) => {
    try {
      if (authMode === 'supabase' && !activeWorkspaceId) {
        setIsBoardLoading(false);
        return;
      }

      const boardSnapshot = await fetchBoardSnapshot(
        boardId === undefined ? activeBoardIdRef.current : boardId,
        activeWorkspaceId,
        user?.id,
        { seedIfMissing: authMode === 'mock' },
      );

      activeBoardIdRef.current = boardSnapshot.boardId;
      setActiveBoardId(boardSnapshot.boardId);
      setBoardData(boardSnapshot.boardData);
      syncBoardCache(boardSnapshot.boardId, boardSnapshot.boardData);
      setBoardErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch board data from Supabase.';

      setBoardErrorMessage(message);

      if (showErrorToast) {
        toast.error(message, { theme: 'colored' });
      }
    } finally {
      setIsBoardLoading(false);
    }
  }, [activeWorkspaceId, authMode, syncBoardCache, user?.id]);

  useEffect(() => {
    activeBoardIdRef.current = activeBoardId;
  }, [activeBoardId]);

  useEffect(() => {
    if (isAuthLoading || isWorkspaceLoading) {
      return;
    }

    if (authMode === 'supabase' && !user) {
      setActiveViewWithPath('auth');
      return;
    }

    if (authMode === 'supabase' && user && !activeWorkspaceId) {
      setActiveViewWithPath('onboarding');
      setIsBoardLoading(false);
      return;
    }

    void (async () => {
      await refreshBoardData({ boardId: initialBoardId });
      await refreshBoardList();
    })();
  }, [
    activeWorkspaceId,
    authMode,
    initialBoardId,
    isAuthLoading,
    isWorkspaceLoading,
    refreshBoardData,
    refreshBoardList,
    setActiveViewWithPath,
    user,
  ]);

  useEffect(() => {
    const handlePopState = () => {
      setActiveView(getInitialView());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    syncBoardCache(activeBoardId, boardData);
  }, [activeBoardId, boardData, syncBoardCache]);

  useTaskRealtime({
    boardId: activeBoardId,
    setBoardData,
    refreshBoardData,
  });
  useDueDateReminder(boardData);

  const {
    focusTasks,
    activeFocusTask,
    activeFocusTaskId,
    limitMessage: focusLimitMessage,
    isFocusTask,
    removeFocusTask,
    setActiveFocusTaskId,
    toggleFocusTask,
    updateFocusedTask,
    clearLimitMessage,
  } = useFocusTasks(boardData);

  const handlePomodoroComplete = useCallback((task: FocusTask | null, mode: PomodoroMode) => {
    const modeLabel = mode === 'focus' ? 'Focus session' : mode === 'shortBreak' ? 'Short break' : 'Long break';
    toast.success(`${modeLabel} completed${task ? ` for "${task.title}"` : ''}.`, { theme: 'colored' });

    if (task && mode === 'focus') {
      void createActivity(task.id, 'update', {
        description: 'Completed a 25-minute focus session',
        field: 'focusSession',
      }, undefined, undefined, {
        workspaceId: activeWorkspaceId,
        boardId: task.boardId,
        actorId: user?.id,
      }).catch((error) => {
        console.warn('Unable to log focus session activity:', error);
      });
    }
  }, [activeWorkspaceId, user?.id]);

  const {
    timerState,
    remainingSeconds,
    startTimer,
    pauseTimer,
    resetTimer,
    setMode: setPomodoroMode,
    setActiveTimerTaskId,
  } = usePomodoroTimer({
    activeFocusTask,
    onComplete: handlePomodoroComplete,
  });

  const buildChangedTaskPositionPayload = (previousBoardData: BoardData, nextBoardData: BoardData) => {
    const previousTaskLocations = new Map<string, { listId: string; position: number }>();

    previousBoardData.columns.forEach((listId) => {
      previousBoardData.list[listId]?.tasks.forEach((taskId, position) => {
        previousTaskLocations.set(taskId, {
          listId,
          position,
        });
      });
    });

    return nextBoardData.columns.flatMap((listId) => (
      nextBoardData.list[listId].tasks.map((taskId, position) => ({
        id: taskId,
        list_id: listId,
        position,
      }))
    )).filter(({ id, list_id, position }) => {
      const previousLocation = previousTaskLocations.get(id);

      return !previousLocation
        || previousLocation.listId !== list_id
        || previousLocation.position !== position;
    });
  };

  const buildChangedListPositionPayload = (previousBoardData: BoardData, nextBoardData: BoardData) => {
    const previousListPositions = new Map<string, number>();
    const normalizedListPositionStep = 1000;

    previousBoardData.columns.forEach((listId, position) => {
      previousListPositions.set(listId, position * normalizedListPositionStep);
    });

    return nextBoardData.columns.map((listId, position) => ({
      id: listId,
      position: position * normalizedListPositionStep,
    })).filter(({ id, position }) => previousListPositions.get(id) !== position);
  };

  const onSubmitList = async (formData: { title: string }) => {
    if (!activeBoardId) {
      toast.error('Board is not ready yet.', { theme: 'colored' });
      return;
    }

    setIsSavingBoard(true);

    try {
      await createList({
        workspace_id: activeWorkspaceId ?? undefined,
        board_id: activeBoardId,
        title: formData.title,
        position: boardData.columns.length,
      });

      await refreshBoardData();
      setIsGroupModalOpen(false);
      toast.success('List added successfully!', { theme: 'colored' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to add list.';

      toast.error(message, { theme: 'colored' });
    } finally {
      setIsSavingBoard(false);
    }
  };

  const handleCreateBoard = async (formData: CreateBoardDialogFormData) => {
    setIsSavingBoard(true);

    try {
      const createdBoard = await createBoardFromTemplate({
        title: formData.title,
        description: formData.description,
        templateId: formData.templateId,
        workspaceId: activeWorkspaceId,
        createdBy: user?.id,
      });

      await refreshBoardData({ boardId: createdBoard.id });
      await refreshBoardList();
      setIsCreateBoardModalOpen(false);
      setActiveViewWithPath('board');
      toast.success('Board created successfully!', { theme: 'colored' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create board.';
      toast.error(message, { theme: 'colored' });
    } finally {
      setIsSavingBoard(false);
    }
  };

  const handleQuickAddTask = useCallback(() => {
    const firstListId = boardData.columns[0];

    if (!activeBoardId || !firstListId) {
      toast.info('Create a board and at least one list before adding a task.', { theme: 'colored' });
      return;
    }

    setActiveListId(firstListId);
    setIsModalOpen(true);
    setActiveViewWithPath('board');
  }, [activeBoardId, boardData.columns, setActiveViewWithPath]);

  const handleCompleteOnboarding = async (setupValues: OnboardingSetupValues) => {
    if (!user) {
      toast.error('Session is not ready yet.', { theme: 'colored' });
      return;
    }

    const createdWorkspace = await createWorkspace(setupValues.workspaceName);
    const createdBoard = await createBoardFromTemplate({
      title: setupValues.boardTitle,
      description: setupValues.boardDescription,
      templateId: setupValues.templateId,
      workspaceId: createdWorkspace.id,
      createdBy: user.id,
    });

    const boardSnapshot = await fetchBoardSnapshot(
      createdBoard.id,
      createdWorkspace.id,
      user.id,
      { seedIfMissing: false },
    );
    const boardRows = await fetchBoards(createdWorkspace.id);

    setActiveWorkspaceId(createdWorkspace.id);
    activeBoardIdRef.current = boardSnapshot.boardId;
    setActiveBoardId(boardSnapshot.boardId);
    setBoardData(boardSnapshot.boardData);
    setBoardSummaries(boardRows);
    syncBoardCache(boardSnapshot.boardId, boardSnapshot.boardData);
    setActiveViewWithPath('board');
    toast.success('Workspace and first board created.', { theme: 'colored' });
  };

  const onSubmitCard = async (formData: TaskDialogFormData) => {
    if (!activeListId || !activeBoardId) return;

    setIsSavingBoard(true);

    try {
      const createdTask = await createTask({
        ...buildTaskInsertPayload({
          boardId: activeBoardId,
          listId: activeListId,
          title: formData.title,
          description: formData.description || '',
          priority: formData.priority,
          startDate: formData.startDate,
          dueDate: formData.dueDate,
          position: boardData.list[activeListId].tasks.length,
          assignees: formData.assignees,
          attachments: formData.attachments,
          image: formData.image,
        }),
        workspace_id: activeWorkspaceId ?? undefined,
        created_by: user?.id,
      });

      await Promise.all([
        replaceTaskChecklistItems(createdTask.id, formData.checklistItems, activeWorkspaceId),
        replaceTaskLabels(createdTask.id, activeBoardId, formData.labels, activeWorkspaceId),
      ]);

      await createActivity(createdTask.id, 'create', {
        description: `Created task "${formData.title}"`,
      }, undefined, undefined, {
        workspaceId: activeWorkspaceId,
        boardId: activeBoardId,
        actorId: user?.id,
      });

      await refreshBoardData();
      setIsModalOpen(false);
      setActiveListId(null);
      toast.success('Card added successfully!', { theme: 'colored' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to add task.';

      toast.error(message, { theme: 'colored' });
    } finally {
      setIsSavingBoard(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;

    const previousBoardData = boardData;
    const itemToDelete = deleteItem;

    // Close modal immediately to prevent double-clicking and provide snappy UI
    setDeleteItem(null);
    setIsSavingBoard(true);

    // Optimistic UI updates
    setBoardData(prev => {
      if (itemToDelete.type === 'list') {
        const nextColumns = prev.columns.filter(id => id !== itemToDelete.listId);
        const nextList = { ...prev.list };
        delete nextList[itemToDelete.listId];

        const listToDel = prev.list[itemToDelete.listId];
        const tasksInList = listToDel?.tasks || [];
        const nextTask = { ...prev.task };
        tasksInList.forEach(taskId => {
          delete nextTask[taskId];
        });

        return {
          ...prev,
          columns: nextColumns,
          list: nextList,
          task: nextTask,
        };
      } else if (itemToDelete.cardId) {
        const nextTask = { ...prev.task };
        delete nextTask[itemToDelete.cardId];

        const nextList = { ...prev.list };
        Object.keys(nextList).forEach(listId => {
          const listObj = nextList[listId];
          if (listObj.tasks.includes(itemToDelete.cardId!)) {
            nextList[listId] = {
              ...listObj,
              tasks: listObj.tasks.filter(id => id !== itemToDelete.cardId),
            };
          }
        });

        return {
          ...prev,
          list: nextList,
          task: nextTask,
        };
      }
      return prev;
    });

    try {
      if (itemToDelete.type === 'list') {
        const listToDel = previousBoardData.list[itemToDelete.listId];
        const tasksInList = listToDel?.tasks || [];
        // create activity logs in parallel to speed up list deletion
        await Promise.all(
          tasksInList.map(async (taskId) => {
            const task = previousBoardData.task[taskId];
            if (task) {
              await createActivity(taskId, 'deleted', {
                description: `Task was deleted because its list "${listToDel.title}" was deleted.`,
              }, undefined, task.title, {
                workspaceId: activeWorkspaceId,
                boardId: activeBoardId,
                actorId: user?.id,
              });
            }
          })
        );
        await deleteTasksByListId(itemToDelete.listId);
        await deleteList(itemToDelete.listId);
      } else if (itemToDelete.cardId) {
        const task = previousBoardData.task[itemToDelete.cardId];
        if (task) {
          await createActivity(itemToDelete.cardId, 'deleted', {
            description: `Task was deleted.`,
          }, undefined, task.title, {
            workspaceId: activeWorkspaceId,
            boardId: activeBoardId,
            actorId: user?.id,
          });
        }
        await deleteTask(itemToDelete.cardId);
      }

      await refreshBoardData();
      toast.success(`${itemToDelete.type === 'list' ? 'List' : 'Card'} deleted successfully!`, { theme: 'colored' });
    } catch (error) {
      // Rollback optimistic update on error
      setBoardData(previousBoardData);
      syncBoardCache(activeBoardId, previousBoardData);

      const message = error instanceof Error ? error.message : `Unable to delete ${itemToDelete.type}.`;
      toast.error(message, { theme: 'colored' });
    } finally {
      setIsSavingBoard(false);
    }
  };

  const handleEditTask = (task: ITaskItem) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  const getTaskListContext = useCallback((taskId: string) => {
    const listId = boardData.columns.find((columnId) => (
      boardData.list[columnId]?.tasks.includes(taskId)
    ));
    const listItem = listId ? boardData.list[listId] : undefined;

    return {
      listId,
      listTitle: listItem?.title,
    };
  }, [boardData]);

  const buildFocusTaskInput = useCallback((task: ITaskItem): FocusTaskInput | null => {
    if (!activeBoardId) {
      toast.error('Board is not ready yet.', { theme: 'colored' });
      return null;
    }

    const listContext = getTaskListContext(task.id);

    return {
      task,
      boardId: activeBoardId,
      boardTitle: activeBoardSummary?.title || 'Untitled board',
      ...listContext,
    };
  }, [activeBoardId, activeBoardSummary?.title, getTaskListContext]);

  const handleToggleFocusTask = useCallback((task: ITaskItem) => {
    const focusTaskInput = buildFocusTaskInput(task);

    if (!focusTaskInput) {
      return;
    }

    const didToggle = toggleFocusTask(focusTaskInput);

    if (!didToggle) {
      toast.info('Focus Dock supports up to 3 active tasks.', { theme: 'colored' });
    }
  }, [buildFocusTaskInput, toggleFocusTask]);

  const handleToggleFocusTaskFromHome = useCallback((taskSummary: HomeTaskSummary) => {
    const liveTask = boardData.task[taskSummary.id];
    const fallbackTask: ITaskItem = liveTask || {
      id: taskSummary.id,
      title: taskSummary.title,
      description: '',
      assignees: taskSummary.assigneeAvatar ? [{ name: 'Assignee', avatar: taskSummary.assigneeAvatar }] : [],
      priority: taskSummary.priority || undefined,
      dueDate: taskSummary.dueDate || undefined,
      labels: [],
      attachments: [],
      checklistItems: [],
      isDone: false,
    };
    const listContext = liveTask ? getTaskListContext(liveTask.id) : {};
    const didToggle = toggleFocusTask({
      task: fallbackTask,
      boardId: taskSummary.boardId,
      boardTitle: taskSummary.boardTitle,
      ...listContext,
    });

    if (!didToggle) {
      toast.info('Focus Dock supports up to 3 active tasks.', { theme: 'colored' });
    }
  }, [boardData.task, getTaskListContext, toggleFocusTask]);

  const handleOpenBoardFromHome = async (boardId: string) => {
    setIsBoardLoading(true);
    await refreshBoardData({ boardId, showErrorToast: true });
    setActiveViewWithPath('board');
  };

  const handleOpenTaskFromHome = async (taskId: string, boardId: string) => {
    setIsBoardLoading(true);

    try {
      const boardSnapshot = await fetchBoardSnapshot(boardId, activeWorkspaceId, user?.id);
      activeBoardIdRef.current = boardSnapshot.boardId;
      setActiveBoardId(boardSnapshot.boardId);
      setBoardData(boardSnapshot.boardData);
      syncBoardCache(boardSnapshot.boardId, boardSnapshot.boardData);

      const task = boardSnapshot.boardData.task[taskId];
      if (task) {
        setEditingTask(task);
        setIsEditModalOpen(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open task.';
      toast.error(message, { theme: 'colored' });
    } finally {
      setIsBoardLoading(false);
    }
  };

  const onSubmitEditTask = async (formData: TaskDialogFormData) => {
    if (!editingTask || !activeBoardId) return;

    setIsSavingBoard(true);

    try {
      await updateTask(editingTask.id, buildTaskUpdatePayload({
        title: formData.title,
        description: formData.description || '',
        priority: formData.priority,
        startDate: formData.startDate,
        dueDate: formData.dueDate,
        assignees: formData.assignees,
        attachments: formData.attachments,
        image: formData.image,
      }));
      await Promise.all([
        replaceTaskChecklistItems(editingTask.id, formData.checklistItems, activeWorkspaceId),
        replaceTaskLabels(editingTask.id, activeBoardId, formData.labels, activeWorkspaceId),
      ]);

      const changes: string[] = [];
      if (formData.title !== editingTask.title) {
        changes.push(`changed title to "${formData.title}"`);
      }
      if ((formData.description || '') !== (editingTask.description || '')) {
        changes.push(`updated description`);
      }
      if (formData.priority !== editingTask.priority) {
        changes.push(`changed priority from "${editingTask.priority || 'None'}" to "${formData.priority || 'None'}"`);
      }
      if (formData.startDate !== editingTask.startDate) {
        changes.push(`changed start date to ${formData.startDate || 'none'}`);
      }
      if (formData.dueDate !== editingTask.dueDate) {
        changes.push(`changed due date to ${formData.dueDate || 'none'}`);
      }
      if ((formData.image || '') !== (editingTask.image || '')) {
        changes.push(`updated cover image`);
      }

      const prevAssignees = editingTask.assignees?.map(a => a.name).join(', ') || '';
      const nextAssignees = formData.assignees?.map(a => a.name).join(', ') || '';
      if (prevAssignees !== nextAssignees) {
        changes.push(`updated assignees to [${formData.assignees?.map(a => a.name).join(', ') || 'none'}]`);
      }
      if (JSON.stringify(formData.labels) !== JSON.stringify(editingTask.labels || [])) {
        changes.push(`updated labels`);
      }
      if (JSON.stringify(formData.attachments) !== JSON.stringify(editingTask.attachments || [])) {
        changes.push(`updated attachments`);
      }
      if (JSON.stringify(formData.checklistItems) !== JSON.stringify(editingTask.checklistItems || [])) {
        changes.push(`updated checklist`);
      }

      const description = changes.length > 0
        ? `Updated task: ${changes.join(', ')}`
        : 'Saved task details';

      await createActivity(editingTask.id, 'update', {
        description,
      }, undefined, undefined, {
        workspaceId: activeWorkspaceId,
        boardId: activeBoardId,
        actorId: user?.id,
      });

      await refreshBoardData();
      setIsEditModalOpen(false);
      setEditingTask(null);
      toast.success('Task updated successfully!', { theme: 'colored' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update task.';

      toast.error(message, { theme: 'colored' });
    } finally {
      setIsSavingBoard(false);
    }
  };

  const toggleMenu = (listId: string | null) => {
    setOpenMenuId(openMenuId === listId ? null : listId);
  };

  const handleBoardDataChange = async (
    nextBoardData: BoardData,
    changeType: 'list' | 'task',
    activity?: BoardChangeActivity,
  ) => {
    const previousBoardData = boardData;

    setBoardData(nextBoardData);
    syncBoardCache(activeBoardId, nextBoardData);

    try {
      if (changeType === 'list') {
        const listPositions = buildChangedListPositionPayload(previousBoardData, nextBoardData);

        if (listPositions.length > 0) {
          await updateListPositions(listPositions);
        }
      } else {
        const taskPositions = buildChangedTaskPositionPayload(previousBoardData, nextBoardData);

        if (taskPositions.length > 0) {
          await updateTaskPositions(taskPositions);

          if (activity) {
            try {
              await createActivity(activity.taskId, 'move', {
                description: activity.description,
              }, undefined, undefined, {
                workspaceId: activeWorkspaceId,
                boardId: activeBoardId,
                actorId: user?.id,
              });
            } catch (activityError) {
              console.error('Failed to create move activity:', activityError);
            }
          }
        }
      }
    } catch (error) {
      setBoardData(previousBoardData);
      syncBoardCache(activeBoardId, previousBoardData);

      const message = error instanceof Error ? error.message : 'Unable to save drag and drop changes.';
      toast.error(message, { theme: 'colored' });
    }
  };
  
  const handleUpdateTask = async (taskId: string, fields: Partial<ITaskItem>) => {
    const previousBoardData = boardData;

    // Instant local UI feedback (optimistic update)
    setBoardData(prev => {
      const task = prev.task[taskId];
      if (!task) return prev;
      return {
        ...prev,
        task: {
          ...prev.task,
          [taskId]: {
            ...task,
            ...fields,
          },
        },
      };
    });

    try {
      const payload = buildTaskFieldUpdatePayload(fields);

      await updateTask(taskId, payload);

      const originalTask = previousBoardData.task[taskId];
      if (originalTask) {
        if ('priority' in fields && fields.priority !== originalTask.priority) {
          await createActivity(taskId, 'priority_change', {
            description: `Changed priority from "${originalTask.priority || 'None'}" to "${fields.priority || 'None'}"`,
            field: 'priority',
            oldValue: originalTask.priority,
            newValue: fields.priority
          }, undefined, undefined, {
            workspaceId: activeWorkspaceId,
            boardId: activeBoardId,
            actorId: user?.id,
          });
        }
        if ('assignees' in fields) {
          const prevNames = originalTask.assignees?.map(a => a.name).join(', ') || 'none';
          const nextNames = fields.assignees?.map(a => a.name).join(', ') || 'none';
          if (prevNames !== nextNames) {
            await createActivity(taskId, 'assignee_change', {
              description: `Updated assignees to [${nextNames}]`,
              field: 'assignees',
              oldValue: originalTask.assignees,
              newValue: fields.assignees
            }, undefined, undefined, {
              workspaceId: activeWorkspaceId,
              boardId: activeBoardId,
              actorId: user?.id,
            });
          }
        }
        if ('isDone' in fields && fields.isDone !== originalTask.isDone) {
          await createActivity(taskId, 'status_change', {
            description: fields.isDone ? 'Marked task as completed' : 'Marked task as incompleted',
            field: 'isDone',
            oldValue: originalTask.isDone,
            newValue: fields.isDone
          }, undefined, undefined, {
            workspaceId: activeWorkspaceId,
            boardId: activeBoardId,
            actorId: user?.id,
          });
        }
      }
    } catch (error) {
      setBoardData(previousBoardData);
      syncBoardCache(activeBoardId, previousBoardData);
      const message = error instanceof Error ? error.message : 'Unable to update task.';
      toast.error(message, { theme: 'colored' });
    }
  };

  const handleOpenFocusTask = async (focusTask: FocusTask) => {
    setIsBoardLoading(true);

    try {
      const boardSnapshot = await fetchBoardSnapshot(focusTask.boardId, activeWorkspaceId, user?.id);
      activeBoardIdRef.current = boardSnapshot.boardId;
      setActiveBoardId(boardSnapshot.boardId);
      setBoardData(boardSnapshot.boardData);
      syncBoardCache(boardSnapshot.boardId, boardSnapshot.boardData);
      setActiveViewWithPath('board');

      const task = boardSnapshot.boardData.task[focusTask.id];
      if (task) {
        setEditingTask(task);
        setIsEditModalOpen(true);
      } else {
        removeFocusTask(focusTask.id);
        toast.info('This focus task is no longer available.', { theme: 'colored' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open focus task.';
      toast.error(message, { theme: 'colored' });
    } finally {
      setIsBoardLoading(false);
    }
  };

  const handleMarkFocusTaskDone = async (focusTask: FocusTask) => {
    try {
      await updateTask(focusTask.id, buildTaskFieldUpdatePayload({ isDone: true }));
      updateFocusedTask(focusTask.id, { isDone: true });

      if (boardData.task[focusTask.id]) {
        setBoardData((currentBoardData) => ({
          ...currentBoardData,
          task: {
            ...currentBoardData.task,
            [focusTask.id]: {
              ...currentBoardData.task[focusTask.id],
              isDone: true,
            },
          },
        }));
      }

      await createActivity(focusTask.id, 'status_change', {
        description: 'Marked task as completed from Focus Dock',
        field: 'isDone',
        oldValue: focusTask.isDone,
        newValue: true,
      }, undefined, undefined, {
        workspaceId: activeWorkspaceId,
        boardId: focusTask.boardId,
        actorId: user?.id,
      });
      toast.success('Focus task marked done.', { theme: 'colored' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to mark focus task done.';
      toast.error(message, { theme: 'colored' });
    }
  };

  const commandPaletteActions = useMemo<CommandPaletteAction[]>(() => [
    {
      id: 'go-home',
      title: 'Go to Home',
      description: 'Open the personal dashboard.',
      shortcut: 'H',
      keywords: ['dashboard', 'my tasks', 'home'],
      run: () => setActiveViewWithPath('home'),
    },
    {
      id: 'go-board',
      title: 'Go to Board',
      description: 'Open the active Kanban board.',
      shortcut: 'B',
      keywords: ['kanban', 'board', 'columns'],
      run: () => setActiveViewWithPath('board'),
    },
    {
      id: 'go-calendar',
      title: 'Go to Calendar',
      description: 'Open the calendar view for due dates.',
      shortcut: 'C',
      keywords: ['calendar', 'due dates', 'schedule'],
      run: () => setActiveViewWithPath('calendar'),
    },
    {
      id: 'quick-add-task',
      title: 'Quick add task',
      description: 'Create a task in the first list of the active board.',
      shortcut: 'N',
      keywords: ['new task', 'create task', 'card'],
      run: handleQuickAddTask,
    },
    {
      id: 'new-list',
      title: 'Create list',
      description: 'Add a new column to the active board.',
      keywords: ['new list', 'column', 'group'],
      run: () => {
        setActiveViewWithPath('board');
        setIsGroupModalOpen(true);
      },
    },
    {
      id: 'new-board',
      title: 'Create board',
      description: 'Start another board from a template.',
      keywords: ['new board', 'template', 'project'],
      run: () => setIsCreateBoardModalOpen(true),
    },
  ], [handleQuickAddTask, setActiveViewWithPath]);

  useGlobalKeyboardShortcuts({
    enabled: Boolean(user) && activeView !== 'auth' && activeView !== 'onboarding',
    onOpenCommandPalette: () => setIsCommandPaletteOpen(true),
    onQuickAddTask: handleQuickAddTask,
  });

  const sharedDialogs = (
    <>
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        actions={commandPaletteActions}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      <TaskDialog
        isOpen={isModalOpen || isEditModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIsEditModalOpen(false);
          setActiveListId(null);
          setEditingTask(null);
        }}
        taskData={isEditModalOpen ? editingTask : null}
        onSubmitTask={isEditModalOpen ? onSubmitEditTask : onSubmitCard}
        isFocusTask={editingTask ? isFocusTask(editingTask.id) : false}
        onToggleFocusTask={editingTask ? () => handleToggleFocusTask(editingTask) : undefined}
        workspaceMembers={workspaceMembers}
      />

      {deleteItem && (
        <DeleteDialog
          onSubmit={handleDeleteConfirm}
          onClose={() => setDeleteItem(null)}
        >
          Are you sure you want to delete this {deleteItem.type}?
        </DeleteDialog>
      )}

      {isGroupModalOpen && (
        <AddGroupDialog
          onClose={() => setIsGroupModalOpen(false)}
          onSubmitGroup={onSubmitList}
        />
      )}

      {isCreateBoardModalOpen && (
        <CreateBoardDialog
          onClose={() => setIsCreateBoardModalOpen(false)}
          onSubmitBoard={handleCreateBoard}
        />
      )}

      <BoardActivityDialog
        isOpen={isBoardActivityModalOpen}
        onClose={() => setIsBoardActivityModalOpen(false)}
        boardId={activeBoardId}
      />

      {user && (
        <WorkspaceMembersDialog
          isOpen={isWorkspaceMembersDialogOpen}
          workspace={activeWorkspace}
          currentUser={user}
          members={workspaceMembers}
          isLoading={isLoadingMembers}
          errorMessage={memberErrorMessage}
          onClose={() => setIsWorkspaceMembersDialogOpen(false)}
          onAddMember={addMember}
          onRoleChange={changeMemberRole}
          onRemoveMember={removeMember}
        />
      )}

      <FocusDock
        focusTasks={focusTasks}
        activeTaskId={activeFocusTaskId}
        isCollapsed={isFocusDockCollapsed}
        timerState={timerState}
        remainingSeconds={remainingSeconds}
        onCollapseChange={setIsFocusDockCollapsed}
        onActiveTaskChange={(taskId) => {
          setActiveFocusTaskId(taskId);
          setActiveTimerTaskId(taskId);
        }}
        onModeChange={setPomodoroMode}
        onStartTimer={() => startTimer(activeFocusTaskId || focusTasks[0]?.id)}
        onPauseTimer={pauseTimer}
        onResetTimer={resetTimer}
        onOpenTask={handleOpenFocusTask}
        onMarkDone={handleMarkFocusTaskDone}
        onRemoveTask={removeFocusTask}
      />

      <FocusLimitToast message={focusLimitMessage} onDismiss={clearLimitMessage} />

      <ToastContainer />
    </>
  );

  if (isAuthLoading || (authMode === 'supabase' && user && isWorkspaceLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] text-sm font-medium text-slate-500">
        Preparing secure workspace...
      </div>
    );
  }

  if (authMode === 'supabase' && (!user || activeView === 'auth')) {
    return (
      <>
        <AuthPage onAuthenticated={() => setActiveViewWithPath('home')} />
        <ToastContainer />
      </>
    );
  }

  if (authMode === 'supabase' && user && (!activeWorkspaceId || activeView === 'onboarding')) {
    return (
      <>
        <OnboardingPage
          userName={user.name}
          onCompleteSetup={handleCompleteOnboarding}
          onSignOut={signOut}
        />
        <ToastContainer />
      </>
    );
  }

  if (!user) {
    return null;
  }

  if (activeView === 'home') {
    return (
      <ProtectedRoute onRequireAuth={() => setActiveViewWithPath('auth')}>
        <div className="min-h-screen bg-[#F8F9FA]">
          {(isBoardLoading || isSavingBoard) && (
            <div className="border-b border-gray-200 bg-white px-4 py-2 text-sm text-gray-600">
              {isBoardLoading ? 'Preparing board data...' : 'Saving changes...'}
            </div>
          )}

          {workspaceErrorMessage && (
            <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {workspaceErrorMessage}
            </div>
          )}

          <HomeDashboard
            onOpenTask={handleOpenTaskFromHome}
            onOpenBoard={handleOpenBoardFromHome}
            onToggleFocusTask={handleToggleFocusTaskFromHome}
            isFocusTask={isFocusTask}
            currentUser={user}
            activeWorkspace={activeWorkspace}
          />

          {sharedDialogs}
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute onRequireAuth={() => setActiveViewWithPath('auth')}>
      <div className="min-h-screen bg-[#F8F9FA]">
      <nav className="border-b border-slate-200/70 bg-white/82 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl">
        <div className="px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600">
                  Active board
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <select
                    value={activeBoardId || ''}
                    onChange={(event) => {
                      const nextBoardId = event.target.value || null;
                      setIsBoardLoading(true);
                      setActiveViewWithPath('board');
                      void refreshBoardData({ boardId: nextBoardId, showErrorToast: true });
                    }}
                    className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  >
                    {boardSummaries.map((boardSummary) => (
                      <option key={boardSummary.id} value={boardSummary.id}>
                        {boardSummary.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsCreateBoardModalOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-[background,box-shadow,transform] hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:scale-[0.98]"
                  >
                    <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    New board
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {activeBoardSummary?.description || 'Kanban workspace with realtime tasks, lists, and richer task details.'}
                </p>
              </div>
              {isLocalDemoMode && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200 shadow-sm">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                  </span>
                  Local Demo Mode
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                Command · Ctrl K
              </button>
              {workspaces.length > 0 && (
                <select
                  value={activeWorkspaceId || ''}
                  onChange={(event) => {
                    setActiveWorkspaceId(event.target.value || null);
                    setIsBoardLoading(true);
                  }}
                  className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  aria-label="Active workspace"
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => setIsWorkspaceMembersDialogOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition-[background,box-shadow,transform] hover:-translate-y-0.5 hover:bg-white hover:shadow-md focus:outline-none focus:ring-4 focus:ring-sky-100"
              >
                <span className="flex -space-x-2">
                  {workspaceMembers.slice(0, 3).map((member) => (
                    <img
                      key={member.id}
                      src={member.avatarUrl}
                      alt={member.name}
                      className="h-6 w-6 rounded-full border-2 border-white object-cover"
                    />
                  ))}
                </span>
                Members
              </button>
              <button
                type="button"
                onClick={() => setActiveViewWithPath('home')}
                className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-[background,box-shadow,transform] hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:scale-[0.98]"
              >
                Home
              </button>
              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setActiveViewWithPath('board')}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    activeView === 'board'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Board
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewWithPath('calendar')}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    activeView === 'calendar'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Calendar
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsBoardActivityModalOpen(true)}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-[background,box-shadow,transform] hover:-translate-y-0.5 hover:bg-white hover:shadow-md focus:outline-none focus:ring-4 focus:ring-sky-100 active:scale-[0.98]"
              >
                <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Board Activity
              </button>
              {authMode === 'supabase' && (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  Sign out
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {(isBoardLoading || isSavingBoard) && (
        <div className="border-b border-gray-200 bg-white px-4 py-2 text-sm text-gray-600">
          {isBoardLoading ? 'Loading board data from Supabase...' : 'Saving changes...'}
        </div>
      )}

      {boardErrorMessage && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-center justify-between gap-4">
            <span>{boardErrorMessage}</span>
            <button
              type="button"
              onClick={() => {
                setIsBoardLoading(true);
                void refreshBoardData({ showErrorToast: true });
              }}
              className="cursor-pointer rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <QuickSearch
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        filterPriority={filterPriority}
        onFilterPriorityChange={setFilterPriority}
        filterAssignee={filterAssignee}
        onFilterAssigneeChange={setFilterAssignee}
        filterDueDate={filterDueDate}
        onFilterDueDateChange={setFilterDueDate}
        onClearFilters={() => {
          setSearchQuery('');
          setFilterPriority('');
          setFilterAssignee('');
          setFilterDueDate('');
        }}
        workspaceMembers={workspaceMembers}
      />

      {activeView === 'board' && !activeBoardId ? (
        <BoardEmptyState
          workspaceName={activeWorkspace?.name}
          onCreateBoard={() => setIsCreateBoardModalOpen(true)}
        />
      ) : activeView === 'board' ? (
        <KanbanBoard
          boardData={boardData}
          searchQuery={searchQuery}
          filterPriority={filterPriority}
          filterAssignee={filterAssignee}
          filterDueDate={filterDueDate}
          openMenuId={openMenuId}
          toggleMenu={toggleMenu}
          handleEditTask={handleEditTask}
          setDeleteItem={setDeleteItem}
          onBoardDataChange={handleBoardDataChange}
          onUpdateTask={handleUpdateTask}
          onToggleFocusTask={handleToggleFocusTask}
          isFocusTask={isFocusTask}
          workspaceMembers={workspaceMembers}
          onOpenAddTask={(listId) => {
            setActiveListId(listId);
            setIsModalOpen(true);
          }}
          onOpenAddGroup={() => setIsGroupModalOpen(true)}
        />
      ) : (
        <CalendarBoardView
          boardData={boardData}
          searchQuery={searchQuery}
          filterPriority={filterPriority}
          filterAssignee={filterAssignee}
          filterDueDate={filterDueDate}
          onOpenTask={handleEditTask}
        />
      )}

      {sharedDialogs}
    </div>
    </ProtectedRoute>
  );
}

export default App;
