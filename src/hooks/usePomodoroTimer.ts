import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  FocusTask,
  PomodoroMode,
  PomodoroSessionSnapshot,
  PomodoroTimerSettings,
  PomodoroTimerState,
} from '../types/focus.type';
import {
  DEFAULT_POMODORO_TIMER_SETTINGS,
  formatPomodoroTime,
  getPomodoroModeSeconds,
  sanitizePomodoroTimerSettings,
} from '../utils/pomodoroTime';
import { buildStorageKey, readScopedJSON, writeScopedJSON, type StorageScope } from '../shared/storage/storageAdapter';
import { isNativeWidget } from '../features/native/runtime';
import { listen } from '@tauri-apps/api/event';

const pomodoroStorageFeature = 'pomodoro_timer';
const pomodoroSettingsFeature = 'pomodoro_settings';
const legacyPomodoroStorageKey = 'kanban_pomodoro_timer';

function createInitialPomodoroState(
  settings: PomodoroTimerSettings = DEFAULT_POMODORO_TIMER_SETTINGS,
): PomodoroTimerState {
  return {
    mode: 'focus',
    activeTaskId: null,
    sessionTask: null,
    sessionId: null,
    isRunning: false,
    remainingSeconds: getPomodoroModeSeconds('focus', settings),
    endsAt: null,
    startedAt: null,
    plannedSeconds: null,
    completedCycleFocus: 0,
  };
}

function readStoredPomodoroState(scope: StorageScope, settings: PomodoroTimerSettings): PomodoroTimerState {
  const scopedState = readScopedJSON<Partial<PomodoroTimerState> | null>(scope, pomodoroStorageFeature, null);
  if (scopedState) {
    return normalizePomodoroState(scopedState, settings);
  }

  if (typeof window !== 'undefined') {
    try {
      const legacyValue = window.localStorage.getItem(legacyPomodoroStorageKey);
      if (legacyValue) {
        const migratedState = normalizePomodoroState(
          JSON.parse(legacyValue) as Partial<PomodoroTimerState>,
          settings,
        );
        writeScopedJSON(scope, pomodoroStorageFeature, migratedState);
        window.localStorage.removeItem(legacyPomodoroStorageKey);
        return migratedState;
      }
    } catch {
      window.localStorage.removeItem(legacyPomodoroStorageKey);
    }
  }

  return createInitialPomodoroState(settings);
}

function readStoredPomodoroSettings(scope: StorageScope): PomodoroTimerSettings {
  return sanitizePomodoroTimerSettings(
    readScopedJSON<Partial<PomodoroTimerSettings> | null>(scope, pomodoroSettingsFeature, null),
  );
}

function normalizePomodoroState(
  storedState: Partial<PomodoroTimerState>,
  settings: PomodoroTimerSettings,
): PomodoroTimerState {
  const mode: PomodoroMode = storedState.mode === 'shortBreak' || storedState.mode === 'longBreak'
    ? storedState.mode
    : 'focus';
  const defaultSeconds = getPomodoroModeSeconds(mode, settings);
  const remainingSeconds = Number.isFinite(storedState.remainingSeconds) && storedState.remainingSeconds! >= 0
    ? Math.round(storedState.remainingSeconds!)
    : defaultSeconds;
  const endsAt = Number.isFinite(storedState.endsAt) && storedState.endsAt! > 0 ? storedState.endsAt! : null;
  const startedAt = Number.isFinite(storedState.startedAt) && storedState.startedAt! > 0 ? storedState.startedAt! : null;
  const plannedSeconds = Number.isFinite(storedState.plannedSeconds) && storedState.plannedSeconds! > 0
    ? Math.round(storedState.plannedSeconds!)
    : null;
  const isRunning = storedState.isRunning === true && endsAt !== null && startedAt !== null && plannedSeconds !== null;
  const sessionId = typeof storedState.sessionId === 'string'
    ? storedState.sessionId
    : startedAt && plannedSeconds ? createSessionId() : null;

  return {
    mode,
    activeTaskId: typeof storedState.activeTaskId === 'string' ? storedState.activeTaskId : null,
    sessionTask: storedState.sessionTask && typeof storedState.sessionTask.id === 'string'
      ? storedState.sessionTask
      : null,
    sessionId,
    isRunning,
    remainingSeconds,
    endsAt: isRunning ? endsAt : null,
    startedAt,
    plannedSeconds,
    completedCycleFocus: Number.isFinite(storedState.completedCycleFocus)
      ? Math.max(0, Math.floor(storedState.completedCycleFocus!))
      : 0,
  };
}

