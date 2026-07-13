import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  FocusTask,
  PomodoroMode,
  PomodoroSessionSnapshot,
  PomodoroTimerState,
} from '../types/focus.type';
import { formatPomodoroTime, POMODORO_MODE_SECONDS } from '../utils/pomodoroTime';
import { buildStorageKey, readScopedJSON, writeScopedJSON, type StorageScope } from '../shared/storage/storageAdapter';

const pomodoroStorageFeature = 'pomodoro_timer';
const legacyPomodoroStorageKey = 'kanban_pomodoro_timer';

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

function readStoredPomodoroState(scope: StorageScope): PomodoroTimerState {
  const scopedState = readScopedJSON<Partial<PomodoroTimerState> | null>(scope, pomodoroStorageFeature, null);
  if (scopedState) {
    return { ...createInitialPomodoroState(), ...scopedState };
  }

  if (typeof window !== 'undefined') {
    try {
      const legacyValue = window.localStorage.getItem(legacyPomodoroStorageKey);
      if (legacyValue) {
        const migratedState = {
          ...createInitialPomodoroState(),
          ...JSON.parse(legacyValue) as Partial<PomodoroTimerState>,
        };
        writeScopedJSON(scope, pomodoroStorageFeature, migratedState);
        window.localStorage.removeItem(legacyPomodoroStorageKey);
        return migratedState;
      }
    } catch {
      window.localStorage.removeItem(legacyPomodoroStorageKey);
    }
  }

  return createInitialPomodoroState();
}

function getRemainingSeconds(state: PomodoroTimerState) {
  if (!state.isRunning || !state.endsAt) {
    return state.remainingSeconds;
  }

  return Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
}

interface UsePomodoroTimerParams {
  scope: StorageScope;
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

export function usePomodoroTimer({ scope, activeFocusTask, onComplete, onInterrupt }: UsePomodoroTimerParams) {
  const scopeKey = buildStorageKey(scope, pomodoroStorageFeature);
  const [scopedTimer, setScopedTimer] = useState(() => ({ scopeKey, scope, state: readStoredPomodoroState(scope) }));
  const timerState = scopedTimer.scopeKey === scopeKey ? scopedTimer.state : readStoredPomodoroState(scope);
  const [visibleRemainingSeconds, setVisibleRemainingSeconds] = useState(() => getRemainingSeconds(timerState));
  const [isPageHidden, setIsPageHidden] = useState(() => (
    typeof document !== 'undefined' ? document.hidden : false
  ));
  const completionKeyRef = useRef<string | null>(null);
  const originalDocumentTitleRef = useRef<string | null>(null);

  if (scopedTimer.scopeKey !== scopeKey) {
    const nextState = readStoredPomodoroState(scope);
    setScopedTimer({ scopeKey, scope, state: nextState });
    setVisibleRemainingSeconds(getRemainingSeconds(nextState));
  }

  const setTimerState = useCallback((updater: React.SetStateAction<PomodoroTimerState>) => {
    setScopedTimer((current) => ({
      ...current,
      state: typeof updater === 'function' ? updater(current.state) : updater,
    }));
  }, []);

  useEffect(() => {
    writeScopedJSON(scopedTimer.scope, pomodoroStorageFeature, {
      ...scopedTimer.state,
      remainingSeconds: getRemainingSeconds(scopedTimer.state),
    });
  }, [scopedTimer.scope, scopedTimer.state]);

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
  }, [activeFocusTask, onComplete, setTimerState, timerState]);

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
  }, [activeFocusTask?.id, setTimerState]);

  const pauseTimer = useCallback(() => {
    setTimerState((currentState) => ({
      ...currentState,
      isRunning: false,
      remainingSeconds: getRemainingSeconds(currentState),
      endsAt: null,
    }));
  }, [setTimerState]);

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
  }, [activeFocusTask, onInterrupt, setTimerState]);

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
  }, [setTimerState]);

  const setActiveTimerTaskId = useCallback((taskId: string) => {
    setTimerState((currentState) => ({
      ...currentState,
      activeTaskId: taskId,
    }));
  }, [setTimerState]);

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
