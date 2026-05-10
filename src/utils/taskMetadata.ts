import { differenceInCalendarDays, isToday, parseISO } from 'date-fns';

import type { ITaskItem } from '../types/task.type';

interface TaskDueDateMeta {
  label: string;
  className: string;
  isOverdue: boolean;
}

const priorityClassMap: Record<NonNullable<ITaskItem['priority']>, string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-orange-100 text-orange-700',
  Low: 'bg-green-100 text-green-700',
  Lowest: 'bg-gray-100 text-gray-700',
};

export function getPriorityBadgeClass(priority?: ITaskItem['priority']) {
  if (!priority) return null;

  return priorityClassMap[priority];
}

export function getDueDateMeta(dueDate?: string): TaskDueDateMeta | null {
  if (!dueDate) return null;

  const parsedDueDate = parseISO(dueDate);

  if (Number.isNaN(parsedDueDate.getTime())) {
    return null;
  }

  if (isToday(parsedDueDate)) {
    return {
      label: 'Due today',
      className: 'text-orange-700',
      isOverdue: false,
    };
  }

  const daysDifference = differenceInCalendarDays(parsedDueDate, new Date());

  if (daysDifference < 0) {
    const overdueDays = Math.abs(daysDifference);

    return {
      label: `Overdue ${overdueDays} day${overdueDays !== 1 ? 's' : ''}`,
      className: 'text-red-700',
      isOverdue: true,
    };
  }

  return {
    label: `${daysDifference} day${daysDifference !== 1 ? 's' : ''} left`,
    className: 'text-gray-500',
    isOverdue: false,
  };
}
