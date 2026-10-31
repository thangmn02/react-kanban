import {runNotesTransition} from './features/notes/native-notes-lifecycle';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import ViewContextBoundary from './app/ViewContextBoundary';
import { useTaskWorkflowSync } from './hooks/use-task-workflow-sync';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { notify } from './components/organisms/toast/notify';

import { ERROR_MESSAGES } from './constants';
import { ARCANA_ENABLED, NOTES_PREVIEW_ENABLED } from './constants/features';
import { useI18n } from './i18n';
import AppHeader from './components/layout/AppHeader';
import AppNavigation from './components/layout/AppNavigation';
import ContextSidebar from './components/layout/context-sidebar';
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
import type { FocusTask } from './types/focus.type';
import type { OnboardingSetupValues } from './types/onboarding.type';
import { useBoardPageController } from './features/board/hooks/useBoardPageController';
import { useBoardDialogState } from './features/board/hooks/useBoardDialogState';
import { useTaskEditorState } from './features/task-editor/useTaskEditorState';
import { useAppFocusIntegration } from './features/focus/useAppFocusIntegration';
import { usePlanningController } from './features/today/hooks/usePlanningController';
import AppOverlays from './app/AppOverlays';
import { useAppRoutingController } from './app/useAppRoutingController';
import { useAppLayoutRouteContextValue } from './app/createAppLayoutRouteContext';
import { useHomeFocusView } from './hooks/useHomeFocusView';
import { isNativeWidget } from './features/native/runtime';
import NativeSurface from './features/native/NativeSurface';
import { authDestination, readReturnTo } from './app/auth-routing';
import NativeNotesOwner from './features/notes/native-notes-owner';
import QuickNotesLayer from './features/notes/quick-notes-layer';
import {openQuickNotes} from './features/notes/quick-notes-events';
import {nativeNotesControl} from './features/notes/native-note-bridge';
import {prepareConnectedNotesToClose} from './features/notes/notes-repository';
import {prepareDeviceNotesToClose} from './features/notes/device-notes-session';

