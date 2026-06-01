import { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';

import type { BoardData, ITaskItem } from '../../types/task.type';
import { doesTaskMatchFilters } from '../../utils/taskFilters';
import { getDueDateStatus } from '../../utils/taskMetadata';
import { getTaskLabelClass } from '../../utils/taskCollections';

interface CalendarBoardViewProps {
  boardData: BoardData;
  searchQuery: string;
  filterPriority: string;
  filterAssignee: string;
  filterDueDate: string;
  onOpenTask: (task: ITaskItem) => void;
}

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function CalendarBoardView({
  boardData,
  searchQuery,
  filterPriority,
  filterAssignee,
  filterDueDate,
  onOpenTask,
}: CalendarBoardViewProps) {
  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(new Date()));

  const scheduledTasks = useMemo(() => {
    return Object.values(boardData.task)
      .filter((task): task is ITaskItem => Boolean(task))
      .filter((task) => Boolean(task.dueDate))
      .filter((task) => doesTaskMatchFilters(task, {
        searchQuery,
        filterPriority,
        filterAssignee,
        filterDueDate,
      }))
      .sort((currentTask, nextTask) => {
        return (currentTask.dueDate || '').localeCompare(nextTask.dueDate || '') || currentTask.title.localeCompare(nextTask.title);
      });
  }, [boardData.task, searchQuery, filterPriority, filterAssignee, filterDueDate]);

  const tasksByDueDate = useMemo(() => {
    return scheduledTasks.reduce<Map<string, ITaskItem[]>>((taskGroups, task) => {
      const dueDateKey = task.dueDate;

      if (!dueDateKey) {
        return taskGroups;
      }

      const currentTasks = taskGroups.get(dueDateKey) || [];
      currentTasks.push(task);
      taskGroups.set(dueDateKey, currentTasks);

      return taskGroups;
    }, new Map<string, ITaskItem[]>());
  }, [scheduledTasks]);

  const calendarDays = useMemo(() => {
    const firstVisibleDay = startOfWeek(startOfMonth(activeMonth));
    const lastVisibleDay = endOfWeek(endOfMonth(activeMonth));
    const days: Date[] = [];

    let currentDay = firstVisibleDay;

    while (currentDay <= lastVisibleDay) {
      days.push(currentDay);
      currentDay = addDays(currentDay, 1);
    }

    return days;
  }, [activeMonth]);

  const scheduledTaskCount = scheduledTasks.length;
  const overdueTaskCount = scheduledTasks.filter((task) => getDueDateStatus(task.dueDate, task.isDone).status === 'overdue').length;

  return (
    <div className="px-6 pb-6">
      <div className="mb-5 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              Calendar View
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
              {format(activeMonth, 'MMMM yyyy')}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {scheduledTaskCount} scheduled tasks, {overdueTaskCount} overdue
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveMonth((currentMonth) => subMonths(currentMonth, 1))}
              className="cursor-pointer rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setActiveMonth(startOfMonth(new Date()))}
              className="cursor-pointer rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setActiveMonth((currentMonth) => addMonths(currentMonth, 1))}
              className="cursor-pointer rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {weekdayLabels.map((weekdayLabel) => (
            <div
              key={weekdayLabel}
              className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-gray-500"
            >
              {weekdayLabel}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map((day) => {
            const tasksForDay = tasksByDueDate.get(format(day, 'yyyy-MM-dd')) || [];
            const isOutsideActiveMonth = !isSameMonth(day, activeMonth);

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[180px] border-b border-r border-gray-100 p-3 align-top ${
                  isOutsideActiveMonth ? 'bg-gray-50/80' : 'bg-white'
                } ${isToday(day) ? 'ring-1 ring-inset ring-blue-200' : ''}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      isToday(day)
                        ? 'bg-blue-600 text-white'
                        : isOutsideActiveMonth
                          ? 'text-gray-400'
                          : 'text-gray-800'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>

                  {tasksForDay.length > 0 && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                      {tasksForDay.length}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {tasksForDay.length === 0 ? (
                    <div className="text-xs text-gray-300">
                      No tasks
                    </div>
                  ) : (
                    tasksForDay.slice(0, 4).map((task) => {
                      const dueStatus = getDueDateStatus(task.dueDate, task.isDone);

                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => onOpenTask(task)}
                          className="w-full cursor-pointer rounded-xl border border-gray-200 bg-white px-3 py-2 text-left shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                          aria-label={`Open task: ${task.title}`}
                        >
                          <div className="mb-1 flex flex-wrap gap-1">
                            {task.labels.slice(0, 1).map((label) => (
                              <span
                                key={label.id}
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${getTaskLabelClass(label.color)}`}
                              >
                                {label.name}
                              </span>
                            ))}
                          </div>
                          <p className="line-clamp-2 text-xs font-semibold text-gray-800">{task.title}</p>
                          <p className="mt-1 text-[11px] text-gray-500">{dueStatus.label}</p>
                        </button>
                      );
                    })
                  )}

                  {tasksForDay.length > 4 && (
                    <div className="rounded-lg bg-gray-50 px-3 py-2 text-[11px] font-semibold text-gray-500">
                      +{tasksForDay.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CalendarBoardView;
