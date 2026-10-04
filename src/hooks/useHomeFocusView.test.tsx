import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useHomeFocusView } from './useHomeFocusView';
import { homeFocusViewStorageKey } from '../utils/homeFocusSession';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('does not infer Home focus from a legacy saved timer or dismissal marker', () => {
  localStorage.setItem('kanban_pomodoro_timer', JSON.stringify({ startedAt: 42, activeTaskId: 'task' }));
  sessionStorage.setItem('home-focus-dismissed:user:workspace', '42');
  const { result } = renderHook(() => useHomeFocusView('user', 'workspace'));
  expect(result.current.focusViewId).toBeNull();
});

it('updates Home and the dock subscriber immediately when a paused view exits', () => {
  const home = renderHook(() => useHomeFocusView('user', 'workspace'));
  const overlays = renderHook(() => useHomeFocusView('user', 'workspace'));
  act(() => home.result.current.setFocusViewId('task'));
  expect(overlays.result.current.focusViewId).toBe('task');
  act(() => home.result.current.setFocusViewId(null));
  expect(home.result.current.focusViewId).toBeNull();
  expect(overlays.result.current.focusViewId).toBeNull();
});

it('remembers entry and exit across remounts with fresh session storage', () => {
  const first = renderHook(() => useHomeFocusView('user', 'workspace'));
  act(() => first.result.current.setFocusViewId('task'));
  first.unmount();
  const restored = renderHook(() => useHomeFocusView('user', 'workspace'));
  expect(restored.result.current.focusViewId).toBe('task');
  act(() => restored.result.current.setFocusViewId(null));
  restored.unmount();
  sessionStorage.clear();
  const nextRun = renderHook(() => useHomeFocusView('user', 'workspace'));
  expect(nextRun.result.current.focusViewId).toBeNull();
});

it('isolates users and workspaces and switches snapshots immediately', () => {
  const view = renderHook(({ user, workspace }) => useHomeFocusView(user, workspace), {
    initialProps: { user: 'one', workspace: 'a' },
  });
  act(() => view.result.current.setFocusViewId('task'));
  view.rerender({ user: 'one', workspace: 'b' });
  expect(view.result.current.focusViewId).toBeNull();
  view.rerender({ user: 'two', workspace: 'a' });
  expect(view.result.current.focusViewId).toBeNull();
  view.rerender({ user: 'one', workspace: 'a' });
  expect(view.result.current.focusViewId).toBe('task');
});

it('responds to another tab exiting or clearing the saved preference', () => {
  const view = renderHook(() => useHomeFocusView('user', 'workspace'));
  act(() => view.result.current.setFocusViewId('task'));
  act(() => {
    localStorage.removeItem(homeFocusViewStorageKey('user', 'workspace'));
    window.dispatchEvent(new StorageEvent('storage', { key: homeFocusViewStorageKey('user', 'workspace') }));
  });
  expect(view.result.current.focusViewId).toBeNull();
});

it('keeps subscribers synchronized if storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
  const home = renderHook(() => useHomeFocusView('blocked-user', 'workspace'));
  const overlays = renderHook(() => useHomeFocusView('blocked-user', 'workspace'));
  act(() => home.result.current.setFocusViewId('task'));
  expect(overlays.result.current.focusViewId).toBe('task');
  act(() => home.result.current.setFocusViewId(null));
  expect(overlays.result.current.focusViewId).toBeNull();
});

it('ignores invalid stored values and does not store a view without a user', () => {
  localStorage.setItem(homeFocusViewStorageKey('user', 'workspace'), '{invalid');
  const corrupt = renderHook(() => useHomeFocusView('user', 'workspace'));
  expect(corrupt.result.current.focusViewId).toBeNull();
  const anonymous = renderHook(() => useHomeFocusView(null, 'workspace'));
  act(() => anonymous.result.current.setFocusViewId('task'));
  expect(anonymous.result.current.focusViewId).toBeNull();
  expect(localStorage.getItem(homeFocusViewStorageKey(null, 'workspace'))).toBeNull();
});
