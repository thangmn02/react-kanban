import type { TodayPageData, TodayTaskSummary } from '../../../services/today.service';

/**
 * Recommended-focus suggestions for the Today view. Reuses the data already
 * loaded by `fetchTodayPageData` (overdue / due today / assigned / recently
 * active) and surfaces a small, ranked list with human-readable reasons so the
 * user understands *why* each task is recommended. Pure / synchronous.
 */

export type FocusReason = 'overdue' | 'dueToday' | 'highPriority' | 'recentlyActive';

export interface TodayFocusSuggestion {
  task: TodayTaskSummary;
  reasons: FocusReason[];
}

export const FOCUS_REASON_ORDER: readonly FocusReason[] = [
  'overdue',
  'dueToday',
  'highPriority',
  'recentlyActive',
];

const REASON_WEIGHT: Record<FocusReason, number> = {
  overdue: 1000,
  dueToday: 800,
  highPriority: 500,
  recentlyActive: 100,
};

interface DraftSuggestion {
  task: TodayTaskSummary;
  reasonSet: Set<FocusReason>;
}

export function getTodayFocusSuggestions(
  todayData: TodayPageData,
  maxResults = 3,
): TodayFocusSuggestion[] {
  const suggestions = new Map<string, DraftSuggestion>();

  const addReason = (task: TodayTaskSummary, reason: FocusReason) => {
    if (task.isDone) {
      return;
    }

    const existing = suggestions.get(task.id);
    if (existing) {
      existing.reasonSet.add(reason);
    } else {
      suggestions.set(task.id, { task, reasonSet: new Set([reason]) });
    }
  };

  todayData.overdueTasks.forEach((task) => addReason(task, 'overdue'));
  todayData.dueTodayTasks.forEach((task) => addReason(task, 'dueToday'));
  todayData.recentlyActiveTasks.forEach((task) => addReason(task, 'recentlyActive'));

  const highPriorityCandidates = [
    ...todayData.overdueTasks,
    ...todayData.dueTodayTasks,
    ...todayData.assignedTasks,
    ...todayData.recentlyActiveTasks,
  ];
  highPriorityCandidates.forEach((task) => {
    if (task.priority === 'High') {
      addReason(task, 'highPriority');
    }
  });

  return Array.from(suggestions.values())
    .map((entry) => ({
      task: entry.task,
      reasons: FOCUS_REASON_ORDER.filter((reason) => entry.reasonSet.has(reason)),
      score: Array.from(entry.reasonSet).reduce((total, reason) => total + REASON_WEIGHT[reason], 0),
    }))
    .sort((current, next) => next.score - current.score || current.task.title.localeCompare(next.task.title))
    .slice(0, maxResults)
    .map(({ task, reasons }) => ({ task, reasons }));
}
