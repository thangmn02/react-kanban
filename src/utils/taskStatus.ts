import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';

import type { ITaskItem } from '../types/task.type';

export type TaskStatusColor = 'gray' | 'blue' | 'amber' | 'green';

export function statusColor(
  task: Pick<ITaskItem, 'dueDate' | 'isDone'>,
  isFinalActiveColumn = false,
  today = new Date(),
): TaskStatusColor {
  if (isFinalActiveColumn) return 'green';
  if (task.isDone || !task.dueDate) return 'gray';

  const dueDate = parseISO(task.dueDate);
  if (Number.isNaN(dueDate.getTime())) return 'gray';

  const daysUntilDue = differenceInCalendarDays(startOfDay(dueDate), startOfDay(today));
  return daysUntilDue <= 2 ? 'amber' : 'blue';
}

export function columnStatusColor(
  tasks: Array<Pick<ITaskItem, 'dueDate' | 'isDone'>>,
  isFinalActiveColumn = false,
  today = new Date(),
): TaskStatusColor {
  if (isFinalActiveColumn) return 'green';

  const colors = tasks.map((task) => statusColor(task, false, today));
  if (colors.includes('amber')) return 'amber';
  if (colors.includes('blue')) return 'blue';
  return 'gray';
}

export const taskStatusBorderClass: Record<TaskStatusColor, string> = {
  gray: 'border-l-slate-300',
  blue: 'border-l-blue-500',
  amber: 'border-l-amber-500',
  green: 'border-l-emerald-500',
};

export const taskStatusDotClass: Record<TaskStatusColor, string> = {
  gray: 'bg-slate-300',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
};
