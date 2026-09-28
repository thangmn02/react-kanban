import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';

import type { HomeTaskSummary } from '../../../services/home.service';

export type DayPlanReason = 'overdue' | 'today' | 'tomorrow' | 'week' | 'noDate';

export interface RankedDayTask {
  task: HomeTaskSummary;
  score: number;
  reason: DayPlanReason;
  daysOverdue?: number;
}

function priorityScore(priority: HomeTaskSummary['priority']) {
  if (priority === 'High') return 150;
  if (priority === 'Medium') return 80;
  return 0;
}

export function rankTasksForDay(tasks: HomeTaskSummary[], today = new Date()): RankedDayTask[] {
  const startToday = startOfDay(today);
  return tasks.map((task) => {
    let dueScore = 0;
    let reason: DayPlanReason = 'noDate';
    let daysOverdue: number | undefined;
    if (task.dueDate) {
      const offset = differenceInCalendarDays(startOfDay(parseISO(task.dueDate)), startToday);
      if (offset < 0) {
        daysOverdue = Math.abs(offset);
        dueScore = 1000 + daysOverdue;
        reason = 'overdue';
      } else if (offset === 0) {
        dueScore = 800;
        reason = 'today';
      } else if (offset === 1) {
        dueScore = 500;
        reason = 'tomorrow';
      } else if (offset <= 7) {
        dueScore = 200;
        reason = 'week';
      }
    }
    return { task, score: dueScore + priorityScore(task.priority), reason, daysOverdue };
  }).sort((first, second) => {
    if (second.score !== first.score) return second.score - first.score;
    if (first.task.dueDate && second.task.dueDate) {
      const dueOrder = first.task.dueDate.localeCompare(second.task.dueDate);
      if (dueOrder !== 0) return dueOrder;
    } else if (first.task.dueDate) return -1;
    else if (second.task.dueDate) return 1;
    return first.task.title.localeCompare(second.task.title);
  });
}
