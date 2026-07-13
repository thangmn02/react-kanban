import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { StorageScope } from '../shared/storage/storageAdapter';
import { usePomodoroTimer } from './usePomodoroTimer';

const scopeA: StorageScope = { userId: 'user-a', workspaceId: 'workspace-a' };
const scopeB: StorageScope = { userId: 'user-b', workspaceId: 'workspace-a' };

describe('usePomodoroTimer', () => {
  beforeEach(() => window.localStorage.clear());

  it('characterizes start, pause, mode, and reset transitions', () => {
    const { result } = renderHook(() => usePomodoroTimer({ scope: scopeA, activeFocusTask: null }));

    act(() => result.current.setActiveTimerTaskId('task-1'));
    act(() => result.current.startTimer());
    expect(result.current.timerState.isRunning).toBe(true);
    expect(result.current.timerState.activeTaskId).toBe('task-1');
    expect(result.current.timerState.endsAt).not.toBeNull();

    act(() => result.current.pauseTimer());
    expect(result.current.timerState.isRunning).toBe(false);
    expect(result.current.timerState.endsAt).toBeNull();

    act(() => result.current.setMode('shortBreak'));
    expect(result.current.timerState.mode).toBe('shortBreak');

    act(() => result.current.resetTimer());
    expect(result.current.timerState.mode).toBe('shortBreak');
    expect(result.current.timerState.startedAt).toBeNull();
  });

  it('isolates persisted timer state by user and workspace scope', () => {
    const { result, rerender } = renderHook(
      ({ scope }) => usePomodoroTimer({ scope, activeFocusTask: null }),
      { initialProps: { scope: scopeA } },
    );
    act(() => result.current.setMode('longBreak'));

    rerender({ scope: scopeB });
    expect(result.current.timerState.mode).toBe('focus');

    act(() => result.current.setMode('shortBreak'));
    rerender({ scope: scopeA });
    expect(result.current.timerState.mode).toBe('longBreak');
  });

  it('migrates the legacy global timer once into the active scope', () => {
    window.localStorage.setItem('kanban_pomodoro_timer', JSON.stringify({
      mode: 'shortBreak',
      activeTaskId: 'legacy-task',
      isRunning: false,
    }));

    const { result, rerender } = renderHook(
      ({ scope }) => usePomodoroTimer({ scope, activeFocusTask: null }),
      { initialProps: { scope: scopeA } },
    );
    expect(result.current.timerState.mode).toBe('shortBreak');
    expect(result.current.timerState.activeTaskId).toBe('legacy-task');
    expect(window.localStorage.getItem('kanban_pomodoro_timer')).toBeNull();

    rerender({ scope: scopeB });
    expect(result.current.timerState.mode).toBe('focus');
    expect(result.current.timerState.activeTaskId).toBeNull();
  });
});
