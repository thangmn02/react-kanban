import { useCallback } from 'react';
import { toast } from 'react-toastify';

import { FOCUS_LIMIT_MESSAGE } from '../constants';
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
    startTimer: (taskId?: string) => void;
    setActiveTimerTaskId: (taskId: string) => void;
  };
  setIsFocusDockCollapsed: (value: boolean) => void;
}

export interface UseFocusTaskHandlersResult {
  handleToggleFocusTask: (task: ITaskItem) => void;
  handleToggleFocusTaskFromHome: (taskSummary: HomeTaskSummary) => void;
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
  const { toggleFocusTask, pinFocusTask, isFocusTask, setActiveFocusTaskId } = focusTasksApi;
  const { startTimer, setActiveTimerTaskId } = pomodoro;

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
      toast.error('Board is not ready yet.', { theme: 'colored' });
      return null;
    }

    const listContext = getTaskListContext(task.id);

    return {
      task,
      boardId: activeBoardId,
      boardTitle: activeBoardSummary?.title || 'Untitled board',
      ...listContext,
    };
  }, [activeBoardId, activeBoardSummary?.title, getTaskListContext]);

  const handleToggleFocusTask = useCallback((task: ITaskItem) => {
    const focusTaskInput = buildFocusTaskInput(task);

    if (!focusTaskInput) {
      return;
    }

    const didToggle = toggleFocusTask(focusTaskInput);

    if (!didToggle) {
      toast.info(FOCUS_LIMIT_MESSAGE, { theme: 'colored' });
    }
  }, [buildFocusTaskInput, toggleFocusTask]);

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
      toast.info(FOCUS_LIMIT_MESSAGE, { theme: 'colored' });
    }
  }, [boardData.task, getTaskListContext, toggleFocusTask]);

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
      toast.info(FOCUS_LIMIT_MESSAGE, { theme: 'colored' });
    }
  }, [buildFocusTaskInputFromTodayTask, toggleFocusTask]);

  const handleStartFocusTaskFromToday = useCallback((taskSummary: TodayTaskSummary) => {
    if (!isFocusTask(taskSummary.id)) {
      const didPinTask = pinFocusTask(buildFocusTaskInputFromTodayTask(taskSummary));

      if (!didPinTask) {
        toast.info(FOCUS_LIMIT_MESSAGE, { theme: 'colored' });
        return;
      }
    }

    setActiveFocusTaskId(taskSummary.id);
    setActiveTimerTaskId(taskSummary.id);
    setIsFocusDockCollapsed(false);
    startTimer(taskSummary.id);
    toast.success(`Focus started: ${taskSummary.title}`, { theme: 'colored' });
  }, [
    buildFocusTaskInputFromTodayTask,
    isFocusTask,
    pinFocusTask,
    setActiveFocusTaskId,
    setActiveTimerTaskId,
    setIsFocusDockCollapsed,
    startTimer,
  ]);

  return {
    handleToggleFocusTask,
    handleToggleFocusTaskFromHome,
    handleToggleFocusTaskFromToday,
    handleStartFocusTaskFromToday,
  };
}
