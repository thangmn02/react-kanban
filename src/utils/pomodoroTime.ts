import type { PomodoroMode, PomodoroTimerSettings } from '../types/focus.type';

export const POMODORO_MODE_SECONDS: Record<PomodoroMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

export const POMODORO_MODE_LABELS: Record<PomodoroMode, string> = {
  focus: 'Focus',
  shortBreak: 'Short break',
  longBreak: 'Long break',
};

export const DEFAULT_POMODORO_TIMER_SETTINGS: PomodoroTimerSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
};

export const FOCUS_LENGTH_PRESETS = [15, 25, 45, 60, 90] as const;
export const SHORT_BREAK_PRESETS = [5, 10, 15] as const;
export const LONG_BREAK_PRESETS = [15, 20, 30] as const;
export const LONG_BREAK_EVERY_MIN = 2;
export const LONG_BREAK_EVERY_MAX = 6;

export function getPomodoroModeSeconds(mode: PomodoroMode, settings: PomodoroTimerSettings): number {
  switch (mode) {
    case 'focus':
      return settings.focusMinutes * 60;
    case 'shortBreak':
      return settings.shortBreakMinutes * 60;
    case 'longBreak':
      return settings.longBreakMinutes * 60;
  }
}

export function sanitizePomodoroTimerSettings(
  value: Partial<PomodoroTimerSettings> | null | undefined,
): PomodoroTimerSettings {
  const merged = { ...DEFAULT_POMODORO_TIMER_SETTINGS, ...(value || {}) };
  const clampInt = (input: unknown, fallback: number, min: number, max: number) => {
    const parsed = typeof input === 'number' && Number.isFinite(input) ? Math.round(input) : fallback;
    return Math.min(max, Math.max(min, parsed));
  };

  return {
    focusMinutes: clampInt(merged.focusMinutes, DEFAULT_POMODORO_TIMER_SETTINGS.focusMinutes, 5, 180),
    shortBreakMinutes: clampInt(merged.shortBreakMinutes, DEFAULT_POMODORO_TIMER_SETTINGS.shortBreakMinutes, 1, 60),
    longBreakMinutes: clampInt(merged.longBreakMinutes, DEFAULT_POMODORO_TIMER_SETTINGS.longBreakMinutes, 1, 90),
    longBreakEvery: clampInt(
      merged.longBreakEvery,
      DEFAULT_POMODORO_TIMER_SETTINGS.longBreakEvery,
      LONG_BREAK_EVERY_MIN,
      LONG_BREAK_EVERY_MAX,
    ),
    autoStartBreaks: merged.autoStartBreaks === true,
    autoStartFocus: merged.autoStartFocus === true,
  };
}

export function formatPomodoroTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
