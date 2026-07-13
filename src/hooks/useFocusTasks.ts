import { useCallback, useEffect, useMemo, useState } from 'react';

import type { BoardData } from '../types/task.type';
import type { FocusTask, FocusTaskInput } from '../types/focus.type';
import { mapTaskToFocusTask } from '../utils/focusTaskMapper';
import { MAX_FOCUS_TASKS, FOCUS_LIMIT_MESSAGE } from '../constants';
import {
  readScopedJSON,
  writeScopedJSON,
  removeScopedKey,
  type StorageScope,
} from '../shared/storage/storageAdapter';

function readStoredFocusTasks(scope: StorageScope): FocusTask[] {
  return readScopedJSON<FocusTask[]>(scope, 'focus_tasks', []);
}

function readStoredActiveFocusTaskId(scope: StorageScope): string | null {
  return readScopedJSON<string | null>(scope, 'active_focus_task', null);
}

export function useFocusTasks(boardData: BoardData, scope: StorageScope) {
  const [focusTasks, setFocusTasks] = useState<FocusTask[]>(() => readStoredFocusTasks(scope));
  const [activeFocusTaskId, setActiveFocusTaskId] = useState<string | null>(() => readStoredActiveFocusTaskId(scope));
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  useEffect(() => {
    writeScopedJSON(scope, 'focus_tasks', focusTasks);
  }, [focusTasks, scope]);

  useEffect(() => {
    if (activeFocusTaskId) {
      writeScopedJSON(scope, 'active_focus_task', activeFocusTaskId);
    } else {
      removeScopedKey(scope, 'active_focus_task');
    }
  }, [activeFocusTaskId, scope]);


  const focusTasksWithCurrentBoardState = useMemo(() => (
    focusTasks.map((focusTask) => {
      const liveTask = boardData.task[focusTask.id];

      if (!liveTask) {
        return focusTask;
      }

      const liveListId = boardData.columns.find((listId) => (
        boardData.list[listId]?.tasks.includes(liveTask.id)
      ));
      const liveList = liveListId ? boardData.list[liveListId] : undefined;

      return {
        ...focusTask,
        title: liveTask.title,
        priority: liveTask.priority,
        dueDate: liveTask.dueDate,
        assigneeAvatar: liveTask.assignees[0]?.avatar,
        isDone: liveTask.isDone,
        listId: liveListId || focusTask.listId,
        listTitle: liveList?.title || focusTask.listTitle,
      };
    })
  ), [boardData, focusTasks]);

  const focusTaskIds = useMemo(() => (
    new Set(focusTasks.map((focusTask) => focusTask.id))
  ), [focusTasks]);

  const resolvedActiveFocusTaskId = useMemo(() => (
    focusTasksWithCurrentBoardState.some((focusTask) => focusTask.id === activeFocusTaskId)
      ? activeFocusTaskId
      : focusTasksWithCurrentBoardState[0]?.id || null
  ), [activeFocusTaskId, focusTasksWithCurrentBoardState]);

  const activeFocusTask = useMemo(() => (
    focusTasksWithCurrentBoardState.find((focusTask) => focusTask.id === resolvedActiveFocusTaskId) || null
  ), [focusTasksWithCurrentBoardState, resolvedActiveFocusTaskId]);

  const removeFocusTask = useCallback((taskId: string) => {
    setFocusTasks((currentFocusTasks) => currentFocusTasks.filter((focusTask) => focusTask.id !== taskId));
  }, []);

  const carryOverFocusTasks = useCallback((taskIds: string[]) => {
    const taskIdSet = new Set(taskIds);
    const nextFocusTasks = focusTasks.filter((focusTask) => taskIdSet.has(focusTask.id) && !focusTask.isDone);

    setFocusTasks(nextFocusTasks);
    setActiveFocusTaskId(nextFocusTasks[0]?.id || null);
    setLimitMessage(null);

    return nextFocusTasks.length;
  }, [focusTasks]);

  const pinFocusTask = useCallback((input: FocusTaskInput) => {
    const nextFocusTask = mapTaskToFocusTask(input);
    let didHitLimit = false;

    setFocusTasks((currentFocusTasks) => {
      if (currentFocusTasks.some((focusTask) => focusTask.id === nextFocusTask.id)) {
        return currentFocusTasks.map((focusTask) => (
          focusTask.id === nextFocusTask.id ? { ...focusTask, ...nextFocusTask } : focusTask
        ));
      }

      if (currentFocusTasks.length >= MAX_FOCUS_TASKS) {
        didHitLimit = true;
        return currentFocusTasks;
      }

      return [...currentFocusTasks, nextFocusTask];
    });

    if (didHitLimit) {
      setLimitMessage(FOCUS_LIMIT_MESSAGE);
      return false;
    }

    setActiveFocusTaskId(nextFocusTask.id);
    setLimitMessage(null);
    return true;
  }, []);

  const toggleFocusTask = useCallback((input: FocusTaskInput) => {
    if (focusTaskIds.has(input.task.id)) {
      removeFocusTask(input.task.id);
      return true;
    }

    return pinFocusTask(input);
  }, [focusTaskIds, pinFocusTask, removeFocusTask]);

  const updateFocusedTask = useCallback((taskId: string, updates: Partial<FocusTask>) => {
    setFocusTasks((currentFocusTasks) => currentFocusTasks.map((focusTask) => (
      focusTask.id === taskId ? { ...focusTask, ...updates } : focusTask
    )));
  }, []);

  const clearLimitMessage = useCallback(() => {
    setLimitMessage(null);
  }, []);

  return {
    focusTasks: focusTasksWithCurrentBoardState,
    activeFocusTask,
    activeFocusTaskId: resolvedActiveFocusTaskId,
    limitMessage,
    maxFocusTasks: MAX_FOCUS_TASKS,
    isFocusTask: (taskId: string) => focusTaskIds.has(taskId),
    pinFocusTask,
    carryOverFocusTasks,
    removeFocusTask,
    setActiveFocusTaskId,
    toggleFocusTask,
    updateFocusedTask,
    clearLimitMessage,
  };
}
