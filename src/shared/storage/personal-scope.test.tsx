import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import QuickSearch from '../../components/organisms/QuickSearch';
import { I18nProvider } from '../../i18n';
import { getYesterdayCarryoverSummary, getYesterdayRitualDateKey, dailyRitualKey } from '../../features/today/dailyRitual';
import { useDueDateReminder } from '../../hooks/useDueDateReminder';
import { notify } from '../../components/organisms/toast/notify';
import type { BoardData } from '../../types/task.type';

const savedFiltersKey = (scope: { userId: string; workspaceId: string }) => `kora.savedFilters.v1:${scope.userId}:${scope.workspaceId}`;
const a = { userId: 'a', workspaceId: 'one' }, b = { userId: 'b', workspaceId: 'one' }, aTwo = { userId: 'a', workspaceId: 'two' };
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

const search = (scope: typeof a) => <I18nProvider><QuickSearch scope={scope} searchQuery="" onSearchQueryChange={vi.fn()} filterPriority="" onFilterPriorityChange={vi.fn()}
  filterAssignee="" onFilterAssigneeChange={vi.fn()} filterDueDate="" onFilterDueDateChange={vi.fn()} onClearFilters={vi.fn()} workspaceMembers={[]} /></I18nProvider>;
const filter = (name: string) => JSON.stringify([{ id: name, name, searchQuery: 'x', priority: '', assignee: '', dueDate: '' }]);
it('shows saved filters only to their owner in their workspace, also when the board stays open', () => {
  localStorage.setItem(savedFiltersKey(a), filter('Mine'));
  const view = render(search(a));
  fireEvent.click(screen.getByRole('button', { name: /filter/i }));
  expect(view.container.ownerDocument.body.textContent).toContain('Mine');
  for (const other of [b, aTwo]) {
    view.rerender(search(other));
    fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    expect(document.body.textContent).not.toContain('Mine');
    expect(localStorage.getItem(savedFiltersKey(other))).toBe('[]');
  }
  expect(localStorage.getItem(savedFiltersKey(a))).toBe(filter('Mine'));
});
it('gives the old shared filters to the first person only', () => {
  localStorage.setItem('kanban_saved_filters', filter('Old'));
  const view = render(search(a));
  expect(localStorage.getItem(savedFiltersKey(a))).toContain('Old');
  expect(localStorage.getItem('kanban_saved_filters')).toBeNull();
  view.rerender(search(b));
  expect(localStorage.getItem(savedFiltersKey(b))).toBe('[]');
});
it('offers yesterday only to the person and workspace it belongs to, and never the old shared snapshot', () => {
  const snapshot = JSON.stringify({ dateKey: getYesterdayRitualDateKey(), tasks: [{ id: 't', title: 'Private', isDone: false }], completedSessions: 0, focusedMinutes: 0, completedAt: '' });
  localStorage.setItem('kanban_daily_ritual_snapshot', snapshot);
  expect(getYesterdayCarryoverSummary(b)).toBeNull();
  localStorage.setItem(dailyRitualKey(a), snapshot);
  expect(getYesterdayCarryoverSummary(a)?.totalCount).toBe(1);
  expect(getYesterdayCarryoverSummary(b)).toBeNull();
  expect(getYesterdayCarryoverSummary(aTwo)).toBeNull();
});
it('reminds each person once per their own day', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 24, 6, 30));
  const info = vi.spyOn(notify, 'info').mockReturnValue(undefined as never);
  const board = { columns: [], list: {}, task: { t: { id: 't', title: 'Due', dueDate: '2026-11-24', isDone: false } } } as unknown as BoardData;
  renderHook(() => useDueDateReminder(board, a));
  expect(info).toHaveBeenCalledTimes(1);
  // Later the same morning the UTC date changes in Vietnam; the local day does not.
  vi.setSystemTime(new Date(2026, 10, 24, 7, 30));
  renderHook(() => useDueDateReminder(board, a));
  expect(info).toHaveBeenCalledTimes(1);
  renderHook(() => useDueDateReminder(board, b));
  expect(info).toHaveBeenCalledTimes(2);
});
