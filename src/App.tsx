import { useCallback, useEffect, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { ERROR_MESSAGES } from './constants';
import type { BoardDeleteItem } from './types/task.type';
import AddGroupDialog from './components/organisms/dialog/AddGroupDialog';
import CreateBoardDialog from './components/organisms/dialog/CreateBoardDialog';
import DeleteDialog from './components/organisms/dialog/DeleteDialog';
import CalendarBoardView from './components/organisms/CalendarBoardView';
import HomeDashboard from './components/organisms/HomeDashboard';
import KanbanBoard from './components/organisms/KanbanBoard';
import TaskDialog from './components/organisms/dialog/TaskDialog';
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
import { updateTask } from './services/task.service';
import { buildTaskFieldUpdatePayload } from './utils/boardDataMapper';
import { isLocalDemoMode } from './lib/supabase';
import { createActivity } from './services/activity.service';
import {
  fetchDailyFocusStats,
  logFocusSession,
} from './services/focusSession.service';
import BoardActivityDialog from './components/organisms/dialog/BoardActivityDialog';
import FocusDock from './components/focus/FocusDock';
import FocusLimitToast from './components/focus/FocusLimitToast';
import WorkspaceMembersDialog from './components/workspace/WorkspaceMembersDialog';
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
  const [dailyFocusStats, setDailyFocusStats] = useState<DailyFocusStats>({
    focusedMinutes: 0,
    completedSessions: 0,
    interruptedSessions: 0,
    topTaskTitle: null,
  });

  useEffect(() => {
    if (isAuthLoading || isWorkspaceLoading) {
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
    const modeLabel = mode === 'focus' ? 'Focus session' : mode === 'shortBreak' ? 'Short break' : 'Long break';
    toast.success(`${modeLabel} completed${task ? ` for "${task.title}"` : ''}.`, { theme: 'colored' });

    void logPomodoroSession(task, mode, 'completed', session)
      .then(() => {
        if (mode === 'focus') {
          toast.success('Focus session logged.', { theme: 'colored' });
        }
      })
      .catch((error) => {
        console.warn('Unable to log focus session:', error);
      });

    if (task && mode === 'focus') {
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
  }, [activeWorkspaceId, logPomodoroSession, user?.id]);

  const handlePomodoroInterrupt = useCallback((task: FocusTask | null, mode: PomodoroMode, session: PomodoroSessionSnapshot) => {
    void logPomodoroSession(task, mode, 'interrupted', session)
      .then(() => {
        toast.info('Interrupted focus session logged.', { theme: 'colored' });
      })
      .catch((error) => {
        console.warn('Unable to log interrupted focus session:', error);
      });
  }, [logPomodoroSession]);

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

  const handleStartFocusTimer = useCallback(() => {
    startTimer(activeFocusTaskId || focusTasks[0]?.id);
  }, [activeFocusTaskId, focusTasks, startTimer]);

  const {
    isPictureInPictureSupported,
    isPictureInPictureOpen,
    openPictureInPicture,
  } = useDocumentPictureInPicture({
    activeTask: activeFocusTask,
    focusTasks,
    timerState,
    remainingSeconds,
    onStart: handleStartFocusTimer,
    onPause: pauseTimer,
    onReset: resetTimer,
  });

  const handleOpenFloatingFocusTimer = useCallback(() => {
    if (!isPictureInPictureSupported) {
      toast.info('Floating timer is not supported in this browser.', { theme: 'colored' });
      return;
    }

    void openPictureInPicture().catch((error) => {
      const message = error instanceof Error ? error.message : 'Unable to open floating focus timer.';
      toast.error(message, { theme: 'colored' });
    });
  }, [isPictureInPictureSupported, openPictureInPicture]);

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
      closeGroupDialog();
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
      closeCreateBoardDialog();
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

    openCreateTaskDialog(firstListId);
    setActiveViewWithPath('board');
  }, [activeBoardId, boardData.columns, openCreateTaskDialog, setActiveViewWithPath]);

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
    toast.success('Workspace and first board created.', { theme: 'colored' });
  };

  const handleEditTask = openEditTaskDialog;

  const {
    handleToggleFocusTask,
    handleToggleFocusTaskFromHome,
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
      startTimer,
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
      const message = error instanceof Error ? error.message : 'Unable to open task.';
      toast.error(message, { theme: 'colored' });
    } finally {
      setIsBoardLoading(false);
    }
  }, [activeWorkspaceId, syncBoardCache, user?.id, activeBoardIdRef, setActiveBoardId, setBoardData, setIsBoardLoading, openEditTaskDialog]);

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
        toast.info('This focus task is no longer available.', { theme: 'colored' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open focus task.';
      toast.error(message, { theme: 'colored' });
    } finally {
      setIsBoardLoading(false);
    }
  }, [activeWorkspaceId, removeFocusTask, setActiveViewWithPath, syncBoardCache, user?.id, activeBoardIdRef, setActiveBoardId, setBoardData, setIsBoardLoading, openEditTaskDialog]);

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

  const commandPaletteActions = useCommandPaletteActions({
    setActiveViewWithPath,
    handleQuickAddTask,
    openGroupDialog,
    openCreateBoardDialog,
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
    />
  ) : null;

  const sharedDialogs = (
    <>
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        actions={commandPaletteActions}
        onClose={() => setIsCommandPaletteOpen(false)}
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
        onOpenTask={handleOpenFocusTask}
        onMarkDone={handleMarkFocusTaskDone}
        onRemoveTask={removeFocusTask}
        isPictureInPictureSupported={isPictureInPictureSupported}
        isPictureInPictureOpen={isPictureInPictureOpen}
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
        <div className="min-h-screen bg-[#F8F9FA]">
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
        <div className="min-h-screen bg-[#F8F9FA]">
          {appHeader}

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
      />

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

      <BoardToolbar
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
          onCreateBoard={openCreateBoardDialog}
        />
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
            onToggleFocusTask: handleToggleFocusTask,
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
