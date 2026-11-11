export const STALE_AFTER_DAYS = 14;

/**
 * Splits tasks into ones touched recently and ones left alone for a while. Untouched tasks fold out of sight so a
 * long backlog does not bury today's work. A task with no known update time is kept visible.
 */
export function splitStaleTasks<T extends { updatedAt: string | null; dueDate: string | null }>(tasks: T[], now = Date.now(), days = STALE_AFTER_DAYS) {
  const cutoff = now - days * 86_400_000;
  const fresh: T[] = [], stale: T[] = [];
  for (const task of tasks) {
    const updated = task.updatedAt ? Date.parse(task.updatedAt) : NaN;
    // A dated task is never hidden: its deadline is a reason to see it.
    if (!task.dueDate && Number.isFinite(updated) && updated < cutoff) stale.push(task); else fresh.push(task);
  }
  return { fresh, stale };
}
