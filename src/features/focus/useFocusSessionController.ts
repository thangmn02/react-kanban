import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { notify } from '../../components/organisms/toast/notify';
import { useI18n } from '../../i18n';
import { createActivity } from '../../services/activity.service';
import { fetchDailyFocusStats, logFocusSession } from '../../services/focusSession.service';
import type { BoardRow } from '../../types/supabase.type';
import type { AppUser } from '../../types/auth.type';
import type { BoardData } from '../../types/task.type';
import type {
  DailyFocusStats,
  FocusSessionStatus,
  FocusTask,
  PomodoroMode,
  PomodoroSessionSnapshot,
} from '../../types/focus.type';
import type { StorageScope } from '../../shared/storage/storageAdapter';
import { useFocusTasks } from '../../hooks/useFocusTasks';
import { useFocusTaskHandlers } from '../../hooks/useFocusTaskHandlers';
import { usePomodoroTimer } from '../../hooks/usePomodoroTimer';

const EMPTY_DAILY_STATS: DailyFocusStats = {
  focusedMinutes: 0,
  completedSessions: 0,
  interruptedSessions: 0,
  topTaskTitle: null,
};

interface UseFocusSessionControllerParams {
  user: AppUser | null;
  workspaceId: string | null;
  boardData: BoardData;
  activeBoardId: string | null;
  activeBoardSummary: BoardRow | null;
}

