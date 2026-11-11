import { useCallback, useEffect, useState } from 'react';
import type { StorageScope } from '../../shared/storage/storageAdapter';

/**
 * "Waiting on": a task that is blocked on someone else, with the day to chase them. Waiting tasks leave the
 * urgent groups on Today so they stop reading as the user's own lateness. Kept on this device, like Next step.
 */
export interface WaitingOn { who: string; followUpOn: string; setAt: string }
export type TaskFollowUps = Record<string, WaitingOn>;

const MAX_TASKS = 200;
const CHANGE_EVENT = 'kora:task-followups';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const storageKey = (scope: StorageScope) => `kora.taskFollowUps.v1:${scope.userId}:${scope.workspaceId ?? 'none'}`;

export function readFollowUps(scope: StorageScope): TaskFollowUps {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(scope)) || '{}') as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value as TaskFollowUps).filter(([, item]) =>
      item && typeof item.who === 'string' && typeof item.followUpOn === 'string' && DAY.test(item.followUpOn)));
  } catch { return {}; }
}

function writeFollowUps(scope: StorageScope, next: TaskFollowUps) {
  const kept = Object.entries(next).sort(([, a], [, b]) => (b.setAt || '').localeCompare(a.setAt || '')).slice(0, MAX_TASKS);
  try { localStorage.setItem(storageKey(scope), JSON.stringify(Object.fromEntries(kept))); } catch { /* Lasts for this window only. */ }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: storageKey(scope) }));
}

/** Returns false when the follow-up day is not a calendar day; nothing is saved then. */
export function setWaitingOn(scope: StorageScope, taskId: string, who: string, followUpOn: string) {
  if (!DAY.test(followUpOn)) return false;
  const current = readFollowUps(scope);
  current[taskId] = { who: who.trim().slice(0, 80), followUpOn, setAt: new Date().toISOString() };
  writeFollowUps(scope, current);
  return true;
}

export function clearWaitingOn(scope: StorageScope, taskId: string) {
  const current = readFollowUps(scope);
  if (!(taskId in current)) return;
  delete current[taskId];
  writeFollowUps(scope, current);
}

/** Day strings compare in calendar order, so no time zone maths is needed. */
export const followUpDue = (item: WaitingOn, today: string) => item.followUpOn <= today;

export function useTaskFollowUps(scope: StorageScope) {
  const key = storageKey(scope);
  const [followUps, setFollowUps] = useState(() => readFollowUps(scope));
  useEffect(() => {
    setFollowUps(readFollowUps(scope));
    const local = (event: Event) => { if ((event as CustomEvent<string>).detail === key) setFollowUps(readFollowUps(scope)); };
    const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) setFollowUps(readFollowUps(scope)); };
    window.addEventListener(CHANGE_EVENT, local);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener(CHANGE_EVENT, local); window.removeEventListener('storage', storage); };
  // The scope object is rebuilt each render; its key identifies it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const wait = useCallback((taskId: string, who: string, followUpOn: string) => setWaitingOn(scope, taskId, who, followUpOn),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]);
  const clear = useCallback((taskId: string) => clearWaitingOn(scope, taskId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]);
  return { followUps, wait, clear };
}

/**
 * A personal deadline ahead of the real due date. When its day arrives the task moves up on Today and the person is
 * told once; `nudgedOn` records that so the reminder never repeats. Kept on this device.
 */
export interface OwnDeadline { on: string; nudgedOn?: string }
export type OwnDeadlines = Record<string, OwnDeadline>;

const DEADLINE_EVENT = 'kora:own-deadlines';
const deadlineKey = (scope: StorageScope) => `kora.ownDeadlines.v1:${scope.userId}:${scope.workspaceId ?? 'none'}`;

export function readOwnDeadlines(scope: StorageScope): OwnDeadlines {
  try {
    const value = JSON.parse(localStorage.getItem(deadlineKey(scope)) || '{}') as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value as OwnDeadlines).filter(([, item]) => item && typeof item.on === 'string' && DAY.test(item.on)));
  } catch { return {}; }
}

function writeOwnDeadlines(scope: StorageScope, next: OwnDeadlines) {
  const kept = Object.entries(next).sort(([, a], [, b]) => b.on.localeCompare(a.on)).slice(0, MAX_TASKS);
  try { localStorage.setItem(deadlineKey(scope), JSON.stringify(Object.fromEntries(kept))); } catch { /* Lasts for this window only. */ }
  window.dispatchEvent(new CustomEvent(DEADLINE_EVENT, { detail: deadlineKey(scope) }));
}

/** Saves the day, or clears it when `on` is empty. A day on or after the real due date is refused: it would not be earlier. */
export function setOwnDeadline(scope: StorageScope, taskId: string, on: string, dueDate?: string | null) {
  const current = readOwnDeadlines(scope);
  if (!on) { if (!(taskId in current)) return true; delete current[taskId]; writeOwnDeadlines(scope, current); return true; }
  if (!DAY.test(on) || dueDate && on >= dueDate.slice(0, 10)) return false;
  current[taskId] = { on };
  writeOwnDeadlines(scope, current);
  return true;
}

/** Marks arrived deadlines as told and returns the task ids that had not been told before. */
export function takeDueNudges(scope: StorageScope, today: string, openTaskIds: ReadonlySet<string>) {
  const current = readOwnDeadlines(scope), fresh: string[] = [];
  for (const [taskId, item] of Object.entries(current)) if (openTaskIds.has(taskId) && item.on <= today && !item.nudgedOn) { item.nudgedOn = today; fresh.push(taskId); }
  if (fresh.length) writeOwnDeadlines(scope, current);
  return fresh;
}

export function useOwnDeadlines(scope: StorageScope) {
  const key = deadlineKey(scope);
  const [deadlines, setDeadlines] = useState(() => readOwnDeadlines(scope));
  useEffect(() => {
    setDeadlines(readOwnDeadlines(scope));
    const local = (event: Event) => { if ((event as CustomEvent<string>).detail === key) setDeadlines(readOwnDeadlines(scope)); };
    const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) setDeadlines(readOwnDeadlines(scope)); };
    window.addEventListener(DEADLINE_EVENT, local);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener(DEADLINE_EVENT, local); window.removeEventListener('storage', storage); };
  // The scope object is rebuilt each render; its key identifies it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback((taskId: string, on: string, dueDate?: string | null) => setOwnDeadline(scope, taskId, on, dueDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]);
  const takeNudges = useCallback((today: string, openTaskIds: ReadonlySet<string>) => takeDueNudges(scope, today, openTaskIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]);
  return { deadlines, set, takeNudges };
}
