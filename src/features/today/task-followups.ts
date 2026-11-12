import { useCallback, useEffect, useRef, useState } from 'react';
import type { StorageScope } from '../../shared/storage/storageAdapter';

/**
 * "Waiting on": a task that is blocked on someone else, with the day to chase them. Waiting tasks leave the
 * urgent groups on Today so they stop reading as the user's own lateness. Marks are private to the person and follow
 * them across devices: this device keeps a copy for instant display and queues each change in an outbox, which
 * `syncFollowUps` sends to the account before replacing the copy with the account's marks. Signed out or offline,
 * marks stay on the device and upload later.
 */
export interface WaitingOn { who: string; followUpOn: string; setAt: string }
export type TaskFollowUps = Record<string, WaitingOn>;
/** A queued change: a mark to save, or `followUpOn: null` to clear one. */
export type FollowUpChange = { who: string; followUpOn: string | null; setAt: string };
export interface FollowUpRemote {
  list(): Promise<Array<{ taskId: string } & WaitingOn>>;
  set(taskId: string, change: FollowUpChange): Promise<void>;
}

const MAX_TASKS = 200;
const CHANGE_EVENT = 'kora:task-followups';
const OUTBOX_EVENT = 'kora:task-followups-outbox';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const scopePart = (scope: StorageScope) => `${scope.userId}:${scope.workspaceId ?? 'none'}`;
const storageKey = (scope: StorageScope) => `kora.taskFollowUps.v1:${scopePart(scope)}`;
const outboxKey = (scope: StorageScope) => `kora.taskFollowUps.outbox.v1:${scopePart(scope)}`;
// Set once this device's marks from before syncing existed have reached the account.
const uploadedKey = (scope: StorageScope) => `kora.taskFollowUps.uploaded.v1:${scopePart(scope)}`;

const valid = (item: Partial<WaitingOn> | null | undefined): item is WaitingOn =>
  !!item && typeof item.who === 'string' && typeof item.followUpOn === 'string' && DAY.test(item.followUpOn);
function readRecord<T>(key: string): Record<string, T> {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}') as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, T> : {};
  } catch { return {}; }
}
const store = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Lasts for this window only. */ } };

export function readFollowUps(scope: StorageScope): TaskFollowUps {
  return Object.fromEntries(Object.entries(readRecord<WaitingOn>(storageKey(scope))).filter(([, item]) => valid(item)));
}
const readOutbox = (scope: StorageScope) => readRecord<FollowUpChange>(outboxKey(scope));

function writeFollowUps(scope: StorageScope, next: TaskFollowUps) {
  const kept = Object.entries(next).sort(([, a], [, b]) => (b.setAt || '').localeCompare(a.setAt || '')).slice(0, MAX_TASKS);
  store(storageKey(scope), Object.fromEntries(kept));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: storageKey(scope) }));
}
function queue(scope: StorageScope, taskId: string, change: FollowUpChange) {
  store(outboxKey(scope), { ...readOutbox(scope), [taskId]: change });
  window.dispatchEvent(new CustomEvent(OUTBOX_EVENT, { detail: storageKey(scope) }));
}

/** Returns false when the follow-up day is not a calendar day; nothing is saved then. */
export function setWaitingOn(scope: StorageScope, taskId: string, who: string, followUpOn: string) {
  if (!DAY.test(followUpOn)) return false;
  const current = readFollowUps(scope), item = { who: who.trim().slice(0, 80), followUpOn, setAt: new Date().toISOString() };
  current[taskId] = item;
  writeFollowUps(scope, current);
  queue(scope, taskId, item);
  return true;
}

export function clearWaitingOn(scope: StorageScope, taskId: string) {
  const current = readFollowUps(scope);
  if (!(taskId in current)) return;
  delete current[taskId];
  writeFollowUps(scope, current);
  queue(scope, taskId, { who: '', followUpOn: null, setAt: new Date().toISOString() });
}

const DROP_CODES = new Set(['P0002', '54000']);
const running = new Map<string, Promise<void>>();
/**
 * Sends queued changes, then shows the account's marks with any still-unsent changes on top. A failure (offline, or
 * an account database without follow-ups yet) leaves the device copy and the outbox as they are for the next try.
 * Calls for the same scope run one after another.
 */