export function useFocusSessionController({
  user,
  workspaceId,
  boardData,
  activeBoardId,
  activeBoardSummary,
}: UseFocusSessionControllerParams) {
  const { t } = useI18n();
  const scope: StorageScope = { userId: user?.id ?? 'mock-user', workspaceId };
  const focusTasksApi = useFocusTasks(boardData, scope);
  const [isFocusDockCollapsed, setIsFocusDockCollapsed] = useState(false);
  const [focusLaunchTaskId, setFocusLaunchTaskId] = useState<string | null>(null);
  const [activeFocusIntention, setActiveFocusIntention] = useState<{
    taskId: string | null;
    text: string;
  } | null>(null);
  const [focusCompletion, setFocusCompletion] = useState<{
    task: FocusTask;
    session: PomodoroSessionSnapshot;
    intention: string;
  } | null>(null);
  const [dailyFocusStats, setDailyFocusStats] = useState<DailyFocusStats>(EMPTY_DAILY_STATS);

  const refreshDailyFocusStats = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      setDailyFocusStats(await fetchDailyFocusStats(workspaceId, user.id));
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Unable to load daily focus stats:', error);
    }
  }, [user, workspaceId]);

  useEffect(() => {
    if (!user) return;
    let isCurrentScope = true;
    void fetchDailyFocusStats(workspaceId, user.id)
      .then((nextStats) => {
        if (isCurrentScope) setDailyFocusStats(nextStats);
      })
      .catch((error) => {
        if (import.meta.env.DEV) console.warn('Unable to load daily focus stats:', error);
      });
    return () => {
      isCurrentScope = false;
    };
  }, [user, workspaceId]);

  const logPomodoro = useCallback(async (
    task: FocusTask | null,
    mode: PomodoroMode,
    status: FocusSessionStatus,
    session: PomodoroSessionSnapshot,
  ) => {
    if (!user || !workspaceId) return;

    await logFocusSession({
      workspaceId,
      boardId: task?.boardId || activeBoardId,
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
  }, [activeBoardId, refreshDailyFocusStats, user, workspaceId]);

  const handlePomodoroComplete = useCallback((
    task: FocusTask | null,
    mode: PomodoroMode,
    session: PomodoroSessionSnapshot,
  ) => {
    const modeLabel = mode === 'focus'
      ? t('focus.mode.focus')
      : mode === 'shortBreak'
        ? t('focus.mode.shortBreak')
        : t('focus.mode.longBreak');
    notify.success(t('toast.focusCompleted', { mode: modeLabel, task: task ? `: ${task.title}` : '' }));

    void logPomodoro(task, mode, 'completed', session)
      .then(() => {
        if (mode === 'focus') notify.success(t('toast.focusSessionLogged'));
      })
      .catch((error) => console.warn('Unable to log focus session:', error));

    if (task && mode === 'focus') {
      const intention = activeFocusIntention?.taskId === task.id ? activeFocusIntention.text : '';
      setFocusCompletion({ task, session, intention });
      setActiveFocusIntention(null);
      void createActivity(task.id, 'update', {
        description: `Completed a ${Math.round(session.durationSeconds / 60)}m focus session`,
        field: 'focusSession',
      }, undefined, undefined, {
        workspaceId,
        boardId: task.boardId,
        actorId: user?.id,
      }).catch((error) => console.warn('Unable to log focus session activity:', error));
    }
  }, [activeFocusIntention, logPomodoro, t, user?.id, workspaceId]);

  const handlePomodoroInterrupt = useCallback((
    task: FocusTask | null,
    mode: PomodoroMode,
    session: PomodoroSessionSnapshot,
  ) => {
    void logPomodoro(task, mode, 'interrupted', session)
      .then(() => notify.info(t('toast.focusSessionInterrupted')))
      .catch((error) => console.warn('Unable to log interrupted focus session:', error));
  }, [logPomodoro, t]);

  const pomodoro = usePomodoroTimer({
    scope,
    activeFocusTask: focusTasksApi.activeFocusTask,
    onComplete: handlePomodoroComplete,
    onInterrupt: handlePomodoroInterrupt,
  });

  const startFocusSessionNow = useCallback((taskId?: string, intention = '') => {
    const nextTaskId = taskId
      || focusTasksApi.activeFocusTaskId
      || focusTasksApi.focusTasks[0]?.id
      || pomodoro.timerState.activeTaskId
      || null;
    if (!nextTaskId) {
      notify.info(t('toast.chooseFocusTaskBeforeTimer'));
      return false;
    }

    focusTasksApi.setActiveFocusTaskId(nextTaskId);
    pomodoro.setActiveTimerTaskId(nextTaskId);
    setIsFocusDockCollapsed(false);
    if (!pomodoro.timerState.startedAt) setActiveFocusIntention({ taskId: nextTaskId, text: intention });
    pomodoro.startTimer(nextTaskId);
    return true;
  }, [focusTasksApi, pomodoro, t]);

  const handleStartFocusTimer = useCallback((taskId?: string) => {
    const nextTaskId = taskId
      || focusTasksApi.activeFocusTaskId
      || focusTasksApi.focusTasks[0]?.id
      || pomodoro.timerState.activeTaskId
      || null;
    if (!nextTaskId) {
      notify.info(t('toast.chooseFocusTaskBeforeTimer'));
      return;
    }
    if (pomodoro.timerState.startedAt || pomodoro.timerState.isRunning) {
      startFocusSessionNow(nextTaskId);
      return;
    }
    setFocusLaunchTaskId(nextTaskId);
  }, [focusTasksApi.activeFocusTaskId, focusTasksApi.focusTasks, pomodoro.timerState, startFocusSessionNow, t]);

  const focusLaunchTask = focusLaunchTaskId
    ? focusTasksApi.focusTasks.find((task) => task.id === focusLaunchTaskId) || null
    : null;
  const closeFocusLaunchpad = useCallback(() => setFocusLaunchTaskId(null), []);
  const confirmFocusLaunch = useCallback((intention: string) => {
    if (!focusLaunchTask) return closeFocusLaunchpad();
    if (startFocusSessionNow(focusLaunchTask.id, intention)) {
      setFocusLaunchTaskId(null);
      notify.success(t('toast.focusStarted', { task: focusLaunchTask.title }));
    }
  }, [closeFocusLaunchpad, focusLaunchTask, startFocusSessionNow, t]);

  const handlers = useFocusTaskHandlers({
    boardData,
    activeBoardId,
    activeBoardSummary,
    focusTasksApi,
    pomodoro: {
      startFocusTimer: handleStartFocusTimer,
      setActiveTimerTaskId: pomodoro.setActiveTimerTaskId,
    },
    setIsFocusDockCollapsed,
  });

  const closeFocusCompletion = useCallback(() => setFocusCompletion(null), []);
  const keepWorkingFromCompletion = useCallback(() => {
    const taskId = focusCompletion?.task.id;
    setFocusCompletion(null);
    if (taskId) setFocusLaunchTaskId(taskId);
  }, [focusCompletion?.task.id]);

  return {
    ...focusTasksApi,
    ...pomodoro,
    ...handlers,
    dailyFocusStats,
    refreshDailyFocusStats,
    isFocusDockCollapsed,
    setIsFocusDockCollapsed,
    focusLaunchTask,
    closeFocusLaunchpad,
    confirmFocusLaunch,
    focusCompletion,
    closeFocusCompletion,
    keepWorkingFromCompletion,
    handleStartFocusTimer,
    startFocusSessionNow,
  };
}

export type FocusSessionValue = ReturnType<typeof useFocusSessionController>;
