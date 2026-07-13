import { describe, it, expect } from 'vitest';

import {
  POMODORO_MODE_SECONDS,
  POMODORO_MODE_LABELS,
  formatPomodoroTime,
} from './pomodoroTime';

describe('POMODORO_MODE_SECONDS', () => {
  it('maps focus to 25 minutes', () => {
    expect(POMODORO_MODE_SECONDS.focus).toBe(25 * 60);
    expect(POMODORO_MODE_SECONDS.focus).toBe(1500);
  });

  it('maps shortBreak to 5 minutes', () => {
    expect(POMODORO_MODE_SECONDS.shortBreak).toBe(5 * 60);
    expect(POMODORO_MODE_SECONDS.shortBreak).toBe(300);
  });

  it('maps longBreak to 15 minutes', () => {
    expect(POMODORO_MODE_SECONDS.longBreak).toBe(15 * 60);
    expect(POMODORO_MODE_SECONDS.longBreak).toBe(900);
  });
});

describe('POMODORO_MODE_LABELS', () => {
  it('provides a label for each mode', () => {
    expect(POMODORO_MODE_LABELS.focus).toBe('Focus');
    expect(POMODORO_MODE_LABELS.shortBreak).toBe('Short break');
    expect(POMODORO_MODE_LABELS.longBreak).toBe('Long break');
  });
});

describe('formatPomodoroTime', () => {
  it('formats whole minutes and seconds with zero padding', () => {
    expect(formatPomodoroTime(1500)).toBe('25:00');
    expect(formatPomodoroTime(300)).toBe('05:00');
    expect(formatPomodoroTime(0)).toBe('00:00');
  });

  it('formats partial minutes', () => {
    expect(formatPomodoroTime(90)).toBe('01:30');
    expect(formatPomodoroTime(59)).toBe('00:59');
    expect(formatPomodoroTime(61)).toBe('01:01');
  });

  it('clamps negative values to zero', () => {
    expect(formatPomodoroTime(-10)).toBe('00:00');
    expect(formatPomodoroTime(-100)).toBe('00:00');
  });

  it('zero-pads single-digit seconds and minutes', () => {
    expect(formatPomodoroTime(5)).toBe('00:05');
    expect(formatPomodoroTime(65)).toBe('01:05');
  });
});
