import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import AppToastContainer from './components/organisms/toast/AppToastContainer';
import { notify } from './components/organisms/toast/notify';

import { ERROR_MESSAGES } from './constants';
import { useI18n } from './i18n';
import type { BoardDeleteItem } from './types/task.type';
import AddGroupDialog from './components/organisms/dialog/AddGroupDialog';
import CreateBoardDialog from './components/organisms/dialog/CreateBoardDialog';
import DeleteDialog from './components/organisms/dialog/DeleteDialog';
const CalendarBoardView = lazy(() => import('./components/organisms/CalendarBoardView'));
const TableView = lazy(() => import('./components/organisms/TableView'));
const HomeDashboard = lazy(() => import('./components/organisms/HomeDashboard'));
import KanbanBoard from './components/organisms/KanbanBoard';
import TodayQuickPlanDialog from './features/today/components/TodayQuickPlanDialog';
import ShutdownRitualDialog from './features/today/components/ShutdownRitualDialog';
import TaskDialog from './components/organisms/dialog/TaskDialog';
import { parseTaskLines } from './utils/taskParser';
import AuthPage from './components/auth/AuthPage';
import AcceptInvitePage from './components/invite/AcceptInvitePage';
const TodayPage = lazy(() => import('./components/today/TodayPage'));
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
import { buildTaskFieldUpdatePayload, buildTaskInsertPayload } from './utils/boardDataMapper';
import { tasksToCsv, downloadTextFile, parseTasksCsv, normalizeCsvPriority, normalizeCsvDueDate } from './utils/csvTasks';
import { isLocalDemoMode } from './lib/supabase';
import type { StorageScope } from './shared/storage/storageAdapter';
import { createActivity } from './services/activity.service';
import {
  fetchDailyFocusStats,
  logFocusSession,
} from './services/focusSession.service';
import BoardActivityDialog from './components/organisms/dialog/BoardActivityDialog';
import ProgressReportDialog from './components/organisms/dialog/ProgressReportDialog';
import FocusDock from './components/focus/FocusDock';
import FocusCompletionPrompt from './components/focus/FocusCompletionPrompt';
import FocusLaunchpadDialog from './components/focus/FocusLaunchpadDialog';
import FocusLimitToast from './components/focus/FocusLimitToast';
import WorkspaceMembersDialog from './components/workspace/WorkspaceMembersDialog';
const ArcanaBoothDialog = lazy(() => import('./features/arcana/ArcanaBoothDialog'));
const ArcanaRewardToast = lazy(() => import('./features/arcana/ArcanaRewardToast'));
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

