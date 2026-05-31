import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  FocusTask,
  PomodoroMode,
  PomodoroSessionSnapshot,
  PomodoroTimerState,
} from '../types/focus.type';
import { formatPomodoroTime, POMODORO_MODE_SECONDS } from '../utils/pomodoroTime';

const pomodoroStorageKey = 'kanban_pomodoro_timer';

function createInitialPomodoroState(): PomodoroTimerState {
  return {
    mode: 'focus',
    activeTaskId: null,
    isRunning: false,
    remainingSeconds: POMODORO_MODE_SECONDS.focus,
    endsAt: null,
    startedAt: null,
    plannedSeconds: null,
  };
}

function readStoredPomodoroState(): PomodoroTimerState {
  if (typeof window === 'undefined') {
    return createInitialPomodoroState();
  }

  try {
    const storedValue = window.localStorage.getItem(pomodoroStorageKey);
    return storedValue
      ? {
        ...createInitialPomodoroState(),
        ...JSON.parse(storedValue) as Partial<PomodoroTimerState>,
      }
      : createInitialPomodoroState();
  } catch {
    return createInitialPomodoroState();
  }
}

function getRemainingSeconds(state: PomodoroTimerState) {
  if (!state.isRunning || !state.endsAt) {
    return state.remainingSeconds;
  }

  return Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
}

interface UsePomodoroTimerParams {
  activeFocusTask: FocusTask | null;
  onComplete?: (task: FocusTask | null, mode: PomodoroMode, session: PomodoroSessionSnapshot) => void;
  onInterrupt?: (task: FocusTask | null, mode: PomodoroMode, session: PomodoroSessionSnapshot) => void;
}

function buildSessionSnapshot(state: PomodoroTimerState, endedAt: number): PomodoroSessionSnapshot | null {
  if (!state.startedAt || !state.plannedSeconds) {
    return null;
  }

  return {
    startedAt: state.startedAt,
    endedAt,
    durationSeconds: Math.max(0, Math.round((endedAt - state.startedAt) / 1000)),
    plannedSeconds: state.plannedSeconds,
  };
}

export function usePomodoroTimer({ activeFocusTask, onComplete, onInterrupt }: UsePomodoroTimerParams) {
  const [timerState, setTimerState] = useState<PomodoroTimerState>(readStoredPomodoroState);
  const [visibleRemainingSeconds, setVisibleRemainingSeconds] = useState(() => (
    getRemainingSeconds(readStoredPomodoroState())
  ));
  const [isPageHidden, setIsPageHidden] = useState(() => (
    typeof document !== 'undefined' ? document.hidden : false
  ));
  const completionKeyRef = useRef<string | null>(null);
  const originalDocumentTitleRef = useRef<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(pomodoroStorageKey, JSON.stringify({
      ...timerState,
      remainingSeconds: getRemainingSeconds(timerState),
    }));
  }, [timerState]);

  useEffect(() => {
    const updateRemainingTime = () => {
      const nextRemainingSeconds = getRemainingSeconds(timerState);
      setVisibleRemainingSeconds(nextRemainingSeconds);

      if (timerState.isRunning && nextRemainingSeconds === 0) {
        const completionKey = `${timerState.activeTaskId || 'none'}-${timerState.mode}-${timerState.endsAt || 'none'}`;
        const endedAt = Date.now();
        const sessionSnapshot = buildSessionSnapshot(timerState, endedAt);

        if (completionKeyRef.current !== completionKey && sessionSnapshot) {
          completionKeyRef.current = completionKey;
          onComplete?.(activeFocusTask, timerState.mode, {
            ...sessionSnapshot,
            durationSeconds: timerState.plannedSeconds || sessionSnapshot.durationSeconds,
          });
        }

        setTimerState((currentState) => ({
          ...currentState,
          isRunning: false,
          remainingSeconds: POMODORO_MODE_SECONDS[currentState.mode],
          endsAt: null,
          startedAt: null,
          plannedSeconds: null,
        }));
      }
    };

    updateRemainingTime();
    const intervalId = window.setInterval(updateRemainingTime, 1000);

    return () => window.clearInterval(intervalId);
  }, [activeFocusTask, onComplete, timerState]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      setIsPageHidden(document.hidden);
      setVisibleRemainingSeconds(getRemainingSeconds(timerState));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [timerState]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (originalDocumentTitleRef.current === null) {
      originalDocumentTitleRef.current = document.title;
    }

    if (timerState.isRunning && isPageHidden) {
      document.title = `${formatPomodoroTime(visibleRemainingSeconds)} - ${activeFocusTask?.title || 'Focus session'}`;
      return;
    }

    document.title = originalDocumentTitleRef.current;
  }, [activeFocusTask?.title, isPageHidden, timerState.isRunning, visibleRemainingSeconds]);

  const selectedTimerTask = useMemo(() => (
    activeFocusTask?.id === timerState.activeTaskId ? activeFocusTask : null
  ), [activeFocusTask, timerState.activeTaskId]);

  const startTimer = useCallback((taskId?: string) => {
    setTimerState((currentState) => {
      const remainingSeconds = getRemainingSeconds(currentState);

      return {
        ...currentState,
        activeTaskId: taskId || currentState.activeTaskId || activeFocusTask?.id || null,
        isRunning: true,
        remainingSeconds,
        endsAt: Date.now() + remainingSeconds * 1000,
        startedAt: currentState.startedAt || Date.now(),
        plannedSeconds: currentState.plannedSeconds || remainingSeconds,
      };
    });
  }, [activeFocusTask?.id]);

  const pauseTimer = useCallback(() => {
    setTimerState((currentState) => ({
      ...currentState,
      isRunning: false,
      remainingSeconds: getRemainingSeconds(currentState),
      endsAt: null,
    }));
  }, []);

  const resetTimer = useCallback(() => {
    setTimerState((currentState) => {
      const sessionSnapshot = buildSessionSnapshot(currentState, Date.now());

      if (currentState.isRunning && sessionSnapshot && sessionSnapshot.durationSeconds > 60) {
        onInterrupt?.(activeFocusTask, currentState.mode, sessionSnapshot);
      }

      return {
        ...currentState,
        isRunning: false,
        remainingSeconds: POMODORO_MODE_SECONDS[currentState.mode],
        endsAt: null,
        startedAt: null,
        plannedSeconds: null,
      };
    });
  }, [activeFocusTask, onInterrupt]);

  const setMode = useCallback((mode: PomodoroMode) => {
    setTimerState((currentState) => ({
      ...currentState,
      mode,
      isRunning: false,
      remainingSeconds: POMODORO_MODE_SECONDS[mode],
      endsAt: null,
      startedAt: null,
      plannedSeconds: null,
    }));
  }, []);

  const setActiveTimerTaskId = useCallback((taskId: string) => {
    setTimerState((currentState) => ({
      ...currentState,
      activeTaskId: taskId,
    }));
  }, []);

  return {
    timerState,
    selectedTimerTask,
    remainingSeconds: visibleRemainingSeconds,
    startTimer,
    pauseTimer,
    resetTimer,
    setMode,
    setActiveTimerTaskId,
  };
}
