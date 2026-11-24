import { useEffect } from 'react';
import { translateNow } from '../i18n/context';
import { format, isPast, isToday, parseISO, startOfDay } from 'date-fns';
import { notify } from '../components/organisms/toast/notify';

import type { StorageScope } from '../shared/storage/storageAdapter';
import type { BoardData } from '../types/task.type';

export const reminderKey = (scope: StorageScope) => `kora.dueReminder.v1:${scope.userId ?? 'anon'}:${scope.workspaceId ?? 'none'}`;

export function useDueDateReminder(boardData: BoardData, scope: StorageScope, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    // The person's own day, not the UTC day, which changes mid-morning in Vietnam.
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const reminderStorageKey = reminderKey(scope);
    const lastReminderDate = window.localStorage.getItem(reminderStorageKey);

    if (lastReminderDate === todayKey) {
      return;
    }

    const activeTasks = Object.values(boardData.task).filter((task) => !task.isDone && task.dueDate);
    const todayTasks = activeTasks.filter((task) => task.dueDate && isToday(parseISO(task.dueDate)));
    const overdueTasks = activeTasks.filter((task) => {
      if (!task.dueDate) {
        return false;
      }

      const dueDate = startOfDay(parseISO(task.dueDate));
      return isPast(dueDate) && !isToday(dueDate);
    });

    if (todayTasks.length === 0 && overdueTasks.length === 0) {
      return;
    }

    window.localStorage.setItem(reminderStorageKey, todayKey);
    notify.info(
      translateNow('app.dueSummary', { today: todayTasks.length, overdue: overdueTasks.length })
    );
  }, [boardData.task, enabled, scope]);
}
