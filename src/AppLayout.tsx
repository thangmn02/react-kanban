import { useCallback, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { notify } from './components/organisms/toast/notify';

import { ERROR_MESSAGES } from './constants';
import { useI18n } from './i18n';
import AppHeader from './components/layout/AppHeader';
import { useAuth } from './hooks/useAuth';
import { useGlobalKeyboardShortcuts } from './hooks/useGlobalKeyboardShortcuts';
import { useWorkspaceSession } from './hooks/useWorkspaceSession';
import { useWorkspaceMembers } from './hooks/useWorkspaceMembers';
import { createBoardFromTemplate, fetchBoardSnapshot, fetchBoards } from './services/board.service';
import { findBoardTemplateById } from './data/boardTemplates';
import { isLocalDemoMode } from './lib/supabase';
import {
  consumeArcanaRewardDraw,
  readArcanaRewardState,
  registerArcanaTaskCompletion,
} from './features/arcana/arcanaReward';
import { useCommandPaletteActions } from './hooks/useCommandPaletteActions';
import { FocusSessionProvider } from './features/focus/FocusSessionProvider';
import { useFocusSessionController } from './features/focus/useFocusSessionController';
import type { TodayTaskSummary } from './services/today.service';
import type { OnboardingSetupValues } from './types/onboarding.type';
import { useBoardPageController } from './features/board/hooks/useBoardPageController';
import { useBoardDialogState } from './features/board/hooks/useBoardDialogState';
import { useTaskEditorState } from './features/task-editor/useTaskEditorState';
import { useAppFocusIntegration } from './features/focus/useAppFocusIntegration';
import { usePlanningController } from './features/today/hooks/usePlanningController';
import AppOverlays from './app/AppOverlays';
import { useAppRoutingController } from './app/useAppRoutingController';
import { useAppLayoutRouteContextValue } from './app/createAppLayoutRouteContext';

function AppLayout() {
  const {
    authMode,
    user,
    isAuthLoading,
    signOut,
  } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
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

  const taskEditor = useTaskEditorState();
  const boardDialogs = useBoardDialogState();
  const {
    openGroupDialog,
    closeGroupDialog,
    openQuickPlanDialog,
    closeQuickPlanDialog,
    openCreateBoardDialog,
    closeCreateBoardDialog,
    openActivityDialog,
  } = boardDialogs;
  const {
    openCreateTaskDialog,
    openEditTaskDialog,
    closeTaskDialog,
  } = taskEditor;
  const dialogState = {
    taskDialog: { ...taskEditor.state, isOpen: taskEditor.isOpen },
    groupDialog: boardDialogs.groupDialog,
    quickPlanDialog: boardDialogs.quickPlanDialog,
    boardDialog: boardDialogs.boardDialog,
    activityDialog: boardDialogs.activityDialog,
  };

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isProgressReportOpen, setIsProgressReportOpen] = useState(false);
  const [arcanaRewardState, setArcanaRewardState] = useState(readArcanaRewardState);
  const [isArcanaRewardPromptOpen, setIsArcanaRewardPromptOpen] = useState(false);
  const [isRetryingWorkspace, setIsRetryingWorkspace] = useState(false);

  const handleArcanaTaskCompleted = useCallback(() => {
    const rewardResult = registerArcanaTaskCompletion();
    setArcanaRewardState(rewardResult.state);
    if (rewardResult.shouldPrompt) setIsArcanaRewardPromptOpen(true);
  }, []);

  const boardController = useBoardPageController({
    authMode,
    activeView: location.pathname,
    workspaceId: activeWorkspaceId,
    user,
    workspaceMembers,
    editingTask: dialogState.taskDialog.editingTask,
    activeListId: dialogState.taskDialog.activeListId,
    openCreateTaskDialog,
    openEditTaskDialog,
    closeTaskDialog,
    closeGroupDialog,
    closeCreateBoardDialog,
    onTaskCompleted: handleArcanaTaskCompleted,
    navigate,
    t,
  });
  const {
    boardData,
    setBoardData,
    activeBoardId,
    setActiveBoardId,
    activeBoardIdRef,
    setBoardSummaries,
    activeBoardSummary,
    setIsBoardLoading,
    isSavingBoard,
    syncBoardCache,
    handleQuickAddTask,
    handleOpenTaskFromHome,
    clearBoardFilters,
    filterHighPriority,
    filterDueToday,
    focusBoardSearch,
  } = boardController;

  const routing = useAppRoutingController({
    authMode,
    user,
    isAuthLoading,
    isWorkspaceLoading,
    activeWorkspaceId,
    workspaces,
    setActiveWorkspaceId,
    board: boardController,
  });
  const {
    activeView,
    goToView: setActiveViewWithPath,
  } = routing;

  const handleRetryWorkspace = useCallback(() => {
    setIsRetryingWorkspace(true);
    void reloadWorkspaces().finally(() => {
      setIsRetryingWorkspace(false);
    });
  }, [reloadWorkspaces]);

  const focusSession = useFocusSessionController({
    user,
    workspaceId: activeWorkspaceId,
    boardData,
    activeBoardId,
    activeBoardSummary,
  });
  const {
    activeFocusTask,
    pauseTimer,
    resetTimer,
    handleStartFocusTimer,
  } = focusSession;
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
    navigate(`/workspaces/${createdWorkspace.id}/boards/${boardSnapshot.boardId}`);
    notify.success(t('toast.workspaceCreated'));
  };

  const handleOpenArcanaBooth = useCallback((consumeRewardDraw = false) => {
    if (consumeRewardDraw) {
      setArcanaRewardState(consumeArcanaRewardDraw());
    } else {
      setArcanaRewardState(readArcanaRewardState());
    }

    setIsArcanaRewardPromptOpen(false);
    navigate('/arcana');
  }, [navigate]);

  const handleOpenTaskFromToday = useCallback((taskSummary: TodayTaskSummary) => {
    void handleOpenTaskFromHome(taskSummary.id, taskSummary.boardId);
  }, [handleOpenTaskFromHome]);

  const focusIntegration = useAppFocusIntegration({
    focus: focusSession,
    board: boardController,
    workspaceId: activeWorkspaceId,
    user,
    navigate,
    openEditTaskDialog,
    onTaskCompleted: handleArcanaTaskCompleted,
    t,
  });
  const {
    isPictureInPictureSupported,
    handleOpenFocusTask,
    handleOpenFloatingFocusTimer,
  } = focusIntegration;

  const planning = usePlanningController({
    focus: focusSession,
    activeBoardId,
    firstListId: boardData.columns[0],
    openQuickPlanDialog,
    closeQuickPlanDialog,
    onOpenTask: handleOpenTaskFromToday,
    onGoToBoard: () => setActiveViewWithPath('board'),
    canOpenPictureInPicture: isPictureInPictureSupported,
    onOpenPictureInPicture: handleOpenFloatingFocusTimer,
    t,
  });
  const { handleOpenQuickPlan } = planning;

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
        navigate('/home');
      }}
      onSignOut={() => void signOut()}
      onOpenArcanaBooth={() => handleOpenArcanaBooth()}
      arcanaAvailableDraws={arcanaRewardState.availableDraws}
    />
  ) : null;

  const sharedDialogs = (
    <AppOverlays
      user={user}
      workspace={activeWorkspace}
      workspaceMembers={workspaceMembers}
      workspaceId={activeWorkspaceId}
      board={boardController}
      boardDialogs={boardDialogs}
      taskEditor={taskEditor}
      focus={focusSession}
      focusIntegration={focusIntegration}
      planning={planning}
      commandPalette={{
        isOpen: isCommandPaletteOpen,
        actions: commandPaletteActions,
        onClose: () => setIsCommandPaletteOpen(false),
      }}
      arcanaReward={{
        isOpen: isArcanaRewardPromptOpen,
        availableDraws: arcanaRewardState.availableDraws,
        onDrawNow: () => handleOpenArcanaBooth(true),
        onLater: () => setIsArcanaRewardPromptOpen(false),
      }}
      progressReport={{
        isOpen: isProgressReportOpen,
        onClose: () => setIsProgressReportOpen(false),
      }}
    />
  );

  const routeContext = useAppLayoutRouteContextValue({
    header: appHeader,
    user,
    activeWorkspace,
    activeWorkspaceId,
    workspaceMembers,
    workspaceInvites,
    isLoadingMembers,
    memberErrorMessage,
    isWorkspaceLoading,
    workspaceErrorMessage,
    isRetryingWorkspace,
    onRetryWorkspace: handleRetryWorkspace,
    reloadWorkspaces,
    setActiveWorkspaceId,
    addMember,
    changeMemberRole,
    removeMember,
    cancelInvite,
    reloadMembers,
    signOut,
    onCompleteOnboarding: handleCompleteOnboarding,
    board: boardController.route,
    boardDialogs,
    taskEditor,
    focus: focusSession,
    routing,
    handleOpenQuickPlan,
    handleOpenTaskFromToday,
    isSavingBoard,
    onOpenProgressReport: () => setIsProgressReportOpen(true),
  });

  if (isAuthLoading || (authMode === 'supabase' && user && isWorkspaceLoading)) {
    return <div className="flex min-h-screen items-center justify-center bg-canvas text-sm font-medium text-slate-500">Preparing secure workspace...</div>;
  }

  const shouldRenderOverlays = Boolean(user) && !['auth', 'onboarding', 'invite', 'not-found'].includes(activeView);

  return (
    <FocusSessionProvider value={focusSession}>
      <Outlet context={routeContext} />
      {shouldRenderOverlays && sharedDialogs}
    </FocusSessionProvider>
  );
}

export default AppLayout;
