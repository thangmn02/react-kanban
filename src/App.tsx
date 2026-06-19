import { useCallback, useEffect, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { ERROR_MESSAGES } from './constants';
import { useI18n } from './i18n';
import type { BoardDeleteItem } from './types/task.type';
import AddGroupDialog from './components/organisms/dialog/AddGroupDialog';
import CreateBoardDialog from './components/organisms/dialog/CreateBoardDialog';
import DeleteDialog from './components/organisms/dialog/DeleteDialog';
import CalendarBoardView from './components/organisms/CalendarBoardView';
import HomeDashboard from './components/organisms/HomeDashboard';
import KanbanBoard from './components/organisms/KanbanBoard';
import TodayQuickPlanDialog from './features/today/components/TodayQuickPlanDialog';
import ShutdownRitualDialog from './features/today/components/ShutdownRitualDialog';
import TaskDialog from './components/organisms/dialog/TaskDialog';
import { parseTaskLines } from './utils/taskParser';
import AuthPage from './components/auth/AuthPage';
import AcceptInvitePage from './components/invite/AcceptInvitePage';
import TodayPage from './components/today/TodayPage';
import BoardEmptyState from './components/board/BoardEmptyState';
import BoardHeader from './components/board/BoardHeader';
import BoardToolbar from './components/board/BoardToolbar';
import CommandPalette from './components/command/CommandPalette';
import OnboardingPage from './components/onboarding/OnboardingPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppHeader from './components/layout/AppHeader';
import { SkeletonBoardColumn } from './components/atoms/skeleton';
import ErrorState from './components/atoms/ErrorState';
import NotFoundPage from './components/error/NotFoundPage';
import { useAuth } from './hooks/useAuth';
import { useAppDialogState } from './hooks/useAppDialogState';
import { useBoardDataManagement } from './hooks/useBoardDataManagement';
import { useGlobalKeyboardShortcuts } from './hooks/useGlobalKeyboardShortcuts';
import { useViewRouting } from './hooks/useViewRouting';
import { useTaskOperations } from './hooks/useTaskOperations';
import { useWorkspaceSession } from './hooks/useWorkspaceSession';
import { useWorkspaceMembers } from './hooks/useWorkspaceMembers';
import { useDocumentPictureInPicture } from './hooks/useDocumentPictureInPicture';
import { createBoardFromTemplate, fetchBoardSnapshot, fetchBoards } from './services/board.service';
import { findBoardTemplateById } from './data/boardTemplates';
import { createList } from './services/list.service';
import { updateTask, createTasks } from './services/task.service';
import { buildTaskFieldUpdatePayload } from './utils/boardDataMapper';
import { isLocalDemoMode } from './lib/supabase';
import { createActivity } from './services/activity.service';
import {
  fetchDailyFocusStats,
  logFocusSession,
} from './services/focusSession.service';
import BoardActivityDialog from './components/organisms/dialog/BoardActivityDialog';
import FocusDock from './components/focus/FocusDock';
import FocusCompletionPrompt from './components/focus/FocusCompletionPrompt';
import FocusLaunchpadDialog from './components/focus/FocusLaunchpadDialog';
import FocusLimitToast from './components/focus/FocusLimitToast';
import WorkspaceMembersDialog from './components/workspace/WorkspaceMembersDialog';
import ArcanaBoothDialog from './features/arcana/ArcanaBoothDialog';
import ArcanaRewardToast from './features/arcana/ArcanaRewardToast';
import {
  getYesterdayCarryoverSummary,
  writeDailyRitualSnapshot,
  type DailyCarryoverSummary,
} from './features/today/dailyRitual';
import {
  consumeArcanaRewardDraw,
  readArcanaRewardState,
  registerArcanaTaskCompletion,
} from './features/arcana/arcanaReward';
import { useFocusTasks } from './hooks/useFocusTasks';
import { usePomodoroTimer } from './hooks/usePomodoroTimer';
import { useFocusTaskHandlers } from './hooks/useFocusTaskHandlers';
import { useCommandPaletteActions } from './hooks/useCommandPaletteActions';
import type {
  DailyFocusStats,
  FocusSessionStatus,
  FocusTask,
  PomodoroMode,
  PomodoroSessionSnapshot,
} from './types/focus.type';
import type { TodayTaskSummary } from './services/today.service';
import type { OnboardingSetupValues } from './types/onboarding.type';

interface CreateBoardDialogFormData {
  title: string;
  description: string;
  templateId: string;
}

function App() {
  const {
    authMode,
    user,
    isAuthLoading,
    signOut,
  } = useAuth();
  const { t } = useI18n();
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    isWorkspaceLoading,
    workspaceErrorMessage,
    setActiveWorkspaceId,
    reloadWorkspaces,
    createWorkspace,
  } = useWorkspaceSession(user);
  const {
    members: workspaceMembers,
    invites: workspaceInvites,
    isLoadingMembers,
    memberErrorMessage,
    addMember,
    changeMemberRole,
    removeMember,
    cancelInvite,
    reloadMembers,
  } = useWorkspaceMembers(activeWorkspaceId);

  const {
    activeView,
    activeInviteToken,
    activeBoardTab,
    setActiveViewWithPath,
  } = useViewRouting();

  const {
    boardData,
    setBoardData,
    activeBoardId,
    setActiveBoardId,
    activeBoardIdRef,
    boardSummaries,
    setBoardSummaries,
    activeBoardSummary,
    isBoardLoading,
    setIsBoardLoading,
    isSavingBoard,
    setIsSavingBoard,
    boardErrorMessage,
    initialBoardId,
    refreshBoardData,
    refreshBoardList,
    syncBoardCache,
  } = useBoardDataManagement({ authMode, activeWorkspaceId, userId: user?.id });

  const {
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
  } = useAppDialogState();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterDueDate, setFilterDueDate] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<BoardDeleteItem | null>(null);
  const [isFocusDockCollapsed, setIsFocusDockCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isArcanaBoothOpen, setIsArcanaBoothOpen] = useState(false);
  const [arcanaRewardState, setArcanaRewardState] = useState(readArcanaRewardState);
  const [isArcanaRewardPromptOpen, setIsArcanaRewardPromptOpen] = useState(false);
  const [carryoverSummary, setCarryoverSummary] = useState<DailyCarryoverSummary | null>(getYesterdayCarryoverSummary);
  const [isShutdownRitualOpen, setIsShutdownRitualOpen] = useState(false);
  const [isRetryingWorkspace, setIsRetryingWorkspace] = useState(false);
  const [isRetryingBoard, setIsRetryingBoard] = useState(false);
  const [focusLaunchTaskId, setFocusLaunchTaskId] = useState<string | null>(null);
  const [activeFocusIntention, setActiveFocusIntention] = useState<{
    taskId: string | null;
    text: string;
  } | null>(null);
  const [focusCompletion, setFocusCompletion] = useState<{
    task: FocusTask;
    session: PomodoroSessionSnapshot;
    intention: string;
  } | null>(null);
  const [dailyFocusStats, setDailyFocusStats] = useState<DailyFocusStats>({
    focusedMinutes: 0,
    completedSessions: 0,
    interruptedSessions: 0,
    topTaskTitle: null,
  });

  const handleRetryWorkspace = useCallback(() => {
    setIsRetryingWorkspace(true);
    void reloadWorkspaces().finally(() => {
      setIsRetryingWorkspace(false);
    });
  }, [reloadWorkspaces]);

  const handleRetryBoard = useCallback(() => {
    setIsRetryingBoard(true);
    setIsBoardLoading(true);
    void refreshBoardData({ showErrorToast: true }).finally(() => {
      setIsRetryingBoard(false);
    });
  }, [refreshBoardData, setIsBoardLoading]);

  useEffect(() => {
    if (isAuthLoading || isWorkspaceLoading) {
      return;
    }

    // Unknown route: show the 404 surface regardless of auth state and skip
    // the auth/workspace redirects below.
    if (activeView === 'not-found') {
      setIsBoardLoading(false);
      return;
    }

    if (authMode === 'mock' && (activeView === 'auth' || activeView === 'onboarding' || activeView === 'invite')) {
      setActiveViewWithPath('home');
      return;
    }

    if (authMode === 'supabase' && !user && activeView !== 'invite') {
      setActiveViewWithPath('auth');
      return;
    }

    if (authMode === 'supabase' && user && !activeWorkspaceId && activeView !== 'invite') {
      setActiveViewWithPath('onboarding');
      setIsBoardLoading(false);
      return;
    }

    if (
      authMode === 'supabase'
      && user
      && activeWorkspaceId
      && (activeView === 'auth' || activeView === 'onboarding')
    ) {
      setActiveViewWithPath('home');
      return;
    }

    if (activeView === 'invite') {
      setIsBoardLoading(false);
      return;
    }

    void (async () => {
      await refreshBoardData({ boardId: initialBoardId });
      await refreshBoardList();
    })();
  }, [
    activeView,
    activeWorkspaceId,
    authMode,
    initialBoardId,
    isAuthLoading,
    isWorkspaceLoading,
    refreshBoardData,
    refreshBoardList,
    setActiveViewWithPath,
    setIsBoardLoading,
    user,
  ]);

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
    pinFocusTask,
    carryOverFocusTasks,
  } = useFocusTasks(boardData);

  const refreshDailyFocusStats = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const nextStats = await fetchDailyFocusStats(activeWorkspaceId, user.id);
      setDailyFocusStats(nextStats);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Unable to load daily focus stats:', error);
      }
    }
  }, [activeWorkspaceId, user]);

  useEffect(() => {
    void refreshDailyFocusStats();
  }, [refreshDailyFocusStats]);

  const logPomodoroSession = useCallback(async (
    task: FocusTask | null,
    mode: PomodoroMode,
    status: FocusSessionStatus,
    session: PomodoroSessionSnapshot,
  ) => {
    if (!user || !activeWorkspaceId) {
      return;
    }

    await logFocusSession({
      workspaceId: activeWorkspaceId,
      boardId: task?.boardId || activeBoardIdRef.current,
      taskId: task?.id || null,
      userId: user.id,
      mode,
      status,
      startedAt: new Date(session.startedAt).toISOString(),
      endedAt: new Date(session.endedAt).toISOString(),
      durationSeconds: session.durationSeconds,
      plannedSeconds: session.plannedSeconds,
    });
    await refreshDailyFocusStats();
  }, [activeWorkspaceId, refreshDailyFocusStats, user, activeBoardIdRef]);

  const handlePomodoroComplete = useCallback((task: FocusTask | null, mode: PomodoroMode, session: PomodoroSessionSnapshot) => {
    const modeLabel = mode === 'focus'
      ? t('focus.mode.focus')
      : mode === 'shortBreak'
        ? t('focus.mode.shortBreak')
        : t('focus.mode.longBreak');
    toast.success(t('toast.focusCompleted', {
      mode: modeLabel,
      task: task ? `: ${task.title}` : '',
    }), { theme: 'colored' });

    void logPomodoroSession(task, mode, 'completed', session)
      .then(() => {
        if (mode === 'focus') {
          toast.success(t('toast.focusSessionLogged'), { theme: 'colored' });
        }
      })
      .catch((error) => {
        console.warn('Unable to log focus session:', error);
      });

    if (task && mode === 'focus') {
      const intention = activeFocusIntention?.taskId === task.id ? activeFocusIntention.text : '';
      setFocusCompletion({ task, session, intention });
      setActiveFocusIntention(null);

      void createActivity(task.id, 'update', {
        description: `Completed a ${Math.round(session.durationSeconds / 60)}m focus session`,
        field: 'focusSession',
      }, undefined, undefined, {
        workspaceId: activeWorkspaceId,
        boardId: task.boardId,
        actorId: user?.id,
      }).catch((error) => {
        console.warn('Unable to log focus session activity:', error);
      });
    }
  }, [activeFocusIntention, activeWorkspaceId, logPomodoroSession, t, user?.id]);

  const handlePomodoroInterrupt = useCallback((task: FocusTask | null, mode: PomodoroMode, session: PomodoroSessionSnapshot) => {
    void logPomodoroSession(task, mode, 'interrupted', session)
      .then(() => {
        toast.info(t('toast.focusSessionInterrupted'), { theme: 'colored' });
      })
      .catch((error) => {
        console.warn('Unable to log interrupted focus session:', error);
      });
  }, [logPomodoroSession, t]);

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
    onInterrupt: handlePomodoroInterrupt,
  });

  const startFocusSessionNow = useCallback((taskId?: string, intention = '') => {
    const nextTaskId = taskId || activeFocusTaskId || focusTasks[0]?.id || timerState.activeTaskId || null;

    if (!nextTaskId) {
      toast.info(t('toast.chooseFocusTaskBeforeTimer'), { theme: 'colored' });
      return false;
    }

    setActiveFocusTaskId(nextTaskId);
    setActiveTimerTaskId(nextTaskId);
    setIsFocusDockCollapsed(false);

    if (!timerState.startedAt) {
      setActiveFocusIntention({
        taskId: nextTaskId,
        text: intention,
      });
    }

    startTimer(nextTaskId);
    return true;
  }, [activeFocusTaskId, focusTasks, setActiveFocusTaskId, setActiveTimerTaskId, startTimer, t, timerState.activeTaskId, timerState.startedAt]);

  const handleStartFocusTimer = useCallback((taskId?: string) => {
    const nextTaskId = taskId || activeFocusTaskId || focusTasks[0]?.id || timerState.activeTaskId || null;

    if (!nextTaskId) {
      toast.info(t('toast.chooseFocusTaskBeforeTimer'), { theme: 'colored' });
      return;
    }

    if (timerState.startedAt || timerState.isRunning) {
      startFocusSessionNow(nextTaskId);
      return;
    }

    setFocusLaunchTaskId(nextTaskId);
  }, [activeFocusTaskId, focusTasks, startFocusSessionNow, t, timerState.activeTaskId, timerState.isRunning, timerState.startedAt]);



  const focusLaunchTask = focusLaunchTaskId
    ? focusTasks.find((focusTask) => focusTask.id === focusLaunchTaskId) || null
    : null;

  const closeFocusLaunchpad = useCallback(() => {
    setFocusLaunchTaskId(null);
  }, []);

  const handleConfirmFocusLaunch = useCallback((intention: string) => {
    if (!focusLaunchTask) {
      closeFocusLaunchpad();
      return;
    }

    const didStart = startFocusSessionNow(focusLaunchTask.id, intention);

    if (didStart) {
      setFocusLaunchTaskId(null);
      toast.success(t('toast.focusStarted', { task: focusLaunchTask.title }), { theme: 'colored' });
    }
  }, [closeFocusLaunchpad, focusLaunchTask, startFocusSessionNow, t]);

  const onSubmitList = async (formData: { title: string }) => {
    if (!activeBoardId) {
      toast.error(t('toast.boardNotReady'), { theme: 'colored' });
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
      closeGroupDialog();
      toast.success(t('toast.listAdded'), { theme: 'colored' });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.unableAddList');

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
      closeCreateBoardDialog();
      setActiveViewWithPath('board');
      toast.success(t('toast.boardCreated'), { theme: 'colored' });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.unableCreateBoard');
      toast.error(message, { theme: 'colored' });
    } finally {
      setIsSavingBoard(false);
    }
  };

  const handleQuickAddTask = useCallback(() => {
    const firstListId = boardData.columns[0];

    if (!activeBoardId || !firstListId) {
      toast.info(t('toast.createBoardBeforeTask'), { theme: 'colored' });
      return;
    }

    openCreateTaskDialog(firstListId);
  }, [activeBoardId, boardData.columns, openCreateTaskDialog, t]);

  const handleOpenQuickPlan = useCallback(() => {
    const firstListId = boardData.columns[0];

    if (!activeBoardId || !firstListId) {
      toast.info(t('toast.createBoardBeforeQuickPlan'), { theme: 'colored' });
      return;
    }

    openQuickPlanDialog(firstListId);
    setCarryoverSummary(getYesterdayCarryoverSummary());
  }, [activeBoardId, boardData.columns, openQuickPlanDialog, t]);

  const handlePasteTasks = useCallback(async (text: string) => {
    if (activeView !== 'board' && activeView !== 'home' && activeView !== 'today') return;
    
    const firstListId = boardData.columns[0];
    if (!activeBoardId || !activeWorkspaceId || !firstListId || !user) {
      return;
    }

    const taskTitles = parseTaskLines(text);
    if (!taskTitles.length) return;

    setIsSavingBoard(true);
    try {
      const listTasks = boardData.list[firstListId]?.tasks || [];
      const positionOffset = listTasks.length * 65536;

      const tasksToCreate = taskTitles.map((title, index) => ({
        title,
        board_id: activeBoardId,
        list_id: firstListId,
        workspace_id: activeWorkspaceId,
        created_by: user.id,
        assignees: [user.id],
        position: positionOffset + ((index + 1) * 65536),
      }));

      await createTasks(tasksToCreate);
      await refreshBoardData({ boardId: activeBoardId });
      toast.success(t('toast.createdTasksFromPaste', { count: tasksToCreate.length }), { theme: 'colored' });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.failedCreatePastedTasks');
      toast.error(message, { theme: 'colored' });
    } finally {
      setIsSavingBoard(false);
    }
  }, [activeView, boardData, activeBoardId, activeWorkspaceId, user, refreshBoardData, setIsSavingBoard, t]);

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement) {
        const tagName = activeElement.tagName.toUpperCase();
        if (tagName === 'INPUT' || tagName === 'TEXTAREA') return;
        if (activeElement.getAttribute('contenteditable') === 'true') return;
      }

      const text = e.clipboardData?.getData('text');
      if (!text) return;

      void handlePasteTasks(text);
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [handlePasteTasks]);

  const handleCompleteOnboarding = async (setupValues: OnboardingSetupValues) => {
    if (!user) {
      throw new Error('Please sign in again.');
    }

    const selectedTemplate = findBoardTemplateById(setupValues.templateId);

    if (!selectedTemplate) {
      throw new Error(ERROR_MESSAGES.INVALID_TEMPLATE);
    }

    const createdWorkspace = await createWorkspace(setupValues.workspaceName);
    const createdBoard = await createBoardFromTemplate({
      title: setupValues.boardTitle,
      description: setupValues.boardDescription,
      templateId: selectedTemplate.id,
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
    toast.success(t('toast.workspaceCreated'), { theme: 'colored' });
  };

  const handleEditTask = openEditTaskDialog;

  const handleArcanaTaskCompleted = useCallback(() => {
    const rewardResult = registerArcanaTaskCompletion();
    setArcanaRewardState(rewardResult.state);

    if (rewardResult.shouldPrompt) {
      setIsArcanaRewardPromptOpen(true);
    }
  }, []);

  const handleOpenArcanaBooth = useCallback((consumeRewardDraw = false) => {
    if (consumeRewardDraw) {
      setArcanaRewardState(consumeArcanaRewardDraw());
    } else {
      setArcanaRewardState(readArcanaRewardState());
    }

    setIsArcanaRewardPromptOpen(false);
    setIsArcanaBoothOpen(true);
  }, []);

  const {
    handleToggleFocusTask,
    handleStartFocusTask,
    handleToggleFocusTaskFromHome,
    handleStartFocusTaskFromHome,
    handleToggleFocusTaskFromToday,
    handleStartFocusTaskFromToday,
  } = useFocusTaskHandlers({
    boardData,
    activeBoardId,
    activeBoardSummary,
    focusTasksApi: {
      toggleFocusTask,
      pinFocusTask,
      isFocusTask,
      setActiveFocusTaskId,
    },
    pomodoro: {
      startFocusTimer: handleStartFocusTimer,
      setActiveTimerTaskId,
    },
    setIsFocusDockCollapsed,
  });

  const handleOpenBoardFromHome = async (boardId: string) => {
    setIsBoardLoading(true);
    await refreshBoardData({ boardId, showErrorToast: true });
    setActiveViewWithPath('board');
  };

  const handleOpenTaskFromHome = useCallback(async (taskId: string, boardId: string) => {
    setIsBoardLoading(true);

    try {
      const boardSnapshot = await fetchBoardSnapshot(boardId, activeWorkspaceId, user?.id);
      activeBoardIdRef.current = boardSnapshot.boardId;
      setActiveBoardId(boardSnapshot.boardId);
      setBoardData(boardSnapshot.boardData);
      syncBoardCache(boardSnapshot.boardId, boardSnapshot.boardData);

      const task = boardSnapshot.boardData.task[taskId];
      if (task) {
        openEditTaskDialog(task);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.unableOpenTask');
      toast.error(message, { theme: 'colored' });
    } finally {
      setIsBoardLoading(false);
    }
  }, [activeWorkspaceId, syncBoardCache, user?.id, activeBoardIdRef, setActiveBoardId, setBoardData, setIsBoardLoading, openEditTaskDialog, t]);

  const handleOpenTaskFromToday = useCallback((taskSummary: TodayTaskSummary) => {
    void handleOpenTaskFromHome(taskSummary.id, taskSummary.boardId);
  }, [handleOpenTaskFromHome]);

  const toggleMenu = (listId: string | null) => {
    setOpenMenuId(openMenuId === listId ? null : listId);
  };

  const {
    onSubmitCard,
    onSubmitEditTask,
    handleDeleteConfirm,
    handleUpdateTask,
    handleBoardPositionChange,
  } = useTaskOperations({
    boardData,
    setBoardData,
    activeBoardId,
    activeWorkspaceId,
    syncBoardCache,
    setIsSavingBoard,
    userId: user?.id,
    deleteItem,
    setDeleteItem,
    editingTask: dialogState.taskDialog.editingTask,
    activeListId: dialogState.taskDialog.activeListId,
    closeTaskDialog,
    refreshBoardData,
    onTaskCompleted: handleArcanaTaskCompleted,
  });

  const handleOpenFocusTask = useCallback(async (focusTask: FocusTask) => {
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
        openEditTaskDialog(task);
      } else {
        removeFocusTask(focusTask.id);
        toast.info(t('toast.focusTaskUnavailable'), { theme: 'colored' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.unableOpenFocusTask');
      toast.error(message, { theme: 'colored' });
    } finally {
      setIsBoardLoading(false);
    }
  }, [activeWorkspaceId, removeFocusTask, setActiveViewWithPath, syncBoardCache, user?.id, activeBoardIdRef, setActiveBoardId, setBoardData, setIsBoardLoading, openEditTaskDialog, t]);

  const handleMarkFocusTaskDone = useCallback(async (focusTask: FocusTask) => {
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
      if (!focusTask.isDone) {
        handleArcanaTaskCompleted();
      }
      toast.success(t('toast.focusTaskMarkedDone'), { theme: 'colored' });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.unableMarkFocusTaskDone');
      toast.error(message, { theme: 'colored' });
    }
  }, [activeWorkspaceId, boardData.task, handleArcanaTaskCompleted, setBoardData, t, updateFocusedTask, user?.id]);

  const handleCloseFocusCompletion = useCallback(() => {
    setFocusCompletion(null);
  }, []);

  const handleKeepWorkingFromCompletion = useCallback(() => {
    const taskId = focusCompletion?.task.id;
    setFocusCompletion(null);

    if (taskId) {
      setFocusLaunchTaskId(taskId);
    }
  }, [focusCompletion?.task.id]);

  const handleMarkDoneFromCompletion = useCallback(() => {
    const task = focusCompletion?.task;
    setFocusCompletion(null);

    if (task) {
      void handleMarkFocusTaskDone(task);
    }
  }, [focusCompletion?.task, handleMarkFocusTaskDone]);

  const handleActiveTaskChange = useCallback((taskId: string) => {
    setActiveFocusTaskId(taskId);
    setActiveTimerTaskId(taskId);
  }, [setActiveFocusTaskId, setActiveTimerTaskId]);

  const handleMarkDoneAndNext = useCallback((taskId: string) => {
    const task = focusTasks.find((t) => t.id === taskId);
    if (task) {
      void handleMarkFocusTaskDone(task);
    }

    const currentIndex = focusTasks.findIndex((t) => t.id === taskId);
    const nextTask = focusTasks.find((t, idx) => idx > currentIndex && !t.isDone) 
      || focusTasks.find((t, idx) => idx < currentIndex && !t.isDone);
    
    if (nextTask) {
      setActiveFocusTaskId(nextTask.id);
      setActiveTimerTaskId(nextTask.id);
    } else {
      pauseTimer();
    }
  }, [focusTasks, handleMarkFocusTaskDone, setActiveFocusTaskId, setActiveTimerTaskId, pauseTimer]);

  const {
    isPictureInPictureSupported,
    isPictureInPictureOpen,
    openPictureInPicture,
  } = useDocumentPictureInPicture({
    activeTask: activeFocusTask,
    focusTasks,
    timerState,
    remainingSeconds,
    onStart: () => startFocusSessionNow(),
    onPause: pauseTimer,
    onReset: resetTimer,
    onActiveTaskChange: handleActiveTaskChange,
    onMarkDoneAndNext: handleMarkDoneAndNext,
  });

  const handleOpenFloatingFocusTimer = useCallback(() => {
    if (!isPictureInPictureSupported) {
      toast.info(t('toast.floatingTimerUnsupported'), { theme: 'colored' });
      return;
    }

    void openPictureInPicture().catch((error) => {
      const message = error instanceof Error ? error.message : t('toast.unableOpenFloatingTimer');
      toast.error(message, { theme: 'colored' });
    });
  }, [isPictureInPictureSupported, openPictureInPicture, t]);

  const handleCarryYesterday = useCallback((taskIds: string[]) => {
    const carriedCount = carryOverFocusTasks(taskIds);
    setCarryoverSummary(null);

    if (carriedCount > 0) {
      toast.success(t('dailyRitual.carriedToast', {
        count: carriedCount,
        plural: carriedCount === 1 ? '' : 's',
      }), { theme: 'colored' });
    } else {
      toast.info(t('dailyRitual.carryUnavailableToast'), { theme: 'colored' });
    }
  }, [carryOverFocusTasks, t]);

  const handleFinishDailyRitual = useCallback(() => {
    const firstRunnableTask = focusTasks.find((task) => !task.isDone) || null;

    writeDailyRitualSnapshot(
      focusTasks,
      dailyFocusStats.completedSessions,
      dailyFocusStats.focusedMinutes,
    );
    setCarryoverSummary(null);
    closeQuickPlanDialog();

    if (!firstRunnableTask) {
      toast.info(t('dailyRitual.chooseBeforeStartToast'), { theme: 'colored' });
      return;
    }

    const didStart = startFocusSessionNow(firstRunnableTask.id, t('dailyRitual.title'));
    if (!didStart) return;

    toast.success(t('dailyRitual.startedToast', { task: firstRunnableTask.title }), { theme: 'colored' });

    if (isPictureInPictureSupported) {
      handleOpenFloatingFocusTimer();
    }
  }, [
    closeQuickPlanDialog,
    dailyFocusStats.completedSessions,
    dailyFocusStats.focusedMinutes,
    focusTasks,
    handleOpenFloatingFocusTimer,
    isPictureInPictureSupported,
    startFocusSessionNow,
    t,
  ]);

  const handleCompleteShutdownRitual = useCallback(() => {
    writeDailyRitualSnapshot(
      focusTasks,
      dailyFocusStats.completedSessions,
      dailyFocusStats.focusedMinutes,
    );
    setCarryoverSummary(null);
    setIsShutdownRitualOpen(false);
    toast.success(t('shutdown.completeToast'), { theme: 'colored' });
  }, [dailyFocusStats.completedSessions, dailyFocusStats.focusedMinutes, focusTasks, t]);

  const clearBoardFilters = useCallback(() => {
    setSearchQuery('');
    setFilterPriority('');
    setFilterAssignee('');
    setFilterDueDate('');
  }, []);

  const focusBoardSearch = useCallback(() => {
    window.setTimeout(() => {
      document.getElementById('board-search-input')?.focus();
    }, 0);
  }, []);

  const filterHighPriority = useCallback(() => {
    setSearchQuery('');
    setFilterPriority('High');
    setFilterAssignee('');
    setFilterDueDate('');
  }, []);

  const filterDueToday = useCallback(() => {
    setSearchQuery('');
    setFilterPriority('');
    setFilterAssignee('');
    setFilterDueDate('today');
  }, []);

  const commandPaletteActions = useCommandPaletteActions({
    setActiveViewWithPath,
    handleQuickAddTask,
    openGroupDialog,
    openCreateBoardDialog,
    focusBoardSearch,
    clearBoardFilters,
    filterHighPriority,
    filterDueToday,
    openActivityDialog,
    handleStartFocusTimer,
    pauseTimer,
    resetTimer,
    handleOpenFloatingFocusTimer,
    handleOpenFocusTask,
    activeFocusTask,
    isPictureInPictureSupported,
  });

  useGlobalKeyboardShortcuts({
    enabled: Boolean(user) && activeView !== 'auth' && activeView !== 'onboarding',
    onOpenCommandPalette: () => setIsCommandPaletteOpen(true),
    onQuickAddTask: handleQuickAddTask,
    onFocusSearch: focusBoardSearch,
  });

  const appHeader = user ? (
    <AppHeader
      authMode={authMode}
      user={user}
      workspaces={workspaces}
      activeWorkspace={activeWorkspace}
      activeWorkspaceId={activeWorkspaceId}
      isLocalDemoMode={isLocalDemoMode}
      onGoHome={() => setActiveViewWithPath('home')}
      onGoToday={() => setActiveViewWithPath('today')}
      onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      onCreateBoard={openCreateBoardDialog}
      onWorkspaceChange={(workspaceId) => {
        setActiveWorkspaceId(workspaceId);
        setIsBoardLoading(true);
      }}
      onSignOut={() => void signOut()}
      onOpenArcanaBooth={() => handleOpenArcanaBooth()}
      arcanaAvailableDraws={arcanaRewardState.availableDraws}
    />
  ) : null;

  const sharedDialogs = (
    <>
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        actions={commandPaletteActions}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      <ArcanaBoothDialog
        isOpen={isArcanaBoothOpen}
        onClose={() => setIsArcanaBoothOpen(false)}
      />

      <ArcanaRewardToast
        isOpen={isArcanaRewardPromptOpen}
        availableDraws={arcanaRewardState.availableDraws}
        onDrawNow={() => handleOpenArcanaBooth(true)}
        onLater={() => setIsArcanaRewardPromptOpen(false)}
      />

      <FocusLaunchpadDialog
        isOpen={Boolean(focusLaunchTask)}
        task={focusLaunchTask}
        mode={timerState.mode}
        suggestedSeconds={timerState.remainingSeconds}
        onClose={closeFocusLaunchpad}
        onStart={handleConfirmFocusLaunch}
      />

      <FocusCompletionPrompt
        task={focusCompletion?.task || null}
        session={focusCompletion?.session || null}
        intention={focusCompletion?.intention || ''}
        onMarkDone={handleMarkDoneFromCompletion}
        onKeepWorking={handleKeepWorkingFromCompletion}
        onClose={handleCloseFocusCompletion}
      />

      <TaskDialog
        isOpen={dialogState.taskDialog.isOpen}
        onClose={closeTaskDialog}
        taskData={dialogState.taskDialog.mode === 'edit' ? dialogState.taskDialog.editingTask : null}
        onSubmitTask={dialogState.taskDialog.mode === 'edit' ? onSubmitEditTask : onSubmitCard}
        isFocusTask={dialogState.taskDialog.editingTask ? isFocusTask(dialogState.taskDialog.editingTask.id) : false}
        onToggleFocusTask={dialogState.taskDialog.editingTask ? () => handleToggleFocusTask(dialogState.taskDialog.editingTask!) : undefined}
        workspaceMembers={workspaceMembers}
        workspaceId={activeWorkspaceId}
      />

      {dialogState.quickPlanDialog.isOpen && user && (
        <TodayQuickPlanDialog
          isOpen={dialogState.quickPlanDialog.isOpen}
          onClose={closeQuickPlanDialog}
          currentUser={user}
          activeWorkspace={activeWorkspace}
          focusTasks={focusTasks}
          carryoverSummary={carryoverSummary}
          onCarryYesterday={handleCarryYesterday}
          onDismissCarryover={() => setCarryoverSummary(null)}
          onToggleTodayFocus={handleToggleFocusTaskFromToday}
          onOpenTask={handleOpenTaskFromToday}
          onStartFocus={handleStartFocusTaskFromToday}
          onQuickCreateTask={handleQuickAddTask}
          onFinishRitual={handleFinishDailyRitual}
        />
      )}

      {deleteItem && (
        <DeleteDialog
          onSubmit={handleDeleteConfirm}
          onClose={() => setDeleteItem(null)}
        >
          Are you sure you want to delete this {deleteItem.type}?
        </DeleteDialog>
      )}

      {dialogState.groupDialog.isOpen && (
        <AddGroupDialog
          onClose={closeGroupDialog}
          onSubmitGroup={onSubmitList}
        />
      )}

      {dialogState.boardDialog.isOpen && (
        <CreateBoardDialog
          onClose={closeCreateBoardDialog}
          onSubmitBoard={handleCreateBoard}
        />
      )}

      <BoardActivityDialog
        isOpen={dialogState.activityDialog.isOpen}
        onClose={closeActivityDialog}
        boardId={activeBoardId}
      />

      {user && (
        <WorkspaceMembersDialog
          isOpen={dialogState.membersDialog.isOpen}
          workspace={activeWorkspace}
          currentUser={user}
          members={workspaceMembers}
          invites={workspaceInvites}
          isLoading={isLoadingMembers}
          errorMessage={memberErrorMessage}
          onClose={closeMembersDialog}
          onAddMember={addMember}
          onRoleChange={changeMemberRole}
          onRemoveMember={removeMember}
          onCancelInvite={cancelInvite}
          onRetry={reloadMembers}
        />
      )}

      <FocusDock
        focusTasks={focusTasks}
        activeTaskId={activeFocusTaskId}
        isCollapsed={isFocusDockCollapsed}
        timerState={timerState}
        dailyFocusStats={dailyFocusStats}
        remainingSeconds={remainingSeconds}
        onCollapseChange={setIsFocusDockCollapsed}
        onActiveTaskChange={(taskId) => {
          setActiveFocusTaskId(taskId);
          setActiveTimerTaskId(taskId);
        }}
        onModeChange={setPomodoroMode}
        onStartTimer={handleStartFocusTimer}
        onPauseTimer={pauseTimer}
        onResetTimer={resetTimer}
        onPopOutTimer={handleOpenFloatingFocusTimer}
        onOpenShutdown={() => setIsShutdownRitualOpen(true)}
        onOpenTask={handleOpenFocusTask}
        onMarkDone={handleMarkFocusTaskDone}
        onRemoveTask={removeFocusTask}
        isPictureInPictureSupported={isPictureInPictureSupported}
        isPictureInPictureOpen={isPictureInPictureOpen}
      />

      <FocusLimitToast message={focusLimitMessage} onDismiss={clearLimitMessage} />

      <ShutdownRitualDialog
        isOpen={isShutdownRitualOpen}
        focusTasks={focusTasks}
        dailyFocusStats={dailyFocusStats}
        onClose={() => setIsShutdownRitualOpen(false)}
        onComplete={handleCompleteShutdownRitual}
      />

      <ToastContainer />
    </>
  );

  if (activeView === 'not-found') {
    return (
      <>
        <NotFoundPage
          onGoDashboard={() => setActiveViewWithPath('home')}
          onGoToday={() => setActiveViewWithPath('today')}
        />
        <ToastContainer />
      </>
    );
  }

  if (isAuthLoading || (authMode === 'supabase' && user && isWorkspaceLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm font-medium text-slate-500">
        Preparing secure workspace...
      </div>
    );
  }

  if (authMode === 'supabase' && !user) {
    return (
      <>
        <AuthPage
          onAuthenticated={() => {
            if (activeView === 'invite' && activeInviteToken) {
              setActiveViewWithPath('invite', { inviteToken: activeInviteToken });
              return;
            }

            setActiveViewWithPath('home');
          }}
        />
        <ToastContainer />
      </>
    );
  }

  if (authMode === 'supabase' && user && !activeWorkspaceId && activeView !== 'invite') {
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

  if (activeView === 'invite') {
    return (
      <>
        <AcceptInvitePage
          token={activeInviteToken}
          currentUser={user}
          onAccepted={async (workspaceId) => {
            await reloadWorkspaces();
            setActiveWorkspaceId(workspaceId);
            setActiveViewWithPath('home');
          }}
          onGoHome={() => setActiveViewWithPath('home')}
          onSignOut={signOut}
        />
        <ToastContainer />
      </>
    );
  }

  if (activeView === 'today') {
    return (
      <ProtectedRoute onRequireAuth={() => setActiveViewWithPath('auth')}>
        <div className="min-h-screen bg-canvas">
          {appHeader}

          <TodayPage
            currentUser={user}
            activeWorkspace={activeWorkspace}
            focusTasks={focusTasks}
            dailyFocusStats={dailyFocusStats}
            isFocusTask={isFocusTask}
            onOpenTask={handleOpenTaskFromToday}
            onStartFocus={handleStartFocusTaskFromToday}
            onToggleTodayFocus={handleToggleFocusTaskFromToday}
            onQuickCreateTask={handleQuickAddTask}
          />

          {sharedDialogs}
        </div>
      </ProtectedRoute>
    );
  }

  if (activeView === 'home') {
    return (
      <ProtectedRoute onRequireAuth={() => setActiveViewWithPath('auth')}>
        <div className="min-h-screen bg-canvas">
          {appHeader}

          {(isBoardLoading || isSavingBoard) && (
            <div className="border-b border-gray-200 bg-white px-4 py-2 text-sm text-gray-600">
              {isBoardLoading ? 'Preparing board data...' : 'Saving changes...'}
            </div>
          )}

          {workspaceErrorMessage && (
            <div className="px-4 py-3">
              <ErrorState
                title="Couldn't load your workspace"
                description="We couldn't load your workspace data. Check your connection and try again."
                details={workspaceErrorMessage}
                onRetry={handleRetryWorkspace}
                isRetrying={isRetryingWorkspace}
                compact
              />
            </div>
          )}

          <HomeDashboard
            onOpenTask={handleOpenTaskFromHome}
            onOpenBoard={handleOpenBoardFromHome}
            onToggleFocusTask={handleToggleFocusTaskFromHome}
            onStartFocusTask={handleStartFocusTaskFromHome}
            isFocusTask={isFocusTask}
            currentUser={user}
            activeWorkspace={activeWorkspace}
            onCreateBoard={openCreateBoardDialog}
            onCreateTask={handleQuickAddTask}
            onOpenQuickPlan={handleOpenQuickPlan}
            onOpenToday={() => setActiveViewWithPath('today')}
            focusTaskCount={focusTasks.length}
            focusSessionsToday={dailyFocusStats.completedSessions}
            hasTeamMembers={workspaceMembers.length > 1}
          />

          {sharedDialogs}
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute onRequireAuth={() => setActiveViewWithPath('auth')}>
      <div className="min-h-screen bg-canvas">
      {appHeader}
      <BoardHeader
        activeBoardId={activeBoardId}
        activeBoardSummary={activeBoardSummary}
        boardSummaries={boardSummaries}
        activeTab={activeBoardTab}
        workspaceMembers={workspaceMembers}
        onBoardChange={(boardId) => {
          setIsBoardLoading(true);
          setActiveViewWithPath('board');
          void refreshBoardData({ boardId, showErrorToast: true });
        }}
        onTabChange={(tab) => setActiveViewWithPath(tab)}
        onOpenMembers={openMembersDialog}
        onOpenActivity={openActivityDialog}
        onQuickAddTask={handleQuickAddTask}
        onOpenQuickPlan={handleOpenQuickPlan}
      />

      {(isBoardLoading || isSavingBoard) && (
        <div className="border-b border-gray-200 bg-white px-4 py-2 text-sm text-gray-600">
          {isBoardLoading ? 'Loading board data from Supabase...' : 'Saving changes...'}
        </div>
      )}

      {boardErrorMessage && (
        <div className="px-4 py-3">
          <ErrorState
            title="Couldn't load this board"
            description="We couldn't load the board data. Check your connection and try again."
            details={boardErrorMessage}
            onRetry={handleRetryBoard}
            isRetrying={isRetryingBoard}
            compact
          />
        </div>
      )}

      <BoardToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        filterPriority={filterPriority}
        onFilterPriorityChange={setFilterPriority}
        filterAssignee={filterAssignee}
        onFilterAssigneeChange={setFilterAssignee}
        filterDueDate={filterDueDate}
        onFilterDueDateChange={setFilterDueDate}
        onClearFilters={clearBoardFilters}
        workspaceMembers={workspaceMembers}
      />

      {activeView === 'board' && !activeBoardId ? (
        <BoardEmptyState
          workspaceName={activeWorkspace?.name}
          onCreateBoard={openCreateBoardDialog}
        />
      ) : activeView === 'board' && isBoardLoading && boardData.columns.length === 0 ? (
        <div className="bg-canvas p-6" aria-busy="true">
          <div className="flex items-start gap-5 overflow-x-auto pb-6 pt-1">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBoardColumn key={index} />
            ))}
          </div>
        </div>
      ) : activeView === 'board' ? (
        <KanbanBoard
          boardData={boardData}
          filters={{ searchQuery, priority: filterPriority, assignee: filterAssignee, dueDate: filterDueDate }}
          ui={{ openMenuId, toggleMenu }}
          handlers={{
            onEditTask: handleEditTask,
            onDeleteItem: setDeleteItem,
            onOpenAddTask: (listId) => openCreateTaskDialog(listId),
            onOpenAddGroup: openGroupDialog,
            onBoardPositionChange: handleBoardPositionChange,
            onUpdateTask: handleUpdateTask,
            onToggleFocusTask: handleStartFocusTask,
          }}
          isFocusTask={isFocusTask}
          workspaceMembers={workspaceMembers}
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
