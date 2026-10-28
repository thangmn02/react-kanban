import { useCallback, useRef, useState } from 'react';
import { useLocation, type NavigateFunction } from 'react-router-dom';

import { notify } from '../../components/organisms/toast/notify';
import { useDocumentPictureInPicture } from '../../hooks/useDocumentPictureInPicture';
import { transitionTaskWorkflow } from '../../services/task-workflow.service';
import { fetchBoardSnapshot } from '../../services/board.service';
import type { AppUser } from '../../types/auth.type';
import type { FocusTask } from '../../types/focus.type';
import type { ITaskItem } from '../../types/task.type';
import type { useI18n } from '../../i18n';
import type { FocusSessionValue } from './useFocusSessionController';
import type { useBoardPageController } from '../board/hooks/useBoardPageController';
import { isNativeWidget } from '../native/runtime';
import { NOTES_PREVIEW_ENABLED } from '../../constants/features';

interface Params {
  focus: FocusSessionValue;
  board: ReturnType<typeof useBoardPageController>;
  workspaceId: string | null;
  user: AppUser | null;
  navigate: NavigateFunction;
  openEditTaskDialog: (task: ITaskItem) => void;
  onTaskCompleted: () => void;
  t: ReturnType<typeof useI18n>['t'];
}

export function useAppFocusIntegration({
  focus,
  board,
  workspaceId,
  user,
  navigate,
  openEditTaskDialog,
  onTaskCompleted,
  t,
}: Params) {
  const [dockTab, setDockTab] = useState<'focus' | 'music' | 'beat'>('focus');
  const location = useLocation();
  const isFocusPage = ['/focus', '/music', '/beat-grid'].includes(location.pathname);
  const handleDockTabChange = useCallback((tab: 'focus' | 'music' | 'beat') => {
    setDockTab(tab);
    if (isFocusPage) {
      const query = new URLSearchParams(location.search);
      query.set('tab', tab);
      navigate(`${location.pathname}?${query}${location.hash}`, { replace: true });
    }
  }, [isFocusPage, location.pathname, location.search, location.hash, navigate]);
  const focusContextRef = useRef({
    scopeKey: `${user?.id ?? 'none'}:${workspaceId ?? 'none'}`,
    activeTaskId: focus.timerState.activeTaskId,
    startedAt: focus.timerState.startedAt,
    mode: focus.timerState.mode,
    isRunning: focus.timerState.isRunning,
  });
  const pendingCompletionKeysRef = useRef(new Set<string>());
  focusContextRef.current = {
    scopeKey: `${user?.id ?? 'none'}:${workspaceId ?? 'none'}`,
    activeTaskId: focus.timerState.activeTaskId,
    startedAt: focus.timerState.startedAt,
    mode: focus.timerState.mode,
    isRunning: focus.timerState.isRunning,
  };

  const handleOpenFocusTask = useCallback(async (focusTask: FocusTask) => {
    const requestScopeKey=focusContextRef.current.scopeKey;
    board.setIsBoardLoading(true);
    try {
      const snapshot = await fetchBoardSnapshot(focusTask.boardId, workspaceId, user?.id);
      if(focusContextRef.current.scopeKey!==requestScopeKey)return;
      board.activeBoardIdRef.current = snapshot.boardId;
      board.setActiveBoardId(snapshot.boardId);
      board.setBoardData(snapshot.boardData);
      board.syncBoardCache(snapshot.boardId, snapshot.boardData);
      if (workspaceId) navigate(`/workspaces/${workspaceId}/boards/${focusTask.boardId}`);
      const task = snapshot.boardData.task[focusTask.id];
      if (task) openEditTaskDialog(task);
      else {
        focus.removeFocusTask(focusTask.id);
        notify.info(t('toast.focusTaskUnavailable'));
      }
    } catch (error) {
      if(focusContextRef.current.scopeKey===requestScopeKey)notify.error(error instanceof Error ? error.message : t('toast.unableOpenFocusTask'));
    } finally {
      if(focusContextRef.current.scopeKey===requestScopeKey)board.setIsBoardLoading(false);
    }
  }, [board, focus, navigate, openEditTaskDialog, t, user?.id, workspaceId]);

  const handleMarkFocusTaskDone = useCallback(async (focusTask: FocusTask) => {
    const requestScopeKey = focusContextRef.current.scopeKey;
    try {
      const result = await transitionTaskWorkflow({taskId: focusTask.id, boardId: focusTask.boardId, workspaceId, kind: 'complete'});
      if (focusContextRef.current.scopeKey !== requestScopeKey) return false;
      focus.updateFocusedTask(focusTask.id, { isDone: result.task.is_done, updatedAt: result.task.updated_at });
      await board.refreshBoardData();
      if(focusContextRef.current.scopeKey!==requestScopeKey)return false;
      if (result.completedTransition) onTaskCompleted();
      const currentTimer = focusContextRef.current;
      if (currentTimer.activeTaskId === focusTask.id && currentTimer.mode === 'focus' && currentTimer.isRunning) {
        focus.pauseTimer();
      }
      notify.success(t('toast.focusTaskMarkedDone'));
      return true;
    } catch (error) {
      if(focusContextRef.current.scopeKey===requestScopeKey)notify.error(error instanceof Error ? error.message : t('toast.unableMarkFocusTaskDone'));
      return false;
    }
  }, [board, focus, onTaskCompleted, t, workspaceId]);

  const handleMarkDoneFromCompletion = useCallback(async () => {
    const task = focus.focusCompletion?.task;
    if (!task) return;
    const requestScopeKey = focusContextRef.current.scopeKey;
    const completionKey = `${requestScopeKey}:prompt:${task.id}:${focus.focusCompletion?.session.endedAt ?? 'none'}`;
    if (pendingCompletionKeysRef.current.has(completionKey)) return;
    pendingCompletionKeysRef.current.add(completionKey);
    const didComplete = await handleMarkFocusTaskDone(task);
    pendingCompletionKeysRef.current.delete(completionKey);
    if (didComplete && focusContextRef.current.scopeKey === requestScopeKey) {
      focus.closeFocusCompletion();
    }
  }, [focus, handleMarkFocusTaskDone]);

  const handleActiveTaskChange = useCallback((taskId: string) => {
    focus.handleStartFocusTimer(taskId);
  }, [focus]);

  const handleMarkDoneAndNext = useCallback(async (taskId: string) => {
    const task = focus.focusTasks.find((item) => item.id === taskId);
    if (!task) return;
    const requestContext = focusContextRef.current;
    const completionKey = `${requestContext.scopeKey}:${taskId}:${requestContext.startedAt ?? 'none'}`;
    if (pendingCompletionKeysRef.current.has(completionKey)) return;
    pendingCompletionKeysRef.current.add(completionKey);
    const didComplete = await handleMarkFocusTaskDone(task);
    pendingCompletionKeysRef.current.delete(completionKey);
    const currentContext = focusContextRef.current;
    if (!didComplete
      || currentContext.scopeKey !== requestContext.scopeKey
      || currentContext.activeTaskId !== requestContext.activeTaskId
      || currentContext.startedAt !== requestContext.startedAt) return;

    focus.pauseTimer();
    const currentIndex = focus.focusTasks.findIndex((item) => item.id === taskId);
    const nextTask = focus.focusTasks.find((item, index) => index > currentIndex && !item.isDone)
      || focus.focusTasks.find((item, index) => index < currentIndex && !item.isDone);
    if (nextTask) {
      if (isNativeWidget()) focus.startFocusSessionNow(nextTask.id);
      else focus.handleStartFocusTimer(nextTask.id);
    }
  }, [focus, handleMarkFocusTaskDone]);

  const pictureInPicture = useDocumentPictureInPicture({
    onOpenNotes: NOTES_PREVIEW_ENABLED ? () => { navigate('/notes?filter=pinned'); window.focus(); } : undefined,
    activeTab: dockTab, onTabChange: handleDockTabChange,
    isMinimized: isFocusPage && focus.isFocusDockCollapsed,
    onDismiss: () => navigate('/home'),
    activeTask: focus.selectedTimerTask || focus.activeFocusTask,
    focusTasks: focus.focusTasks,
    timerState: focus.timerState,
    remainingSeconds: focus.remainingSeconds,
    cycleTotal: focus.timerSettings.longBreakEvery,
    timerSettings: focus.timerSettings, onTimerSettingsChange: focus.updateTimerSettings, onModeChange: focus.setMode,
    onStart: () => focus.startFocusSessionNow(),
    onPause: focus.pauseTimer,
    onReset: focus.resetTimer,
    onActiveTaskChange: handleActiveTaskChange,
    onMarkDoneAndNext: handleMarkDoneAndNext,
  });

  const handleOpenFloatingFocusTimer = useCallback(() => {
    if (!pictureInPicture.isPictureInPictureSupported) {
      notify.info(t('toast.floatingTimerUnsupported'));
      return;
    }
    void pictureInPicture.openPictureInPicture().catch((error) => {
      notify.error(error instanceof Error ? error.message : t('toast.unableOpenFloatingTimer'));
    });
  }, [pictureInPicture, t]);

  return {
    ...pictureInPicture,
    dockTab, setDockTab, handleDockTabChange,
    handleOpenFocusTask,
    handleMarkFocusTaskDone,
    handleMarkDoneFromCompletion,
    handleActiveTaskChange,
    handleMarkDoneAndNext,
    handleOpenFloatingFocusTimer,
  };
}
