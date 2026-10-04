import { useCallback, useRef } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import { notify } from '../../components/organisms/toast/notify';
import { useDocumentPictureInPicture } from '../../hooks/useDocumentPictureInPicture';
import { createActivity } from '../../services/activity.service';
import { fetchBoardSnapshot } from '../../services/board.service';
import { createNextRecurringTaskOccurrence, updateTask } from '../../services/task.service';
import type { AppUser } from '../../types/auth.type';
import type { FocusTask } from '../../types/focus.type';
import type { ITaskItem } from '../../types/task.type';
import { buildTaskFieldUpdatePayload } from '../../utils/boardDataMapper';
import type { useI18n } from '../../i18n';
import type { FocusSessionValue } from './useFocusSessionController';
import type { useBoardPageController } from '../board/hooks/useBoardPageController';
import { isNativeWidget } from '../native/runtime';

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
    board.setIsBoardLoading(true);
    try {
      const snapshot = await fetchBoardSnapshot(focusTask.boardId, workspaceId, user?.id);
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
      notify.error(error instanceof Error ? error.message : t('toast.unableOpenFocusTask'));
    } finally {
      board.setIsBoardLoading(false);
    }
  }, [board, focus, navigate, openEditTaskDialog, t, user?.id, workspaceId]);

  const handleMarkFocusTaskDone = useCallback(async (focusTask: FocusTask) => {
    const requestScopeKey = focusContextRef.current.scopeKey;
    try {
      const updatedTask = await updateTask(focusTask.id, buildTaskFieldUpdatePayload({ isDone: true }));
      const nextOccurrence = !focusTask.isDone ? await createNextRecurringTaskOccurrence(updatedTask) : null;
      if (focusContextRef.current.scopeKey !== requestScopeKey) return false;
      focus.updateFocusedTask(focusTask.id, { isDone: true });
      if (board.boardData.task[focusTask.id]) {
        board.setBoardData((current) => ({
          ...current,
          task: { ...current.task, [focusTask.id]: { ...current.task[focusTask.id], isDone: true } },
        }));
      }
      if (nextOccurrence) await board.refreshBoardData();
      void createActivity(focusTask.id, 'status_change', {
        description: 'Marked task as completed from Focus Dock',
        field: 'isDone',
        oldValue: focusTask.isDone,
        newValue: true,
      }, undefined, undefined, { workspaceId, boardId: focusTask.boardId, actorId: user?.id })
        .catch((error) => console.warn('Unable to log focus task completion activity:', error));
      if (!focusTask.isDone) onTaskCompleted();
      const currentTimer = focusContextRef.current;
      if (currentTimer.activeTaskId === focusTask.id && currentTimer.mode === 'focus' && currentTimer.isRunning) {
        focus.pauseTimer();
      }
      notify.success(t('toast.focusTaskMarkedDone'));
      return true;
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t('toast.unableMarkFocusTaskDone'));
      return false;
    }
  }, [board, focus, onTaskCompleted, t, user?.id, workspaceId]);

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
    activeTask: focus.selectedTimerTask || focus.activeFocusTask,
    focusTasks: focus.focusTasks,
    timerState: focus.timerState,
    remainingSeconds: focus.remainingSeconds,
    cycleTotal: focus.timerSettings.longBreakEvery,
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
    handleOpenFocusTask,
    handleMarkFocusTaskDone,
    handleMarkDoneFromCompletion,
    handleActiveTaskChange,
    handleMarkDoneAndNext,
    handleOpenFloatingFocusTimer,
  };
}
