import { useCallback, useEffect, useMemo, useState } from 'react';

import type { BoardData } from '../types/task.type';
import type { FocusTask, FocusTaskInput } from '../types/focus.type';
import { mapTaskToFocusTask } from '../utils/focusTaskMapper';

const focusTasksStorageKey = 'kanban_focus_tasks';
const activeFocusTaskStorageKey = 'kanban_active_focus_task';
const maxFocusTasks = 3;

function readStoredFocusTasks(): FocusTask[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(focusTasksStorageKey);
    return storedValue ? JSON.parse(storedValue) as FocusTask[] : [];
  } catch {
    return [];
  }
}

function readStoredActiveFocusTaskId() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(activeFocusTaskStorageKey);
}

export function useFocusTasks(boardData: BoardData) {
  const [focusTasks, setFocusTasks] = useState<FocusTask[]>(readStoredFocusTasks);
  const [activeFocusTaskId, setActiveFocusTaskId] = useState<string | null>(readStoredActiveFocusTaskId);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(focusTasksStorageKey, JSON.stringify(focusTasks));
  }, [focusTasks]);

  useEffect(() => {
    if (activeFocusTaskId) {
      window.localStorage.setItem(activeFocusTaskStorageKey, activeFocusTaskId);
    } else {
      window.localStorage.removeItem(activeFocusTaskStorageKey);
    }
  }, [activeFocusTaskId]);

  const focusTasksWithLiveData = useMemo(() => (
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
    focusTasksWithLiveData.some((focusTask) => focusTask.id === activeFocusTaskId)
      ? activeFocusTaskId
      : focusTasksWithLiveData[0]?.id || null
  ), [activeFocusTaskId, focusTasksWithLiveData]);

  const activeFocusTask = useMemo(() => (
    focusTasksWithLiveData.find((focusTask) => focusTask.id === resolvedActiveFocusTaskId) || null
  ), [focusTasksWithLiveData, resolvedActiveFocusTaskId]);

  const removeFocusTask = useCallback((taskId: string) => {
    setFocusTasks((currentFocusTasks) => currentFocusTasks.filter((focusTask) => focusTask.id !== taskId));
  }, []);

  const pinFocusTask = useCallback((input: FocusTaskInput) => {
    const nextFocusTask = mapTaskToFocusTask(input);
    let didHitLimit = false;

    setFocusTasks((currentFocusTasks) => {
      if (currentFocusTasks.some((focusTask) => focusTask.id === nextFocusTask.id)) {
        return currentFocusTasks.map((focusTask) => (
          focusTask.id === nextFocusTask.id ? { ...focusTask, ...nextFocusTask } : focusTask
        ));
      }

      if (currentFocusTasks.length >= maxFocusTasks) {
        didHitLimit = true;
        return currentFocusTasks;
      }

      return [...currentFocusTasks, nextFocusTask];
    });

    if (didHitLimit) {
      setLimitMessage('Focus Dock supports up to 3 active tasks.');
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
    focusTasks: focusTasksWithLiveData,
    activeFocusTask,
    activeFocusTaskId: resolvedActiveFocusTaskId,
    limitMessage,
    maxFocusTasks,
    isFocusTask: (taskId: string) => focusTaskIds.has(taskId),
    pinFocusTask,
    removeFocusTask,
    setActiveFocusTaskId,
    toggleFocusTask,
    updateFocusedTask,
    clearLimitMessage,
  };
}
