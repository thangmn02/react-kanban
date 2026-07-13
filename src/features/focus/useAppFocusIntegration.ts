import { useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import { notify } from '../../components/organisms/toast/notify';
import { useDocumentPictureInPicture } from '../../hooks/useDocumentPictureInPicture';
import { createActivity } from '../../services/activity.service';
import { fetchBoardSnapshot } from '../../services/board.service';
import { updateTask } from '../../services/task.service';
import type { AppUser } from '../../types/auth.type';
import type { FocusTask } from '../../types/focus.type';
import type { ITaskItem } from '../../types/task.type';
import { buildTaskFieldUpdatePayload } from '../../utils/boardDataMapper';
import type { useI18n } from '../../i18n';
import type { FocusSessionValue } from './useFocusSessionController';
import type { useBoardPageController } from '../board/hooks/useBoardPageController';

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
    try {
      await updateTask(focusTask.id, buildTaskFieldUpdatePayload({ isDone: true }));
      focus.updateFocusedTask(focusTask.id, { isDone: true });
      if (board.boardData.task[focusTask.id]) {
        board.setBoardData((current) => ({
          ...current,
          task: { ...current.task, [focusTask.id]: { ...current.task[focusTask.id], isDone: true } },
        }));
      }
      await createActivity(focusTask.id, 'status_change', {
        description: 'Marked task as completed from Focus Dock',
        field: 'isDone',
        oldValue: focusTask.isDone,
        newValue: true,
      }, undefined, undefined, { workspaceId, boardId: focusTask.boardId, actorId: user?.id });
      if (!focusTask.isDone) onTaskCompleted();
      notify.success(t('toast.focusTaskMarkedDone'));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t('toast.unableMarkFocusTaskDone'));
    }
  }, [board, focus, onTaskCompleted, t, user?.id, workspaceId]);

  const handleMarkDoneFromCompletion = useCallback(() => {
    const task = focus.focusCompletion?.task;
    focus.closeFocusCompletion();
    if (task) void handleMarkFocusTaskDone(task);
  }, [focus, handleMarkFocusTaskDone]);

  const handleActiveTaskChange = useCallback((taskId: string) => {
    focus.setActiveFocusTaskId(taskId);
    focus.setActiveTimerTaskId(taskId);
  }, [focus]);

  const handleMarkDoneAndNext = useCallback((taskId: string) => {
    const task = focus.focusTasks.find((item) => item.id === taskId);
    if (!task) return;
    void handleMarkFocusTaskDone(task);
    const currentIndex = focus.focusTasks.findIndex((item) => item.id === taskId);
    const nextTask = focus.focusTasks.find((item, index) => index > currentIndex && !item.isDone)
      || focus.focusTasks.find((item, index) => index < currentIndex && !item.isDone);
    if (nextTask) handleActiveTaskChange(nextTask.id);
    else focus.pauseTimer();
  }, [focus, handleActiveTaskChange, handleMarkFocusTaskDone]);

  const pictureInPicture = useDocumentPictureInPicture({
    activeTask: focus.activeFocusTask,
    focusTasks: focus.focusTasks,
    timerState: focus.timerState,
    remainingSeconds: focus.remainingSeconds,
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
    handleOpenFloatingFocusTimer,
  };
}