export function syncFollowUps(scope: StorageScope, remote: FollowUpRemote): Promise<void> {
  const key = storageKey(scope);
  const next = (running.get(key) ?? Promise.resolve()).then(() => syncOnce(scope, remote)).catch(() => { /* Retried on the next sync. */ });
  running.set(key, next);
  void next.then(() => { if (running.get(key) === next) running.delete(key); });
  return next;
}

async function syncOnce(scope: StorageScope, remote: FollowUpRemote) {
  const firstUpload = !localStorage.getItem(uploadedKey(scope));
  if (firstUpload) {
    const outbox = readOutbox(scope);
    for (const [taskId, item] of Object.entries(readFollowUps(scope))) if (!(taskId in outbox)) outbox[taskId] = item;
    store(outboxKey(scope), outbox);
  }
  for (const [taskId, change] of Object.entries(readOutbox(scope))) {
    try { await remote.set(taskId, change); } catch (error) {
      // The task is gone, or the account is full: this change can never land, so it must not block the others.
      if (!DROP_CODES.has((error as { code?: string }).code ?? '')) throw error;
    }
    const outbox = readOutbox(scope);
    // A newer change made while this one was sending stays queued.
    if (outbox[taskId]?.setAt === change.setAt) { delete outbox[taskId]; store(outboxKey(scope), outbox); }
  }
  if (firstUpload) store(uploadedKey(scope), Date.now());
  const marks: TaskFollowUps = {};
  for (const { taskId, ...item } of await remote.list()) {
    const mark = { who: item.who, followUpOn: String(item.followUpOn).slice(0, 10), setAt: item.setAt };
    if (valid(mark)) marks[taskId] = mark;
  }
  for (const [taskId, change] of Object.entries(readOutbox(scope))) {
    if (change.followUpOn === null) delete marks[taskId];
    else marks[taskId] = { who: change.who, followUpOn: change.followUpOn, setAt: change.setAt };
  }
  const same = (a: TaskFollowUps, b: TaskFollowUps) => Object.keys(a).length === Object.keys(b).length
    && Object.entries(a).every(([id, item]) => b[id]?.who === item.who && b[id]?.followUpOn === item.followUpOn);
  if (!same(readFollowUps(scope), marks)) writeFollowUps(scope, marks);
}

/** Day strings compare in calendar order, so no time zone maths is needed. */
export const followUpDue = (item: WaitingOn, today: string) => item.followUpOn <= today;

/** `remote` is null when there is no account to sync with (local demo mode, or no workspace). */
export function useTaskFollowUps(scope: StorageScope, remote: FollowUpRemote | null = null) {
  const key = storageKey(scope);
  const [followUps, setFollowUps] = useState(() => readFollowUps(scope));
  const remoteRef = useRef(remote);
  useEffect(() => { remoteRef.current = remote; });
  const canSync = remote !== null;
  useEffect(() => {
    setFollowUps(readFollowUps(scope));
    const local = (event: Event) => { if ((event as CustomEvent<string>).detail === key) setFollowUps(readFollowUps(scope)); };
    const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) setFollowUps(readFollowUps(scope)); };
    const sync = () => { if (remoteRef.current && document.visibilityState !== 'hidden') void syncFollowUps(scope, remoteRef.current); };
    const queued = (event: Event) => { if ((event as CustomEvent<string>).detail === key) sync(); };
    window.addEventListener(CHANGE_EVENT, local);
    window.addEventListener('storage', storage);
    if (canSync) {
      sync();
      window.addEventListener(OUTBOX_EVENT, queued);
      window.addEventListener('focus', sync);
      window.addEventListener('online', sync);
      document.addEventListener('visibilitychange', sync);
    }
    return () => {
      window.removeEventListener(CHANGE_EVENT, local); window.removeEventListener('storage', storage);
      window.removeEventListener(OUTBOX_EVENT, queued); window.removeEventListener('focus', sync);
      window.removeEventListener('online', sync); document.removeEventListener('visibilitychange', sync);
    };
  // The scope object is rebuilt each render; its key identifies it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, canSync]);
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
