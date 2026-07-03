import { useCallback } from 'react';
import { notify } from '../components/organisms/toast/notify';

import { useI18n } from '../i18n';
import type { BoardData, ITaskItem } from '../types/task.type';
import type { FocusTaskInput } from '../types/focus.type';
import type { BoardRow } from '../types/supabase.type';
import type { HomeTaskSummary } from '../services/home.service';
import type { TodayTaskSummary } from '../services/today.service';
import type { useFocusTasks } from './useFocusTasks';

export interface UseFocusTaskHandlersParams {
  boardData: BoardData;
  activeBoardId: string | null;
  activeBoardSummary: BoardRow | null;
  focusTasksApi: Pick<
    ReturnType<typeof useFocusTasks>,
    'toggleFocusTask' | 'pinFocusTask' | 'isFocusTask' | 'setActiveFocusTaskId'
  >;
  pomodoro: {
    startFocusTimer: (taskId?: string) => void;
    setActiveTimerTaskId: (taskId: string) => void;
  };
  setIsFocusDockCollapsed: (value: boolean) => void;
}

export interface UseFocusTaskHandlersResult {
  handleToggleFocusTask: (task: ITaskItem) => void;
  handleStartFocusTask: (task: ITaskItem) => void;
  handleToggleFocusTaskFromHome: (taskSummary: HomeTaskSummary) => void;
  handleStartFocusTaskFromHome: (taskSummary: HomeTaskSummary) => void;
  handleToggleFocusTaskFromToday: (taskSummary: TodayTaskSummary) => void;
  handleStartFocusTaskFromToday: (taskSummary: TodayTaskSummary) => void;
}