/** Full-screen fallback shown while a lazy-loaded view chunk is fetching. */
const pageSuspenseFallback = (
  <div className="flex min-h-screen items-center justify-center bg-canvas text-sm font-medium text-slate-500">
    Loading workspace...
  </div>
);

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
  const [isProgressReportOpen, setIsProgressReportOpen] = useState(false);
  const [boardSubView, setBoardSubView] = useState<'kanban' | 'table'>('kanban');
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

  const focusTaskScope: StorageScope = { userId: user?.id ?? 'mock-user', workspaceId: activeWorkspaceId };
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
  } = useFocusTasks(boardData, focusTaskScope);


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
    notify.success(t('toast.focusCompleted', {
      mode: modeLabel,
      task: task ? `: ${task.title}` : '',
    }));

    void logPomodoroSession(task, mode, 'completed', session)
      .then(() => {
        if (mode === 'focus') {
          notify.success(t('toast.focusSessionLogged'));
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
        notify.info(t('toast.focusSessionInterrupted'));
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
      notify.info(t('toast.chooseFocusTaskBeforeTimer'));
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
      notify.info(t('toast.chooseFocusTaskBeforeTimer'));
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
      notify.success(t('toast.focusStarted', { task: focusLaunchTask.title }));
    }
  }, [closeFocusLaunchpad, focusLaunchTask, startFocusSessionNow, t]);

  const onSubmitList = async (formData: { title: string }) => {
    if (!activeBoardId) {
      notify.error(t('toast.boardNotReady'));
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
      notify.success(t('toast.listAdded'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.unableAddList');

      notify.error(message);
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
      notify.success(t('toast.boardCreated'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.unableCreateBoard');
      notify.error(message);
    } finally {
      setIsSavingBoard(false);
    }
  };

  const handleQuickAddTask = useCallback(() => {
    const firstListId = boardData.columns[0];

    if (!activeBoardId || !firstListId) {
      notify.info(t('toast.createBoardBeforeTask'));
      return;
    }

    openCreateTaskDialog(firstListId);
  }, [activeBoardId, boardData.columns, openCreateTaskDialog, t]);

  const handleOpenQuickPlan = useCallback(() => {
    const firstListId = boardData.columns[0];

    if (!activeBoardId || !firstListId) {
      notify.info(t('toast.createBoardBeforeQuickPlan'));
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
      notify.success(t('toast.createdTasksFromPaste', { count: tasksToCreate.length }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.failedCreatePastedTasks');
      notify.error(message);
    } finally {
      setIsSavingBoard(false);
    }
  }, [activeView, boardData, activeBoardId, activeWorkspaceId, user, refreshBoardData, setIsSavingBoard, t]);

  const handleExportCsv = useCallback(() => {
    try {
      const csv = tasksToCsv(boardData);
      const boardTitle = activeBoardSummary?.title || t('common.untitledBoard');
      const slug = boardTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'board';
      downloadTextFile(`${slug}-tasks.csv`, csv);
      const taskCount = Object.values(boardData.task).filter(Boolean).length;
      notify.success(t('toast.exportedCsv', { count: taskCount }));
    } catch {
      notify.error(t('toast.csvExportFailed'));
    }
  }, [boardData, activeBoardSummary, t]);

  const handleImportCsv = useCallback(async (file: File) => {
    if (activeView !== 'board' && activeView !== 'home') {
      return;
    }

    const firstListId = boardData.columns[0];
    if (!activeBoardId || !activeWorkspaceId || !firstListId || !user) {
      return;
    }

    let fileText: string;
    try {
      fileText = await file.text();
    } catch {
      notify.error(t('toast.csvImportFailed'));
      return;
    }

    const parsedTasks = parseTasksCsv(fileText);
    if (parsedTasks.length === 0) {
      notify.info(t('toast.csvImportEmpty'));
      return;
    }

    const listIdByTitle = new Map<string, string>();
    boardData.columns.forEach((listId) => {
      const list = boardData.list[listId];
      if (list) {
        listIdByTitle.set(list.title.trim().toLowerCase(), listId);
      }
    });

    const assigneeByName = new Map<string, { name: string; avatar: string }>();
    workspaceMembers.forEach((member) => {
      assigneeByName.set(member.name.trim().toLowerCase(), { name: member.name, avatar: member.avatarUrl });
    });

    setIsSavingBoard(true);
    try {
      const positionOffset = (boardData.list[firstListId]?.tasks.length || 0) * 65536;
      const tasksToCreate = parsedTasks.map((row, index) => {
        const matchedAssignee = assigneeByName.get(row.assignee.trim().toLowerCase());
        return {
          ...buildTaskInsertPayload({
            boardId: activeBoardId,
            listId: listIdByTitle.get(row.status.trim().toLowerCase()) || firstListId,
            title: row.title,
            description: '',
            priority: normalizeCsvPriority(row.priority),
            dueDate: normalizeCsvDueDate(row.dueDate),
            position: positionOffset + (index + 1) * 65536,
            assignees: matchedAssignee ? [matchedAssignee] : [],
          }),
          workspace_id: activeWorkspaceId,
          created_by: user.id,
        };
      });

      await createTasks(tasksToCreate);
      await refreshBoardData({ boardId: activeBoardId });
      notify.success(t('toast.importedCsv', { count: tasksToCreate.length }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.csvImportFailed');
      notify.error(message);
    } finally {
      setIsSavingBoard(false);
    }
  }, [activeView, boardData, activeBoardId, activeWorkspaceId, user, workspaceMembers, refreshBoardData, setIsSavingBoard, t]);

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
    notify.success(t('toast.workspaceCreated'));
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
      notify.error(message);
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
        notify.info(t('toast.focusTaskUnavailable'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.unableOpenFocusTask');
      notify.error(message);
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
      notify.success(t('toast.focusTaskMarkedDone'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.unableMarkFocusTaskDone');
      notify.error(message);
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
      notify.info(t('toast.floatingTimerUnsupported'));
      return;
    }

    void openPictureInPicture().catch((error) => {
      const message = error instanceof Error ? error.message : t('toast.unableOpenFloatingTimer');
      notify.error(message);
    });
  }, [isPictureInPictureSupported, openPictureInPicture, t]);

  const handleCarryYesterday = useCallback((taskIds: string[]) => {
    const carriedCount = carryOverFocusTasks(taskIds);
    setCarryoverSummary(null);

    if (carriedCount > 0) {
      notify.success(t('dailyRitual.carriedToast', {
        count: carriedCount,
        plural: carriedCount === 1 ? '' : 's',
      }));
    } else {
      notify.info(t('dailyRitual.carryUnavailableToast'));
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
      notify.info(t('dailyRitual.chooseBeforeStartToast'));
      return;
    }

    const didStart = startFocusSessionNow(firstRunnableTask.id, t('dailyRitual.title'));
    if (!didStart) return;

    notify.success(t('dailyRitual.startedToast', { task: firstRunnableTask.title }));

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

  const handleGoToBoardFromPlan = useCallback(() => {
    closeQuickPlanDialog();
    setActiveViewWithPath('board');
  }, [closeQuickPlanDialog, setActiveViewWithPath]);

  const handleStartFocusFromPlan = useCallback((taskSummary: TodayTaskSummary) => {
    handleStartFocusTaskFromToday(taskSummary);
    closeQuickPlanDialog();
  }, [handleStartFocusTaskFromToday, closeQuickPlanDialog]);

  const handleOpenTaskFromPlan = useCallback((taskSummary: TodayTaskSummary) => {
    closeQuickPlanDialog();
    handleOpenTaskFromToday(taskSummary);
  }, [closeQuickPlanDialog, handleOpenTaskFromToday]);

  const handleCompleteShutdownRitual = useCallback(() => {
    writeDailyRitualSnapshot(
      focusTasks,
      dailyFocusStats.completedSessions,
      dailyFocusStats.focusedMinutes,
    );
    setCarryoverSummary(null);
    setIsShutdownRitualOpen(false);
    notify.success(t('shutdown.completeToast'));
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

      <Suspense fallback={null}>
        <ArcanaBoothDialog
          isOpen={isArcanaBoothOpen}
          onClose={() => setIsArcanaBoothOpen(false)}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ArcanaRewardToast
          isOpen={isArcanaRewardPromptOpen}
          availableDraws={arcanaRewardState.availableDraws}
          onDrawNow={() => handleOpenArcanaBooth(true)}
          onLater={() => setIsArcanaRewardPromptOpen(false)}
        />
      </Suspense>

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
          onOpenTask={handleOpenTaskFromPlan}
          onStartFocus={handleStartFocusFromPlan}
          onGoToBoard={handleGoToBoardFromPlan}
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

      <AppToastContainer />
    </>
  );

  if (activeView === 'not-found') {
    return (
      <>
        <NotFoundPage
          onGoDashboard={() => setActiveViewWithPath('home')}
          onGoToday={() => setActiveViewWithPath('today')}
        />
        <AppToastContainer />
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
        <AppToastContainer />
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
        <AppToastContainer />
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
        <AppToastContainer />
      </>
    );
  }

  if (activeView === 'today') {
    return (
      <ProtectedRoute onRequireAuth={() => setActiveViewWithPath('auth')}>
        <div className="min-h-screen bg-canvas">
          {appHeader}

          <Suspense fallback={pageSuspenseFallback}>
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
          </Suspense>

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

          <Suspense fallback={pageSuspenseFallback}>
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
          </Suspense>

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
        activeTab={activeView === 'calendar' ? 'calendar' : boardSubView === 'table' ? 'table' : 'board'}
        workspaceMembers={workspaceMembers}
        onBoardChange={(boardId) => {
          setIsBoardLoading(true);
          setActiveViewWithPath('board');
          void refreshBoardData({ boardId, showErrorToast: true });
        }}
        onTabChange={(tab) => {
          if (tab === 'calendar') {
            setActiveViewWithPath('calendar');
            return;
          }
          setBoardSubView(tab === 'table' ? 'table' : 'kanban');
          if (activeView !== 'board') {
            setActiveViewWithPath('board');
          }
        }}
        onOpenMembers={openMembersDialog}
        onOpenActivity={openActivityDialog}
        onQuickAddTask={handleQuickAddTask}
        onOpenQuickPlan={handleOpenQuickPlan}
        onOpenProgressReport={() => setIsProgressReportOpen(true)}
        onExportCsv={handleExportCsv}
        onImportCsv={handleImportCsv}
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
      ) : activeView === 'board' && boardSubView === 'table' ? (
        <Suspense fallback={pageSuspenseFallback}>
          <TableView
            boardData={boardData}
            searchQuery={searchQuery}
            filterPriority={filterPriority}
            filterAssignee={filterAssignee}
            filterDueDate={filterDueDate}
            onOpenTask={handleEditTask}
          />
        </Suspense>
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
          activeBoardId={activeBoardId}
        />
      ) : (
        <Suspense fallback={pageSuspenseFallback}>
          <CalendarBoardView
            boardData={boardData}
            searchQuery={searchQuery}
            filterPriority={filterPriority}
            filterAssignee={filterAssignee}
            filterDueDate={filterDueDate}
            onOpenTask={handleEditTask}
          />
        </Suspense>
      )}

      {sharedDialogs}

      <ProgressReportDialog
        isOpen={isProgressReportOpen}
        onClose={() => setIsProgressReportOpen(false)}
        boardTitle={activeBoardSummary?.title || t('common.untitledBoard')}
        boardData={boardData}
      />
    </div>
    </ProtectedRoute>
  );
}

export default App;
