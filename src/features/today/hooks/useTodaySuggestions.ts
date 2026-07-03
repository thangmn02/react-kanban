import { useMemo } from 'react';
import type { TodayPageData, TodayTaskSummary } from '../../../services/today.service';

/**
 * Smart suggestions for the Plan Today modal.
 *
 * Rules (Plan Today spec):
 *  - Only existing, UNFINISHED tasks are suggested (completed tasks excluded).
 *  - Tasks already selected for today are excluded.
 *  - Ranking priority (highest first):
 *      a. overdue
 *      b. due today
 *      c. high priority (High > Medium > Low > Lowest)
 *      d. recently updated
 *  - Ties break by title for a stable, deterministic order.
 */
export function useTodaySuggestions(
  todayData: TodayPageData,
  selectedTaskIds: Set<string>,
  maxSuggestions = 5,
) {
  return useMemo(() => {
    const allTasks = new Map<string, TodayTaskSummary>();

    const addTasks = (tasks: TodayTaskSummary[]) => {
      tasks.forEach((task) => {
        if (!allTasks.has(task.id)) {
          allTasks.set(task.id, task);
        }
      });
    };

    // Build the candidate pool from every source the Today page already loads.
    addTasks(todayData.overdueTasks);
    addTasks(todayData.dueTodayTasks);
    addTasks(todayData.assignedTasks);
    addTasks(todayData.recentlyActiveTasks);

    // Pre-comcompute membership sets once (avoids O(n^2) `.some()` scans).
    const overdueIds = new Set(todayData.overdueTasks.map((task) => task.id));
    const dueTodayIds = new Set(todayData.dueTodayTasks.map((task) => task.id));
    const recentlyActiveIds = new Set(todayData.recentlyActiveTasks.map((task) => task.id));

    const priorityWeight = (priority: TodayTaskSummary['priority']): number => {
      switch (priority) {
        case 'High':
          return 500;
        case 'Medium':
          return 300;
        case 'Low':
          return 150;
        case 'Lowest':
          return 80;
        default:
          return 0;
      }
    };

    const scoredTasks = Array.from(allTasks.values())
      .filter((task) => !task.isDone && !selectedTaskIds.has(task.id))
      .map((task) => {
        let score = 0;
        if (overdueIds.has(task.id)) score += 1000;
        if (dueTodayIds.has(task.id)) score += 800;
        score += priorityWeight(task.priority);
        if (recentlyActiveIds.has(task.id)) score += 100;

        return { task, score };
      });

    scoredTasks.sort(
      (current, next) => next.score - current.score || current.task.title.localeCompare(next.task.title),
    );

    return scoredTasks.slice(0, maxSuggestions).map((item) => item.task);
  }, [todayData, selectedTaskIds, maxSuggestions]);
}
