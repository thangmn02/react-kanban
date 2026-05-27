import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

import { CURRENT_USER } from '../../data/currentUser';
import {
  fetchHomeDashboardData,
  type HomeDashboardData,
  type HomeTaskSummary,
} from '../../services/home.service';
import { getPriorityBadgeClass } from '../../utils/taskMetadata';
import DueDateBadge from '../atoms/DueDateBadge';

interface HomeDashboardProps {
  onOpenTask: (taskId: string, boardId: string) => void;
  onOpenBoard: (boardId: string) => void;
}

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildMonthDays() {
  const currentMonth = startOfMonth(new Date());
  const firstVisibleDay = startOfWeek(currentMonth);
  const lastVisibleDay = endOfWeek(endOfMonth(currentMonth));
  const days: Date[] = [];
  let cursor = firstVisibleDay;

  while (cursor <= lastVisibleDay) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return days;
}

function getTasksDueThisWeek(tasks: HomeTaskSummary[]) {
  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());

  return tasks.filter((task) => {
    if (!task.dueDate) {
      return false;
    }

    const dueDate = parseISO(task.dueDate);
    return dueDate >= weekStart && dueDate <= weekEnd;
  });
}

function HomeDashboard({ onOpenTask, onOpenBoard }: HomeDashboardProps) {
  const [dashboardData, setDashboardData] = useState<HomeDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const monthDays = useMemo(() => buildMonthDays(), []);

  useEffect(() => {
    let isMounted = true;

    fetchHomeDashboardData()
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setDashboardData(data);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : 'Unable to load dashboard data.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const currentMonth = startOfMonth(new Date());
  const myTasks = dashboardData?.myTasks || [];
  const recentBoards = dashboardData?.recentBoards || [];
  const holidays = dashboardData?.holidays || [];
  const tasksDueThisWeek = getTasksDueThisWeek(myTasks);
  const holidaysThisWeek = holidays.filter((holiday) => {
    const holidayDate = parseISO(holiday.date);
    return holidayDate >= startOfWeek(new Date()) && holidayDate <= endOfWeek(new Date());
  });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white px-4 py-5 lg:block">
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600">Kanban</p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">Workspace</h2>
        </div>

        <nav className="space-y-2">
          <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
            Home
          </div>
        </nav>

        <div className="mt-8">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            Recent boards
          </p>
          <div className="space-y-2">
            {recentBoards.slice(0, 4).map((board) => (
              <button
                key={board.id}
                type="button"
                onClick={() => onOpenBoard(board.id)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                {board.title}
              </button>
            ))}
            {!isLoading && recentBoards.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">No boards yet.</p>
            )}
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600">Home</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Personal dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            {CURRENT_USER.name}'s assigned tasks, recent boards, and due-date rhythm.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <img
            src={CURRENT_USER.avatar}
            alt={CURRENT_USER.name}
            className="h-9 w-9 rounded-full object-cover"
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">{CURRENT_USER.name}</p>
            <p className="text-xs text-gray-500">Current assignee</p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
          Loading dashboard data...
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-600">My Tasks</h2>
                <p className="mt-1 text-sm text-gray-500">{myTasks.length} assigned tasks sorted by due date</p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Due first
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {myTasks.length === 0 ? (
                <div className="px-5 py-8 text-sm text-gray-400">No assigned tasks found.</div>
              ) : (
                myTasks.map((task) => {
                  const priorityClassName = getPriorityBadgeClass(task.priority || undefined);

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onOpenTask(task.id, task.boardId)}
                      className="grid w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50 md:grid-cols-[minmax(0,1fr)_auto_auto]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{task.title}</p>
                        <p className="mt-1 truncate text-xs text-gray-500">{task.boardTitle}</p>
                      </div>

                      <div className="flex items-center">
                        {task.priority && priorityClassName ? (
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${priorityClassName}`}>
                            {task.priority}
                          </span>
                        ) : (
                          <span className="rounded-full border border-dashed border-gray-200 px-2.5 py-0.5 text-[11px] text-gray-400">
                            No priority
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-start md:justify-end">
                        <DueDateBadge dueDate={task.dueDate || undefined} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-600">Recent Boards</h2>
                  <p className="mt-1 text-sm text-gray-500">Boards ordered by recent activity</p>
                </div>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1">
                {recentBoards.map((board) => (
                  <button
                    key={board.id}
                    type="button"
                    onClick={() => onOpenBoard(board.id)}
                    className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{board.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-gray-500">{board.description || 'No description'}</p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                        {board.taskCount} tasks
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {board.memberAvatars.length === 0 ? (
                          <span className="text-xs text-gray-400">No members</span>
                        ) : (
                          board.memberAvatars.map((avatar) => (
                            <img
                              key={avatar}
                              src={avatar}
                              alt=""
                              className="h-7 w-7 rounded-full border-2 border-white object-cover"
                            />
                          ))
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400">
                        {board.updatedAt ? format(parseISO(board.updatedAt), 'MMM d') : 'No activity'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-600">Lazy Calendar</h2>
                <p className="mt-1 text-sm text-gray-500">{format(currentMonth, 'MMMM yyyy')}</p>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-7 gap-1 text-center">
                  {weekdayLabels.map((weekday) => (
                    <div key={weekday} className="py-2 text-[11px] font-semibold uppercase text-gray-400">
                      {weekday}
                    </div>
                  ))}

                  {monthDays.map((day) => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const dueTaskCount = myTasks.filter((task) => task.dueDate === dayKey).length;
                    const holiday = holidays.find((currentHoliday) => isSameDay(parseISO(currentHoliday.date), day));
                    const isOutsideMonth = !isSameMonth(day, currentMonth);

                    return (
                      <div
                        key={day.toISOString()}
                        className={`relative min-h-12 rounded-lg border px-1 py-1.5 text-center ${
                          isToday(day)
                            ? 'border-blue-500 bg-blue-50'
                            : holiday
                              ? 'border-rose-200 bg-rose-50'
                              : 'border-gray-100 bg-white'
                        } ${isOutsideMonth ? 'opacity-40' : ''}`}
                        title={holiday?.name}
                      >
                        <div className={`text-xs font-semibold ${isToday(day) ? 'text-blue-700' : 'text-gray-700'}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="mt-1 flex items-center justify-center gap-1">
                          {holiday && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
                          {dueTaskCount > 0 && (
                            <span className="rounded-full bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                              {dueTaskCount}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-gray-50 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">This week</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{tasksDueThisWeek.length} tasks due</p>
                  </div>
                  <div className="rounded-lg bg-rose-50 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">Holidays</p>
                    <p className="mt-1 text-sm font-semibold text-rose-800">{holidaysThisWeek.length} this week</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}

export default HomeDashboard;
