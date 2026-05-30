import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { FocusTask, PomodoroMode, PomodoroTimerState } from '../types/focus.type';
import { POMODORO_MODE_SECONDS, formatPomodoroTime } from '../utils/pomodoroTime';

const pomodoroStorageKey = 'kanban_pomodoro_timer';

function createInitialPomodoroState(): PomodoroTimerState {
  return {
    mode: 'focus',
    activeTaskId: null,
    isRunning: false,
    remainingSeconds: POMODORO_MODE_SECONDS.focus,
    endsAt: null,
  };
}

function readStoredPomodoroState(): PomodoroTimerState {
  if (typeof window === 'undefined') {
    return createInitialPomodoroState();
  }

  try {
    const storedValue = window.localStorage.getItem(pomodoroStorageKey);
    return storedValue ? {
      ...createInitialPomodoroState(),
      ...JSON.parse(storedValue) as Partial<PomodoroTimerState>,
    } : createInitialPomodoroState();
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
  onComplete?: (task: FocusTask | null, mode: PomodoroMode) => void;
}

export function usePomodoroTimer({ activeFocusTask, onComplete }: UsePomodoroTimerParams) {
  const [timerState, setTimerState] = useState<PomodoroTimerState>(readStoredPomodoroState);
  const [visibleRemainingSeconds, setVisibleRemainingSeconds] = useState(() => (
    getRemainingSeconds(readStoredPomodoroState())
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

        if (completionKeyRef.current !== completionKey) {
          completionKeyRef.current = completionKey;
          onComplete?.(activeFocusTask, timerState.mode);
        }

        setTimerState((currentState) => ({
          ...currentState,
          isRunning: false,
          remainingSeconds: POMODORO_MODE_SECONDS[currentState.mode],
          endsAt: null,
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

    if (originalDocumentTitleRef.current === null) {
      originalDocumentTitleRef.current = document.title;
    }

    if (timerState.isRunning) {
      document.title = `${formatPomodoroTime(visibleRemainingSeconds)} · ${activeFocusTask?.title || 'Focus session'}`;
      return;
    }

    document.title = originalDocumentTitleRef.current;
  }, [activeFocusTask?.title, timerState.isRunning, visibleRemainingSeconds]);

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
    setTimerState((currentState) => ({
      ...currentState,
      isRunning: false,
      remainingSeconds: POMODORO_MODE_SECONDS[currentState.mode],
      endsAt: null,
    }));
  }, []);

  const setMode = useCallback((mode: PomodoroMode) => {
    setTimerState((currentState) => ({
      ...currentState,
      mode,
      isRunning: false,
      remainingSeconds: POMODORO_MODE_SECONDS[mode],
      endsAt: null,
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
