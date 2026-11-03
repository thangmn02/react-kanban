/**
 * Time to Resume: milliseconds from opening Kora to starting the first Focus session of that visit.
 * Logged on this device only (no analytics yet); the last 50 visits are kept for review in DevTools.
 */
export const TIME_TO_RESUME_KEY = 'kora.metrics.timeToResume.v1';
const KEEP = 50;
let recorded = false;

export interface TimeToResumeSample { ms: number; at: string; resumed: boolean }

export function recordFirstFocusStart(resumed: boolean, now = performance.now()) {
  if (recorded) return;
  recorded = true;
  try {
    const samples = JSON.parse(localStorage.getItem(TIME_TO_RESUME_KEY) || '[]') as TimeToResumeSample[];
    samples.push({ ms: Math.round(now), at: new Date().toISOString(), resumed });
    localStorage.setItem(TIME_TO_RESUME_KEY, JSON.stringify(samples.slice(-KEEP)));
  } catch { /* A metric must never interrupt Focus. */ }
}

export function readTimeToResume(): TimeToResumeSample[] {
  try { return JSON.parse(localStorage.getItem(TIME_TO_RESUME_KEY) || '[]') as TimeToResumeSample[]; } catch { return []; }
}

/** Tests only: start a fresh visit. */
export function resetTimeToResumeVisit() { recorded = false; }