function AppLayout() {
  const native = isNativeWidget();
  const [nativeDock, setNativeDock] = useState(true);
  const {
    authMode,
    user,
    isAuthLoading,
    signOut:finishSignOut,
  } = useAuth();
  const actorId=user?.id;
  const prepareNotesToLeave=useCallback(async()=>{try{
    if(native)await nativeNotesControl('await_settled');
    if(actorId)await Promise.all([prepareConnectedNotesToClose(actorId),prepareDeviceNotesToClose(actorId)]);
  }catch(reason){if(native)await nativeNotesControl('cancel_close').catch(()=>{});throw reason;}},[actorId,native]);
  const signOut=useCallback(async()=>{try{await runNotesTransition(async()=>{try{await prepareNotesToLeave();await finishSignOut();}catch(reason){if(native)await nativeNotesControl('cancel_close').catch(()=>{});throw reason;}});}catch(reason){notify.error(`${String(reason)} Your account stays open so you can retry or export the retained draft.`);}},[prepareNotesToLeave,finishSignOut,native]);
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(()=>{if(!native)return;const blocked=(event:Event)=>{setNativeDock(false);navigate('/notes');notify.error(`Kora stayed open: ${String((event as CustomEvent).detail)}`);};window.addEventListener('kora:notes-quit-blocked',blocked);return()=>window.removeEventListener('kora:notes-quit-blocked',blocked);},[native,navigate]);
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    isWorkspaceLoading,
    workspaceErrorMessage,
    setActiveWorkspaceId:commitWorkspaceChange,
    reloadWorkspaces,
    createWorkspace,
  } = useWorkspaceSession(user);
  const activeWorkspaceRef=useRef(activeWorkspaceId);useEffect(()=>{activeWorkspaceRef.current=activeWorkspaceId;},[activeWorkspaceId]);
  const setActiveWorkspaceId=useCallback(async(workspaceId:string|null,reload=false)=>{
    if(!reload&&workspaceId===activeWorkspaceRef.current)return;
    await runNotesTransition(async()=>{try{const previous=activeWorkspaceRef.current;await prepareNotesToLeave();if(reload){const rows=await reloadWorkspaces();if(!rows||workspaceId&&!rows.some(row=>row.id===workspaceId))throw Error('The requested workspace could not be loaded. Retry after reviewing your access.');}commitWorkspaceChange(workspaceId);activeWorkspaceRef.current=workspaceId;if(native&&previous===workspaceId)await nativeNotesControl('cancel_close');}catch(reason){if(native)await nativeNotesControl('cancel_close').catch(()=>{});throw reason;}});
  },[prepareNotesToLeave,commitWorkspaceChange,reloadWorkspaces,native]);
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

  const taskEditorState = useTaskEditorState();
  const { closeTaskDialog: closeEditor, openEditTaskDialog: openEditor, state: editorState } = taskEditorState;
  // A close can arrive before the router renders the task link it just pushed; remember the dismissal so the
  // link-sync effect strips that late link instead of reopening the drawer.
  const dismissedContextTask = useRef<string | null>(null);
  const closeContextTask = useCallback(() => {
    dismissedContextTask.current = editorState.editingTask?.id ?? null;
    closeEditor();
    const query = new URLSearchParams(location.search);
    if (query.has('task')) {
      query.delete('task'); query.delete('taskBoard');
      navigate(`${location.pathname}${query.size ? `?${query}` : ''}${location.hash}`, { replace: true });
    }
  }, [closeEditor, editorState.editingTask?.id, location, navigate]);
  const taskEditor = { ...taskEditorState, closeTaskDialog: closeContextTask };
  const { focusViewId } = useHomeFocusView(user?.id, activeWorkspaceId);
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
    if (!ARCANA_ENABLED) return;
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
  // A task move or edit is shown optimistically before the server acknowledges it; warn before leaving mid-save.
  useEffect(() => {
    if (!isSavingBoard) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [isSavingBoard]);
  const contextTaskId = new URLSearchParams(location.search).get('task');
  const contextBoardId = new URLSearchParams(location.search).get('taskBoard');
  const contextTask = routing.isTaskContextReady && !boardController.isBoardLoading && !boardController.boardErrorMessage && contextBoardId === activeBoardId
    ? boardData.task[contextTaskId || ''] : undefined;
  const contextTaskUnavailable = Boolean(contextTaskId && routing.isTaskContextReady && !boardController.isBoardLoading && !boardController.boardErrorMessage
    && (!contextBoardId || (contextBoardId === activeBoardId && !contextTask)));
  useEffect(() => {
    if (!contextTaskUnavailable) return;
    notify.info(t('toast.focusTaskUnavailable'));
    closeContextTask();
  }, [contextTaskUnavailable, closeContextTask, t]);
  const previousContextTask = useRef(contextTaskId);
  useEffect(() => {
    if (previousContextTask.current && !contextTaskId) closeEditor();
    previousContextTask.current = contextTaskId;
    if (contextTask && editorState.editingTask?.id === contextTask.id) dismissedContextTask.current = null;
    else if (contextTask && dismissedContextTask.current === contextTask.id) { dismissedContextTask.current = null; closeContextTask(); }
    else if (contextTask) openEditor(contextTask);
  }, [contextTask, contextTaskId, editorState.editingTask?.id, openEditor, closeEditor, closeContextTask]);
  const {
    activeView,
    goToView: setActiveViewWithPath,
  } = routing;

  const handleRetryWorkspace = useCallback(() => {
    setIsRetryingWorkspace(true);
    void runNotesTransition(async()=>{try{await prepareNotesToLeave();await reloadWorkspaces();}finally{if(native)await nativeNotesControl('cancel_close').catch(()=>{});}}).catch(reason=>notify.error(String(reason))).finally(() => {
      setIsRetryingWorkspace(false);
    });
  }, [reloadWorkspaces,prepareNotesToLeave,native]);

  const focusSession = useFocusSessionController({
    user,
    workspaceId: activeWorkspaceId,
    boardData,
    activeBoardId,
    activeBoardSummary,
  });
  useTaskWorkflowSync(activeWorkspaceId,user?.id,focusSession);
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

    await runNotesTransition(async()=>{
    await prepareNotesToLeave();
    try{
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

    activeWorkspaceRef.current=createdWorkspace.id;
    activeBoardIdRef.current = boardSnapshot.boardId;
    setActiveBoardId(boardSnapshot.boardId);
    setBoardData(boardSnapshot.boardData);
    setBoardSummaries(boardRows);
    syncBoardCache(boardSnapshot.boardId, boardSnapshot.boardData);
    const requested = new URLSearchParams(location.search).has('returnTo');
    navigate(requested ? readReturnTo(location.search) : `/workspaces/${createdWorkspace.id}/boards/${boardSnapshot.boardId}`);
    notify.success(t('toast.workspaceCreated'));
    }catch(reason){if(native)await nativeNotesControl('cancel_close').catch(()=>{});throw reason;}
    });
  };

  const handleOpenArcanaBooth = useCallback((consumeRewardDraw = false) => {
    if (!ARCANA_ENABLED) return;
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
    handleOpenFloatingFocusTimer,
  } = focusIntegration;
  const handleOpenFocusTask = useCallback(async (task: FocusTask) => {
    handleOpenTaskFromHome(task.id, task.boardId);
  }, [handleOpenTaskFromHome]);

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

  const appHeader = (
    <AppHeader
      authMode={authMode}
      user={user}
      onSignIn={() => navigate(authDestination(location.pathname + location.search + location.hash))}
      workspaces={user ? workspaces : []}
      activeWorkspace={activeWorkspace}
      activeWorkspaceId={activeWorkspaceId}
      isLocalDemoMode={isLocalDemoMode}
      onGoHome={() => setActiveViewWithPath('home')}
      onGoToday={() => setActiveViewWithPath('today')}
      activeView={activeView}
      onNavigate={setActiveViewWithPath}
      onOpenCommandPalette={() => { if (routing.requireFeature('/tasks')) setIsCommandPaletteOpen(true); }}
      onCreateBoard={() => { if (routing.requireFeature('/tasks')) openCreateBoardDialog(); }}
      onWorkspaceChange={(workspaceId) => {
        void(async()=>{try{
          await setActiveWorkspaceId(workspaceId);setIsBoardLoading(true);navigate('/home');
        }catch(reason){notify.error(`${String(reason)} Your workspace stays open so you can retry or export retained edits.`);}})();
      }}
      onSignOut={() => void signOut()}
      onOpenArcanaBooth={() => handleOpenArcanaBooth()}
      arcanaAvailableDraws={arcanaRewardState.availableDraws}
    />
  );

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
      focusIntegration={{ ...focusIntegration, handleOpenFocusTask }}
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
      isHomeFocusActive={['/', '/home'].includes(location.pathname) && focusSession.focusTasks.some((task) => task.id === focusViewId && task.id === focusSession.timerState.activeTaskId && !task.isDone)}
      hideCompactFocusDock={['music', 'beat-grid', 'focus'].includes(activeView)}
      onOpenNativeDock={native ? () => setNativeDock(true) : undefined}
    />
  );

  const routeContext = useAppLayoutRouteContextValue({
    header: appHeader,
    focusDockPage: {
      attach: focusIntegration.attachFocusDock,
      isFloating: focusIntegration.isPictureInPictureOpen,
      returnToPage: focusIntegration.closePictureInPicture,
      selectTab: focusIntegration.setDockTab,
      native,
      minimized: focusSession.isFocusDockCollapsed,
      setMinimized: focusSession.setIsFocusDockCollapsed,
      openShutdown: () => planning.setIsShutdownRitualOpen(true),
    },
    featureDock: {
      onOpenNotes: NOTES_PREVIEW_ENABLED ? () => openQuickNotes({taskId:focusSession.activeFocusTask?.id}) : undefined,
      activeTab: focusIntegration.dockTab, onTabChange: focusIntegration.handleDockTabChange,
      isMinimized: focusSession.isFocusDockCollapsed,
      activeTask: focusSession.selectedTimerTask || focusSession.activeFocusTask,
      focusTasks: focusSession.focusTasks, timerState: focusSession.timerState,
      remainingSeconds: focusSession.remainingSeconds, cycleTotal: focusSession.timerSettings.longBreakEvery,
      timerSettings: focusSession.timerSettings, onTimerSettingsChange: focusSession.updateTimerSettings, onModeChange: focusSession.setMode,
      onStart: () => { focusSession.startFocusSessionNow(); }, onPause: pauseTimer, onReset: resetTimer,
      onActiveTaskChange: (taskId) => { focusSession.startFocusSessionNow(taskId); },
      onMarkDoneAndNext: focusIntegration.handleMarkDoneAndNext,
      canPopOut: native || isPictureInPictureSupported,
      onPopOut: native ? () => setNativeDock(true) : handleOpenFloatingFocusTimer,
    },
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
    onMarkFocusDone: focusIntegration.handleMarkFocusTaskDone,
    onOpenProgressReport: () => setIsProgressReportOpen(true),
  });

  if (activeView !== 'contact' && ((activeView !== 'home' && isAuthLoading) || (authMode === 'supabase' && user && isWorkspaceLoading))) {
    return <div className="flex min-h-screen items-center justify-center bg-canvas text-sm font-medium text-slate-500">Preparing secure workspace...</div>;
  }

  const showNavigation = (Boolean(user) && !['auth', 'onboarding', 'invite', 'not-found'].includes(activeView)) || ['home', 'contact'].includes(activeView);
  const shouldRenderOverlays = showNavigation && Boolean(user);

  const content = (
    <FocusSessionProvider value={focusSession}>
      {showNavigation && <AppNavigation activeView={activeView} onNavigate={setActiveViewWithPath} />}
      <div className={showNavigation ? 'min-h-screen bg-white lg:ml-14 lg:flex' : undefined}>
        {showNavigation && <ContextSidebar key={`${user?.id}:${activeWorkspaceId}`} activeView={activeView} workspaceId={activeWorkspaceId} workspaceName={activeWorkspace?.name} boards={boardController.boardSummaries} activeBoardId={activeBoardId} boardData={boardData} onBoard={boardController.handleOpenBoardFromHome} onHighPriority={filterHighPriority} onDueToday={filterDueToday} onClearFilters={clearBoardFilters} />}
        <div className="min-w-0 flex-1 bg-white">
        <ViewContextBoundary key={`${user?.id ?? 'public'}:${activeWorkspaceId ?? 'none'}`} ready={!boardController.isBoardLoading}>
          <Suspense fallback={<div role="status" className="min-h-48 bg-canvas px-6 py-10 text-sm text-slate-500">{t('ux.loadingView')}</div>}>
            <Outlet context={routeContext} />
          </Suspense>
        </ViewContextBoundary>
        </div>
      </div>
      {shouldRenderOverlays && sharedDialogs}
    </FocusSessionProvider>
  );
  const notesLayer=NOTES_PREVIEW_ENABLED&&user&&<QuickNotesLayer key={`${user.id}:${activeWorkspaceId}`} user={user} workspace={activeWorkspace} onManager={()=>{setNativeDock(false);navigate('/notes');}} onOpenOriginal={source=>{void(async()=>{if(source.workspaceId&&source.workspaceId!==activeWorkspaceId)await setActiveWorkspaceId(source.workspaceId);setNativeDock(false);const query=new URLSearchParams();if(source.taskId){query.set('task',source.taskId);if(source.boardId)query.set('taskBoard',source.boardId);}if(source.commentId)query.set('comment',source.commentId);if(source.noteId){query.set('note',source.noteId);if(!source.workspaceId)query.set('scope','personal');}navigate(`/notes?${query}`);})().catch(reason=>notify.error(String(reason)));}}/>;
  if (!native) return <>{content}{notesLayer}</>;
  const showDock = nativeDock && shouldRenderOverlays;
  // The existing AppLayout controller owns both native views. Switching to
  // Tasks never creates a second Pomodoro timer or a second session log.
  return <FocusSessionProvider value={focusSession}>
    {notesLayer}
    {NOTES_PREVIEW_ENABLED && <NativeNotesOwner user={user} workspace={activeWorkspace} onManager={() => {setNativeDock(false);navigate('/notes');}} onOpenTask={(taskId,boardId)=>{setNativeDock(false);navigate(`/notes?task=${taskId}&taskBoard=${boardId}`);}} />}
    <NativeSurface dock={showDock}
    onToggle={shouldRenderOverlays ? () => setNativeDock((current) => !current) : undefined}
    focusProps={{
      onOpenNotes: NOTES_PREVIEW_ENABLED ? () => openQuickNotes({taskId:focusSession.activeFocusTask?.id}) : undefined,
      activeTab: focusIntegration.dockTab, onTabChange: focusIntegration.handleDockTabChange,
      activeTask: focusSession.selectedTimerTask || focusSession.activeFocusTask,
      focusTasks: focusSession.focusTasks, timerState: focusSession.timerState,
      remainingSeconds: focusSession.remainingSeconds, cycleTotal: focusSession.timerSettings.longBreakEvery,
      timerSettings: focusSession.timerSettings, onTimerSettingsChange: focusSession.updateTimerSettings, onModeChange: focusSession.setMode,
      onStart: () => { focusSession.startFocusSessionNow(); }, onPause: pauseTimer, onReset: resetTimer,
      onActiveTaskChange: (taskId) => { focusSession.startFocusSessionNow(taskId); },
      onMarkDoneAndNext: focusIntegration.handleMarkDoneAndNext,
    }}>{content}</NativeSurface></FocusSessionProvider>;
}

export default AppLayout;
