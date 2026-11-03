import {
  useCallback,
  useEffect,
  useRef,
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
import { useNextSteps } from './next-steps';
import { recordFirstFocusStart } from './time-to-resume';
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
  const [isFocusDockCollapsed, setIsFocusDockCollapsed] = useState(true);
  // One Next step per task, shared by Focus, session end, Exit Focus and End Day.
  const nextStepStore = useNextSteps(scope);
  const nextSteps = nextStepStore.steps;
  const saveNextStep = nextStepStore.save;
  const clearNextStep = nextStepStore.clear;
  const [focusCompletion, setFocusCompletion] = useState<{
    task: FocusTask;
    session: PomodoroSessionSnapshot;
    intention: string;
  } | null>(null);
  const [dailyFocusStats, setDailyFocusStats] = useState<DailyFocusStats>(EMPTY_DAILY_STATS);
  const userId = user?.id ?? null;
  const focusScopeKey = `${userId ?? 'mock-user'}:${workspaceId ?? 'none'}`;
  const currentFocusScopeKeyRef = useRef(focusScopeKey);
  currentFocusScopeKeyRef.current = focusScopeKey;

  const refreshDailyFocusStats = useCallback(async () => {
    if (!user) {
      return;
    }

    const requestedScopeKey = `${user.id}:${workspaceId ?? 'none'}`;
    try {
      const nextStats = await fetchDailyFocusStats(workspaceId, user.id);
      if (currentFocusScopeKeyRef.current === requestedScopeKey) setDailyFocusStats(nextStats);
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Unable to load daily focus stats:', error);
    }
  }, [user, workspaceId]);

  useEffect(() => {
    setFocusCompletion(null);
    setDailyFocusStats(EMPTY_DAILY_STATS);
    if (!userId) return;
    let isCurrentScope = true;
    void fetchDailyFocusStats(workspaceId, userId)
      .then((nextStats) => {
        if (isCurrentScope) setDailyFocusStats(nextStats);
      })
      .catch((error) => {
        if (import.meta.env.DEV) console.warn('Unable to load daily focus stats:', error);
      });
    return () => {
      isCurrentScope = false;
    };
  }, [focusScopeKey, userId, workspaceId]);

  const logPomodoro = useCallback(async (
    task: FocusTask | null,
    mode: PomodoroMode,
    status: FocusSessionStatus,
    session: PomodoroSessionSnapshot,
  ) => {
    if (!user || !workspaceId) return;

    await logFocusSession({
      sessionId: session.sessionId,
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
      setFocusCompletion({ task, session, intention: nextSteps[task.id]?.text ?? '' });
      void createActivity(task.id, 'update', {
        description: `Completed a ${Math.round(session.durationSeconds / 60)}m focus session`,
        field: 'focusSession',
      }, undefined, undefined, {
        workspaceId,
        boardId: task.boardId,
        actorId: user?.id,
      }).catch((error) => console.warn('Unable to log focus session activity:', error));
    }
  }, [logPomodoro, nextSteps, t, user?.id, workspaceId]);

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
    focusTasks: focusTasksApi.focusTasks,
    onComplete: handlePomodoroComplete,
    onInterrupt: handlePomodoroInterrupt,
  });

  const resolveRunnableTaskId = useCallback((taskId?: string) => {
    if (taskId) {
      return focusTasksApi.focusTasks.find(task=>task.id===taskId)?.isDone ? null : taskId;
    }

    const requestedTaskId = pomodoro.timerState.activeTaskId || focusTasksApi.activeFocusTaskId;
    if (requestedTaskId && focusTasksApi.focusTasks.some((task) => task.id === requestedTaskId && !task.isDone)) {
      return requestedTaskId;
    }

    return focusTasksApi.focusTasks.find((task) => !task.isDone)?.id || null;
  }, [focusTasksApi.activeFocusTaskId, focusTasksApi.focusTasks, pomodoro.timerState.activeTaskId]);

  const startFocusSessionNow = useCallback((taskId?: string, nextStep = '') => {
    const nextTaskId = resolveRunnableTaskId(taskId);
    if (!nextTaskId && (taskId || focusTasksApi.focusTasks.some(task=>task.isDone))) return false;
    if (!nextTaskId) {
      // A Pomodoro can run without a task. Keep the same timer, persistence,
      // completion and logging path rather than fabricating a focus task.
      setIsFocusDockCollapsed(false);
      pomodoro.startTimer();
      return true;
    }

    focusTasksApi.setActiveFocusTaskId(nextTaskId);
    setIsFocusDockCollapsed(false);
    if (nextStep) saveNextStep(nextTaskId, nextStep);
    recordFirstFocusStart(Boolean(nextSteps[nextTaskId]?.pausedAt));
    pomodoro.startTimer(nextTaskId);
    return true;
  }, [focusTasksApi, nextSteps, pomodoro, resolveRunnableTaskId, saveNextStep]);

  const handleStartFocusTimer = useCallback((taskId?: string, nextStep = '') => {
    const nextTaskId = resolveRunnableTaskId(taskId);
    if (taskId && !nextTaskId) return;
    if (!nextTaskId) {
      startFocusSessionNow();
      return;
    }
    // One click: no launchpad. The timer keeps the mode and durations chosen last time (Dock settings change them).
    const resuming = pomodoro.timerState.activeTaskId === nextTaskId && (pomodoro.timerState.startedAt || pomodoro.timerState.isRunning);
    // A suggested step (for example from an AI breakdown) is focus work, even if a break was selected.
    if (nextStep && pomodoro.timerState.mode !== 'focus') pomodoro.setMode('focus');
    if (startFocusSessionNow(nextTaskId, nextStep) && !resuming) {
      const title = focusTasksApi.focusTasks.find(task => task.id === nextTaskId)?.title;
      if (title) notify.success(t('toast.focusStarted', { task: title }));
    }
  }, [focusTasksApi.focusTasks, pomodoro, resolveRunnableTaskId, startFocusSessionNow, t]);

  const handlers = useFocusTaskHandlers({
    boardData,
    activeBoardId,
    activeBoardSummary,
    focusTasksApi,
    pomodoro: {
      startFocusTimer: handleStartFocusTimer,
    },
    setIsFocusDockCollapsed,
  });

  const closeFocusCompletion = useCallback(() => setFocusCompletion(null), []);
  const keepWorkingFromCompletion = useCallback(() => {
    const taskId = focusCompletion?.task.id;
    setFocusCompletion(null);
    if (taskId) {
      pomodoro.setMode('focus');
      startFocusSessionNow(taskId);
    }
  }, [focusCompletion?.task.id, pomodoro, startFocusSessionNow]);

  return {
    ...focusTasksApi,
    ...pomodoro,
    ...handlers,
    dailyFocusStats,
    nextSteps,
    saveNextStep,
    clearNextStep,
    refreshDailyFocusStats,
    isFocusDockCollapsed,
    setIsFocusDockCollapsed,
    focusCompletion,
    closeFocusCompletion,
    keepWorkingFromCompletion,
    handleStartFocusTimer,
    startFocusSessionNow,
  };
}

export type FocusSessionValue = ReturnType<typeof useFocusSessionController>;
