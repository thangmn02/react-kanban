import type { StorageScope } from '../../shared/storage/storageAdapter';
import type { FocusTask } from '../../types/focus.type';

// A day's plan names tasks, so it belongs to one person in one workspace. The old shared snapshot cannot say whose it was and lasted one day.
const oldRitualKey = 'kanban_daily_ritual_snapshot';
export const dailyRitualKey = (scope: StorageScope) => `kora.dailyRitual.v1:${scope.userId ?? 'anon'}:${scope.workspaceId ?? 'none'}`;

export interface DailyRitualTaskSnapshot {
  id: string;
  title: string;
  isDone: boolean;
}

export interface DailyRitualSnapshot {
  dateKey: string;
  tasks: DailyRitualTaskSnapshot[];
  completedSessions: number;
  focusedMinutes: number;
  completedAt: string;
}

export interface DailyCarryoverSummary {
  finishedCount: number;
  totalCount: number;
  unfinishedTasks: DailyRitualTaskSnapshot[];
  dateKey: string;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayRitualDateKey(date = new Date()) {
  return toDateKey(date);
}

export function getYesterdayRitualDateKey(date = new Date()) {
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  return toDateKey(yesterday);
}

export function readDailyRitualSnapshot(scope: StorageScope): DailyRitualSnapshot | null {
  if (typeof window === 'undefined') return null;

  try {
    window.localStorage.removeItem(oldRitualKey);
    const rawValue = window.localStorage.getItem(dailyRitualKey(scope));
    if (!rawValue) return null;
    const snapshot = JSON.parse(rawValue) as DailyRitualSnapshot;
    if (!snapshot?.dateKey || !Array.isArray(snapshot.tasks)) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export function writeDailyRitualSnapshot(
  scope: StorageScope,
  focusTasks: FocusTask[],
  completedSessions: number,
  focusedMinutes: number,
) {
  if (typeof window === 'undefined') return null;

  const snapshot: DailyRitualSnapshot = {
    dateKey: getTodayRitualDateKey(),
    tasks: focusTasks.slice(0, 3).map((task) => ({
      id: task.id,
      title: task.title,
      isDone: Boolean(task.isDone),
    })),
    completedSessions,
    focusedMinutes,
    completedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(dailyRitualKey(scope), JSON.stringify(snapshot));
  return snapshot;
}

export function getYesterdayCarryoverSummary(scope: StorageScope): DailyCarryoverSummary | null {
  const snapshot = readDailyRitualSnapshot(scope);
  if (!snapshot || snapshot.dateKey !== getYesterdayRitualDateKey()) return null;

  const totalCount = snapshot.tasks.length;
  const unfinishedTasks = snapshot.tasks.filter((task) => !task.isDone);

  if (totalCount === 0 || unfinishedTasks.length === 0) return null;

  return {
    dateKey: snapshot.dateKey,
    finishedCount: totalCount - unfinishedTasks.length,
    totalCount,
    unfinishedTasks,
  };
}
