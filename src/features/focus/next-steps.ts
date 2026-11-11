import { useCallback, useEffect, useState } from 'react';
import type { StorageScope } from '../../shared/storage/storageAdapter';

/**
 * One "Next step" per task: where to start next time. Focus, the end of a session, Exit Focus and End Day all
 * read and write this one field, so a person never answers the same question twice. Kept on this device for now;
 * `pausedAt` records when work on the task last stopped, for the Home Continue card.
 */
export interface NextStep { text: string; updatedAt: string; pausedAt?: string }
export type NextSteps = Record<string, NextStep>;

const MAX_TASKS = 200;
const CHANGE_EVENT = 'kora:next-steps';
const storageKey = (scope: StorageScope) => `kora.nextSteps.v1:${scope.userId}:${scope.workspaceId ?? 'none'}`;

export function readNextSteps(scope: StorageScope): NextSteps {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(scope)) || '{}') as NextSteps;
    return value && typeof value === 'object' ? value : {};
  } catch { return {}; }
}

function writeNextSteps(scope: StorageScope, next: NextSteps) {
  // Keep the most recently touched tasks only.
  const kept = Object.entries(next).sort(([, a], [, b]) => (b.pausedAt ?? b.updatedAt).localeCompare(a.pausedAt ?? a.updatedAt)).slice(0, MAX_TASKS);
  try { localStorage.setItem(storageKey(scope), JSON.stringify(Object.fromEntries(kept))); } catch { /* Lasts for this window only. */ }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: storageKey(scope) }));
}

export function saveNextStep(scope: StorageScope, taskId: string, text: string, options: { paused?: boolean } = {}) {
  const now = new Date().toISOString(), current = readNextSteps(scope), trimmed = text.trim().slice(0, 500);
  const previous = current[taskId];
  if (!trimmed && !options.paused) { delete current[taskId]; writeNextSteps(scope, current); return; }
  current[taskId] = { text: trimmed, updatedAt: trimmed === previous?.text ? previous.updatedAt : now,
    ...(options.paused ? { pausedAt: now } : previous?.pausedAt ? { pausedAt: previous.pausedAt } : {}) };
  writeNextSteps(scope, current);
}

/** Tasks worked on during the given local day: a session on them ended, or their Next step was written. */
export function touchedOn(steps: NextSteps, taskIds: readonly string[], day = new Date()) {
  const sameDay = (value?: string) => { if (!value) return false; const at = new Date(value);
    return at.getFullYear() === day.getFullYear() && at.getMonth() === day.getMonth() && at.getDate() === day.getDate(); };
  return taskIds.filter(id => sameDay(steps[id]?.pausedAt) || sameDay(steps[id]?.updatedAt));
}

/** Forget a task once it is done; it no longer needs a place to resume. */
export function clearNextStep(scope: StorageScope, taskId: string) {
  const current = readNextSteps(scope);
  if (!(taskId in current)) return;
  delete current[taskId];
  writeNextSteps(scope, current);
}

export function useNextSteps(scope: StorageScope) {
  const key = storageKey(scope);
  const [steps, setSteps] = useState(() => readNextSteps(scope));
  useEffect(() => {
    setSteps(readNextSteps(scope));
    const local = (event: Event) => { if ((event as CustomEvent<string>).detail === key) setSteps(readNextSteps(scope)); };
    const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) setSteps(readNextSteps(scope)); };
    window.addEventListener(CHANGE_EVENT, local);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener(CHANGE_EVENT, local); window.removeEventListener('storage', storage); };
  // The scope object is rebuilt each render; its key identifies it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const save = useCallback((taskId: string, text: string, options?: { paused?: boolean }) => saveNextStep(scope, taskId, text, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]);
  const clear = useCallback((taskId: string) => clearNextStep(scope, taskId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]);
  return { steps, save, clear };
}
