import { differenceInCalendarDays, isToday, parseISO, startOfDay } from 'date-fns';

import type { ITaskItem } from '../types/task.type';
import type { TaskPriority } from '../constants';

export interface DueDateStatusMeta {
  status: 'overdue' | 'today' | 'upcoming' | 'none';
  label: string;
  className: string;
  iconName: 'alert' | 'clock' | 'calendar';
}

const priorityClassMap: Record<NonNullable<ITaskItem['priority']>, string> = {
  High: 'bg-red-50 text-red-700 border border-red-200',
  Medium: 'bg-amber-50 text-amber-700 border border-amber-200',
  Low: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Lowest: 'bg-gray-50 text-gray-700 border border-gray-200',
};

export function getPriorityBadgeClass(priority?: ITaskItem['priority']) {
  if (!priority) return null;
  return priorityClassMap[priority];
}

const priorityDotClassMap: Record<TaskPriority, string> = {
  High: 'bg-red-500',
  Medium: 'bg-amber-500',
  Low: 'bg-emerald-500',
  Lowest: 'bg-gray-400',
};

export function getPriorityDotClass(priority: string): string {
  return priorityDotClassMap[priority as TaskPriority] ?? 'bg-gray-400';
}

export function getDueDateStatus(dueDate?: string, isDone?: boolean): DueDateStatusMeta {
  if (isDone) {
    return {
      status: 'none',
      label: 'Completed',
      className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      iconName: 'calendar',
    };
  }

  if (!dueDate) {
    return {
      status: 'none',
      label: 'No due date',
      className: 'bg-gray-50 text-gray-500 border border-gray-200 border-dashed',
      iconName: 'calendar',
    };
  }

  const parsedDueDate = parseISO(dueDate);

  if (Number.isNaN(parsedDueDate.getTime())) {
    return {
      status: 'none',
      label: 'Invalid date',
      className: 'bg-gray-50 text-gray-400 border border-gray-200',
      iconName: 'calendar',
    };
  }

  // Use start of day for accurate day-to-day calendar difference
  const today = startOfDay(new Date());
  const due = startOfDay(parsedDueDate);

  if (isToday(due)) {
    return {
      status: 'today',
      label: 'Due today',
      className: 'bg-amber-100 text-amber-800 border border-amber-300 font-medium',
      iconName: 'clock',
    };
  }

  const daysDifference = differenceInCalendarDays(due, today);

  if (daysDifference < 0) {
    const overdueDays = Math.abs(daysDifference);
    return {
      status: 'overdue',
      label: `Overdue ${overdueDays} day${overdueDays !== 1 ? 's' : ''}`,
      className: 'bg-red-100 text-red-800 border border-red-300 font-semibold',
      iconName: 'alert',
    };
  }

  if (daysDifference === 1) {
    return {
      status: 'upcoming',
      label: 'Due tomorrow',
      className: 'bg-sky-50 text-sky-800 border border-sky-200 font-medium',
      iconName: 'calendar',
    };
  }

  return {
    status: 'upcoming',
    label: `${daysDifference} days left`,
    className: 'bg-slate-50 text-slate-700 border border-slate-200',
    iconName: 'calendar',
  };
}
