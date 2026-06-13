import { useMemo } from 'react';
import type { TodayPageData, TodayTaskSummary } from '../../../services/today.service';


export function useTodaySuggestions(
  todayData: TodayPageData,
  selectedTaskIds: Set<string>,
  maxSuggestions = 5
) {
  return useMemo(() => {
    const allTasks = new Map<string, TodayTaskSummary>();
    
    const addTasks = (tasks: TodayTaskSummary[]) => {
      tasks.forEach((task) => {
        if (!allTasks.has(task.id)) {
          // Store the task along with an initial score based on its source array order and weight offset
          allTasks.set(task.id, task);
        }
      });
    };

    // Rank 1: Overdue
    addTasks(todayData.overdueTasks);
    // Rank 2: Due Today
    addTasks(todayData.dueTodayTasks);
    // Rank 3: High priority (will be checked below)
    // Rank 4: Assigned tasks
    addTasks(todayData.assignedTasks);
    // Rank 5: Recently active
    addTasks(todayData.recentlyActiveTasks);

    const scoredTasks = Array.from(allTasks.values())
      .filter((task) => !task.isDone && !selectedTaskIds.has(task.id))
      .map((task) => {
        let score = 0;
        
        // 1. Overdue
        if (todayData.overdueTasks.some(t => t.id === task.id)) score += 1000;
        // 2. Due today
        if (todayData.dueTodayTasks.some(t => t.id === task.id)) score += 800;
        // 3. High priority
        if (task.priority === 'High') score += 500;
        if (task.priority === 'Medium') score += 300;
        // 4. Assigned to me
        if (todayData.assignedTasks.some(t => t.id === task.id)) score += 200;
        // 5. Recently active
        if (todayData.recentlyActiveTasks.some(t => t.id === task.id)) score += 100;

        return { task, score };
      });

    // Sort by score descending
    scoredTasks.sort((a, b) => b.score - a.score);

    return scoredTasks.slice(0, maxSuggestions).map(item => item.task);
  }, [todayData, selectedTaskIds, maxSuggestions]);
}