function getRemainingSeconds(state: PomodoroTimerState) {
  if (!state.isRunning || !state.endsAt) {
    return state.remainingSeconds;
  }

  return Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
}

function createSessionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
      const randomValue = Math.floor(Math.random() * 16);
      return (character === 'x' ? randomValue : (randomValue & 0x3) | 0x8).toString(16);
    });
}

interface UsePomodoroTimerParams {
  scope: StorageScope;
  activeFocusTask: FocusTask | null;
  focusTasks?: FocusTask[];
  onComplete?: (task: FocusTask | null, mode: PomodoroMode, session: PomodoroSessionSnapshot) => void;
  onInterrupt?: (task: FocusTask | null, mode: PomodoroMode, session: PomodoroSessionSnapshot) => void;
}

function buildSessionSnapshot(state: PomodoroTimerState, endedAt: number): PomodoroSessionSnapshot | null {
  if (!state.sessionId || !state.startedAt || !state.plannedSeconds) {
    return null;
  }

  return {
    sessionId: state.sessionId,
    startedAt: state.startedAt,
    endedAt,
    durationSeconds: Math.max(0, state.plannedSeconds - getRemainingSeconds(state)),
    plannedSeconds: state.plannedSeconds,
  };
}

export function usePomodoroTimer({
  scope,
  activeFocusTask,
  focusTasks = [],
  onComplete,
  onInterrupt,
}: UsePomodoroTimerParams) {
  const scopeKey = buildStorageKey(scope, pomodoroStorageFeature);
  const [scopedSettings, setScopedSettings] = useState(() => ({
    scopeKey,
    scope,
    settings: readStoredPomodoroSettings(scope),
  }));
  const timerSettings = scopedSettings.scopeKey === scopeKey
    ? scopedSettings.settings
    : readStoredPomodoroSettings(scope);
  const settingsRef = useRef(timerSettings);
  settingsRef.current = timerSettings;
  const [scopedTimer, setScopedTimer] = useState(() => ({
    scopeKey,
    scope,
    state: readStoredPomodoroState(scope, timerSettings),
  }));
  const timerState = scopedTimer.scopeKey === scopeKey
    ? scopedTimer.state
    : readStoredPomodoroState(scope, timerSettings);
  const [visibleRemainingSeconds, setVisibleRemainingSeconds] = useState(() => getRemainingSeconds(timerState));
  const [isPageHidden, setIsPageHidden] = useState(() => (
    typeof document !== 'undefined' ? document.hidden : false
  ));
  const completionKeyRef = useRef<string | null>(null);
  const originalDocumentTitleRef = useRef<string | null>(null);
  const timerStateRef = useRef(timerState);
  timerStateRef.current = timerState;

  if (scopedSettings.scopeKey !== scopeKey) {
    setScopedSettings({ scopeKey, scope, settings: timerSettings });
  }

  if (scopedTimer.scopeKey !== scopeKey) {
    const nextState = readStoredPomodoroState(scope, timerSettings);
    setScopedTimer({ scopeKey, scope, state: nextState });
    setVisibleRemainingSeconds(getRemainingSeconds(nextState));
  }

  const setTimerState = useCallback((updater: React.SetStateAction<PomodoroTimerState>) => {
    setScopedTimer((current) => ({
      ...current,
      state: typeof updater === 'function' ? updater(current.state) : updater,
    }));
  }, []);

  const commitTimerState = useCallback((nextState: PomodoroTimerState) => {
    timerStateRef.current = nextState;
    setTimerState(nextState);
    setVisibleRemainingSeconds(getRemainingSeconds(nextState));
  }, [setTimerState]);

  const resolveTimerTask = useCallback((state: Pick<PomodoroTimerState, 'activeTaskId' | 'sessionTask'>) => (
    focusTasks.find((task) => task.id === state.activeTaskId)
      || (activeFocusTask?.id === state.activeTaskId ? activeFocusTask : null)
      || (state.sessionTask?.id === state.activeTaskId ? state.sessionTask : null)
  ), [activeFocusTask, focusTasks]);

  const reportInterruption = useCallback((state: PomodoroTimerState, endedAt: number) => {
    const sessionSnapshot = buildSessionSnapshot(state, endedAt);
    if (sessionSnapshot && sessionSnapshot.durationSeconds > 60) {
      onInterrupt?.(resolveTimerTask(state), state.mode, sessionSnapshot);
    }
  }, [onInterrupt, resolveTimerTask]);

  useEffect(() => {
    writeScopedJSON(scopedSettings.scope, pomodoroSettingsFeature, scopedSettings.settings);
  }, [scopedSettings.scope, scopedSettings.settings]);

  useEffect(() => {
    writeScopedJSON(scopedTimer.scope, pomodoroStorageFeature, {
      ...scopedTimer.state,
      remainingSeconds: getRemainingSeconds(scopedTimer.state),
    });
  }, [scopedTimer.scope, scopedTimer.state]);

  const updateTimerSettings = useCallback((patch: Partial<PomodoroTimerSettings>) => {
    const nextSettings = sanitizePomodoroTimerSettings({ ...settingsRef.current, ...patch });
    settingsRef.current = nextSettings;
    setScopedSettings((current) => ({ ...current, settings: nextSettings }));

    const currentTimer = timerStateRef.current;
    if (!currentTimer.startedAt) {
      commitTimerState({
        ...currentTimer,
        remainingSeconds: getPomodoroModeSeconds(currentTimer.mode, nextSettings),
        completedCycleFocus: Math.min(
          currentTimer.completedCycleFocus || 0,
          nextSettings.longBreakEvery - 1,
        ),
      });
    }
  }, [commitTimerState]);

  useEffect(() => {
    const updateRemainingTime = () => {
      const nextRemainingSeconds = getRemainingSeconds(timerState);
      setVisibleRemainingSeconds(nextRemainingSeconds);

      if (timerState.isRunning && nextRemainingSeconds === 0) {
        const completionKey = `${timerState.activeTaskId || 'none'}-${timerState.mode}-${timerState.endsAt || 'none'}`;
        const endedAt = timerState.endsAt || Date.now();
        const sessionSnapshot = buildSessionSnapshot(timerState, endedAt);

        if (completionKeyRef.current !== completionKey && sessionSnapshot) {
          completionKeyRef.current = completionKey;
          onComplete?.(resolveTimerTask(timerState), timerState.mode, {
            ...sessionSnapshot,
            durationSeconds: timerState.plannedSeconds || sessionSnapshot.durationSeconds,
          });
        }

        const settings = settingsRef.current;
        const completedMode = timerState.mode;
        let completedCycleFocus = timerState.completedCycleFocus || 0;
        let nextMode: PomodoroMode;

        if (completedMode === 'focus') {
          completedCycleFocus += 1;
          if (completedCycleFocus >= settings.longBreakEvery) {
            completedCycleFocus = 0;
            nextMode = 'longBreak';
          } else {
            nextMode = 'shortBreak';
          }
        } else {
          nextMode = 'focus';
        }

        const shouldAutoStart = completedMode === 'focus'
          ? settings.autoStartBreaks
          : settings.autoStartFocus && !resolveTimerTask(timerState)?.isDone;
        const nextDurationSeconds = getPomodoroModeSeconds(nextMode, settings);
        const nextStartedAt = shouldAutoStart ? Date.now() : null;

        commitTimerState({
          ...timerState,
          mode: nextMode,
          isRunning: shouldAutoStart,
          remainingSeconds: nextDurationSeconds,
          endsAt: nextStartedAt ? nextStartedAt + nextDurationSeconds * 1000 : null,
          startedAt: nextStartedAt,
          plannedSeconds: shouldAutoStart ? nextDurationSeconds : null,
          sessionId: shouldAutoStart ? createSessionId() : null,
          completedCycleFocus,
        });
      }
    };

    updateRemainingTime();
    const intervalId = window.setInterval(updateRemainingTime, 1000);
    let disposed = false;
    let unlisten: (() => void) | undefined;
    if (isNativeWidget()) void listen('native-clock', () => { if (!disposed) updateRemainingTime(); })
      .then((stop) => { if (disposed) stop(); else unlisten = stop; }).catch(() => {});
    // Both wakeups compute the same deadline; Rust never owns a second timer.
    return () => { disposed = true; unlisten?.(); window.clearInterval(intervalId); };
  }, [commitTimerState, onComplete, resolveTimerTask, timerState]);

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
      document.title = `${formatPomodoroTime(visibleRemainingSeconds)} - ${resolveTimerTask(timerState)?.title || 'Focus session'}`;
      return;
    }

    document.title = originalDocumentTitleRef.current;
  }, [isPageHidden, resolveTimerTask, timerState, visibleRemainingSeconds]);

  useEffect(() => () => {
    if (originalDocumentTitleRef.current !== null) document.title = originalDocumentTitleRef.current;
  }, []);

  const selectedTimerTask = useMemo(() => (
    resolveTimerTask(timerState)
  ), [resolveTimerTask, timerState]);

  const startTimer = useCallback((taskId?: string) => {
    const currentState = timerStateRef.current;
    const nextTaskId = taskId || currentState.activeTaskId || activeFocusTask?.id || null;
    const sameTask = nextTaskId === currentState.activeTaskId;
    const now = Date.now();
    const remainingSeconds = sameTask
      ? getRemainingSeconds(currentState)
      : getPomodoroModeSeconds(currentState.mode, settingsRef.current);
    const nextTask = focusTasks.find((task) => task.id === nextTaskId)
      || (activeFocusTask?.id === nextTaskId ? activeFocusTask : null);

    if (!sameTask) reportInterruption(currentState, now);
    commitTimerState({
      ...currentState,
      activeTaskId: nextTaskId,
      sessionTask: sameTask ? currentState.sessionTask || nextTask : nextTask,
      sessionId: sameTask && currentState.sessionId ? currentState.sessionId : createSessionId(),
      isRunning: true,
      remainingSeconds,
      endsAt: now + remainingSeconds * 1000,
      startedAt: (sameTask && currentState.startedAt) || now,
      plannedSeconds: (sameTask && currentState.plannedSeconds) || remainingSeconds,
    });
  }, [activeFocusTask, commitTimerState, focusTasks, reportInterruption]);

  const pauseTimer = useCallback(() => {
    const currentState = timerStateRef.current;
    commitTimerState({
      ...currentState,
      isRunning: false,
      remainingSeconds: getRemainingSeconds(currentState),
      endsAt: null,
    });
  }, [commitTimerState]);

  const resetTimer = useCallback(() => {
    const currentState = timerStateRef.current;
    reportInterruption(currentState, Date.now());
    commitTimerState({
      ...currentState,
      isRunning: false,
      remainingSeconds: getPomodoroModeSeconds(currentState.mode, settingsRef.current),
      endsAt: null,
      startedAt: null,
      plannedSeconds: null,
      sessionId: null,
    });
  }, [commitTimerState, reportInterruption]);

  const setMode = useCallback((mode: PomodoroMode) => {
    const currentState = timerStateRef.current;
    if (mode === currentState.mode) return;
    reportInterruption(currentState, Date.now());
    commitTimerState({
      ...currentState,
      mode,
      isRunning: false,
      remainingSeconds: getPomodoroModeSeconds(mode, settingsRef.current),
      endsAt: null,
      startedAt: null,
      plannedSeconds: null,
      sessionId: null,
    });
  }, [commitTimerState, reportInterruption]);

  const setActiveTimerTaskId = useCallback((taskId: string) => {
    const currentState = timerStateRef.current;
    if (currentState.activeTaskId === taskId) return;
    reportInterruption(currentState, Date.now());
    commitTimerState({
      ...currentState,
      isRunning: false,
      remainingSeconds: getPomodoroModeSeconds(currentState.mode, settingsRef.current),
      endsAt: null,
      startedAt: null,
      plannedSeconds: null,
      sessionId: null,
      activeTaskId: taskId,
      sessionTask: focusTasks.find((task) => task.id === taskId)
        || (activeFocusTask?.id === taskId ? activeFocusTask : null),
    });
  }, [activeFocusTask, commitTimerState, focusTasks, reportInterruption]);

  return {
    timerState,
    timerSettings,
    updateTimerSettings,
    selectedTimerTask,
    remainingSeconds: visibleRemainingSeconds,
    startTimer,
    pauseTimer,
    resetTimer,
    setMode,
    setActiveTimerTaskId,
  };
}