export function useFocusTaskHandlers({
  boardData,
  activeBoardId,
  activeBoardSummary,
  focusTasksApi,
  pomodoro,
  setIsFocusDockCollapsed,
}: UseFocusTaskHandlersParams): UseFocusTaskHandlersResult {
  const { t } = useI18n();
  const { toggleFocusTask, pinFocusTask, isFocusTask, setActiveFocusTaskId } = focusTasksApi;
  const { startFocusTimer, setActiveTimerTaskId } = pomodoro;

  const getTaskListContext = useCallback((taskId: string) => {
    const listId = boardData.columns.find((columnId) => (
      boardData.list[columnId]?.tasks.includes(taskId)
    ));
    const listItem = listId ? boardData.list[listId] : undefined;

    return {
      listId,
      listTitle: listItem?.title,
    };
  }, [boardData]);

  const buildFocusTaskInput = useCallback((task: ITaskItem): FocusTaskInput | null => {
    if (!activeBoardId) {
      notify.error(t('toast.boardNotReady'));
      return null;
    }

    const listContext = getTaskListContext(task.id);

    return {
      task,
      boardId: activeBoardId,
      boardTitle: activeBoardSummary?.title || t('common.untitledBoard'),
      ...listContext,
    };
  }, [activeBoardId, activeBoardSummary?.title, getTaskListContext, t]);

  const handleToggleFocusTask = useCallback((task: ITaskItem) => {
    const focusTaskInput = buildFocusTaskInput(task);

    if (!focusTaskInput) {
      return;
    }

    const didToggle = toggleFocusTask(focusTaskInput);

    if (!didToggle) {
      notify.info(t('focus.limit.message'));
    }
  }, [buildFocusTaskInput, t, toggleFocusTask]);

  const handleStartFocusTask = useCallback((task: ITaskItem) => {
    const focusTaskInput = buildFocusTaskInput(task);

    if (!focusTaskInput) {
      return;
    }

    if (!isFocusTask(task.id)) {
      const didPinTask = pinFocusTask(focusTaskInput);

      if (!didPinTask) {
        notify.info(t('focus.limit.message'));
        return;
      }
    }

    setActiveFocusTaskId(task.id);
    setActiveTimerTaskId(task.id);
    setIsFocusDockCollapsed(false);
    startFocusTimer(task.id);
  }, [
    buildFocusTaskInput,
    isFocusTask,
    pinFocusTask,
    setActiveFocusTaskId,
    setActiveTimerTaskId,
    setIsFocusDockCollapsed,
    startFocusTimer,
    t,
  ]);

  const handleToggleFocusTaskFromHome = useCallback((taskSummary: HomeTaskSummary) => {
    const liveTask = boardData.task[taskSummary.id];
    const fallbackTask: ITaskItem = liveTask || {
      id: taskSummary.id,
      title: taskSummary.title,
      description: '',
      assignees: taskSummary.assigneeAvatar ? [{ name: 'Assignee', avatar: taskSummary.assigneeAvatar }] : [],
      priority: taskSummary.priority || undefined,
      dueDate: taskSummary.dueDate || undefined,
      labels: [],
      attachments: [],
      checklistItems: [],
      isDone: false,
    };
    const listContext = liveTask ? getTaskListContext(liveTask.id) : {};
    const didToggle = toggleFocusTask({
      task: fallbackTask,
      boardId: taskSummary.boardId,
      boardTitle: taskSummary.boardTitle,
      ...listContext,
    });

    if (!didToggle) {
      notify.info(t('focus.limit.message'));
    }
  }, [boardData.task, getTaskListContext, t, toggleFocusTask]);

  const handleStartFocusTaskFromHome = useCallback((taskSummary: HomeTaskSummary) => {
    const liveTask = boardData.task[taskSummary.id];
    const fallbackTask: ITaskItem = liveTask || {
      id: taskSummary.id,
      title: taskSummary.title,
      description: '',
      assignees: taskSummary.assigneeAvatar ? [{ name: 'Assignee', avatar: taskSummary.assigneeAvatar }] : [],
      priority: taskSummary.priority || undefined,
      dueDate: taskSummary.dueDate || undefined,
      labels: [],
      attachments: [],
      checklistItems: [],
      isDone: false,
    };
    const listContext = liveTask ? getTaskListContext(liveTask.id) : {};

    if (!isFocusTask(taskSummary.id)) {
      const didPinTask = pinFocusTask({
        task: fallbackTask,
        boardId: taskSummary.boardId,
        boardTitle: taskSummary.boardTitle,
        ...listContext,
      });

      if (!didPinTask) {
        notify.info(t('focus.limit.message'));
        return;
      }
    }

    setActiveFocusTaskId(taskSummary.id);
    setActiveTimerTaskId(taskSummary.id);
    setIsFocusDockCollapsed(false);
    startFocusTimer(taskSummary.id);
  }, [
    boardData.task,
    getTaskListContext,
    isFocusTask,
    pinFocusTask,
    setActiveFocusTaskId,
    setActiveTimerTaskId,
    setIsFocusDockCollapsed,
    startFocusTimer,
    t,
  ]);

  const buildFocusTaskInputFromTodayTask = useCallback((taskSummary: TodayTaskSummary): FocusTaskInput => {
    const liveTask = boardData.task[taskSummary.id];
    const fallbackTask: ITaskItem = liveTask || {
      id: taskSummary.id,
      title: taskSummary.title,
      description: taskSummary.description,
      assignees: taskSummary.assigneeAvatar ? [{ name: 'Assignee', avatar: taskSummary.assigneeAvatar }] : [],
      priority: taskSummary.priority || undefined,
      dueDate: taskSummary.dueDate || undefined,
      labels: [],
      attachments: [],
      checklistItems: [],
      isDone: taskSummary.isDone,
    };
    const listContext = liveTask ? getTaskListContext(liveTask.id) : {
      listId: taskSummary.listId,
      listTitle: taskSummary.listTitle,
    };

    return {
      task: fallbackTask,
      boardId: taskSummary.boardId,
      boardTitle: taskSummary.boardTitle,
      ...listContext,
    };
  }, [boardData.task, getTaskListContext]);

  const handleToggleFocusTaskFromToday = useCallback((taskSummary: TodayTaskSummary) => {
    const didToggle = toggleFocusTask(buildFocusTaskInputFromTodayTask(taskSummary));

    if (!didToggle) {
      notify.info(t('focus.limit.message'));
    }
  }, [buildFocusTaskInputFromTodayTask, t, toggleFocusTask]);

  const handleStartFocusTaskFromToday = useCallback((taskSummary: TodayTaskSummary) => {
    if (!isFocusTask(taskSummary.id)) {
      const didPinTask = pinFocusTask(buildFocusTaskInputFromTodayTask(taskSummary));

      if (!didPinTask) {
        notify.info(t('focus.limit.message'));
        return;
      }
    }

    setActiveFocusTaskId(taskSummary.id);
    setActiveTimerTaskId(taskSummary.id);
    setIsFocusDockCollapsed(false);
    startFocusTimer(taskSummary.id);
  }, [
    buildFocusTaskInputFromTodayTask,
    isFocusTask,
    pinFocusTask,
    setActiveFocusTaskId,
    setActiveTimerTaskId,
    setIsFocusDockCollapsed,
    startFocusTimer,
    t,
  ]);

  return {
    handleToggleFocusTask,
    handleStartFocusTask,
    handleToggleFocusTaskFromHome,
    handleStartFocusTaskFromHome,
    handleToggleFocusTaskFromToday,
    handleStartFocusTaskFromToday,
  };
}
