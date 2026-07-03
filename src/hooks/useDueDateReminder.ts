import { useEffect } from 'react';
import { isPast, isToday, parseISO, startOfDay } from 'date-fns';
import { notify } from '../components/organisms/toast/notify';

import type { BoardData } from '../types/task.type';

const reminderStorageKey = 'kanban_due_date_reminder_date';

export function useDueDateReminder(boardData: BoardData) {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const todayKey = new Date().toISOString().slice(0, 10);
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
      `${todayTasks.length} due today · ${overdueTasks.length} overdue`
    );
  }, [boardData.task]);
}
