import { useEffect, useState } from 'react';

// Quiet checks: they only show a badge and one note. Nothing downloads or installs until the person chooses Update.
export const APP_CHECK_DELAY_MS = 15_000;
export const APP_CHECK_EVERY_MS = 6 * 60 * 60_000;
export const COMPANION_CHECK_EVERY_MS = 5 * 60_000;
export const WEB_CHECK_EVERY_MS = 10 * 60_000;
const DISMISSED_KEY = 'kora.updateNotice.dismissed.v1';

const parts = (version: string) => {
  const values = version.split('.').map(Number);
  return values.length === 3 && values.every(value => Number.isInteger(value) && value >= 0) ? values : undefined;
};
/** True when `installed` is a valid version strictly older than `bundled`. */
export function olderThan(installed: string | undefined, bundled: string) {
  const a = installed ? parts(installed) : undefined, b = parts(bundled);
  if (!a || !b) return false;
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] < b[index];
  return false;
}

/** "Later" hides the note for that one version; the badge stays until it is installed. */
export function noticeDismissed(key: string) {
  try { return (JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]') as string[]).includes(key); } catch { return false; }
}
export function dismissNotice(key: string) {
  try {
    const kept = (JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]') as string[]).filter(item => item !== key).slice(-9);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...kept, key]));
  } catch { /* The note returns next time; the badge still works. */ }
}

/** Runs `check` after `delay`, then every `every`, and whenever the window regains focus (at most once a minute). */
export function usePeriodicCheck<T>(enabled: boolean, check: () => Promise<T | undefined>, delay: number, every: number) {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    if (!enabled) return;
    let alive = true, last = 0;
    const run = async () => {
      if (Date.now() - last < 60_000) return;
      last = Date.now();
      try { const next = await check(); if (alive) setValue(next); } catch { /* Offline or unavailable: try again later. */ }
    };
    const first = setTimeout(run, delay), timer = setInterval(run, every);
    const focus = () => { if (document.visibilityState === 'visible') void run(); };
    document.addEventListener('visibilitychange', focus);
    return () => { alive = false; clearTimeout(first); clearInterval(timer); document.removeEventListener('visibilitychange', focus); };
  // The check is fixed per caller; re-running the schedule on every render would reset it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, delay, every]);
  return value;
}

/** Web only: the id of a newer deploy than the one this tab is running, if any. */
export async function checkWebDeploy(): Promise<string | undefined> {
  const response = await fetch('/build.json', { cache: 'no-store' });
  if (!response.ok) return undefined;
  const { id } = await response.json() as { id?: unknown };
  return typeof id === 'string' && id && id !== __KORA_BUILD_ID__ ? id : undefined;
}
