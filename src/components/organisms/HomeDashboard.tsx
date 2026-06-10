import { useCallback, useEffect, useState } from 'react';
import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  parseISO,
  startOfDay,
} from 'date-fns';

import {
  fetchHomeDashboardData,
  type HomeDashboardData,
  type HomeTaskSummary,
} from '../../services/home.service';
import type { AppUser, WorkspaceSummary } from '../../types/auth.type';
import { FOCUS_BUTTON_LABELS } from '../../constants';
import { getPriorityBadgeClass } from '../../utils/taskMetadata';
import PageHeader from '../atoms/PageHeader';
import SectionCard from '../atoms/SectionCard';
import EmptyState from '../atoms/EmptyState';
import ErrorState from '../atoms/ErrorState';
import DueDateBadge from '../atoms/DueDateBadge';
import MyTasksSummary from '../home/MyTasksSummary';
import { Skeleton, SkeletonCard } from '../atoms/skeleton';

interface HomeDashboardProps {
  onOpenTask: (taskId: string, boardId: string) => void;
  onOpenBoard: (boardId: string) => void;
  onToggleFocusTask: (task: HomeTaskSummary) => void;
  isFocusTask: (taskId: string) => boolean;
  currentUser: AppUser;
  activeWorkspace: WorkspaceSummary | null;
  onCreateBoard?: () => void;
}

function parseTaskDueDate(task: HomeTaskSummary) {
  if (!task.dueDate) {
    return null;
  }

  const parsedDate = parseISO(task.dueDate);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getWeekGlance(tasks: HomeTaskSummary[]) {
  const today = startOfDay(new Date());
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index);

    return {
      date,
      label: format(date, 'EEE'),
      dayNumber: format(date, 'd'),
      taskCount: 0,
      isToday: index === 0,
    };
  });
  const overdueTasks: HomeTaskSummary[] = [];
  const upcomingTasks: HomeTaskSummary[] = [];

  tasks.forEach((task) => {
    const dueDate = parseTaskDueDate(task);

    if (!dueDate) {
      return;
    }

    const dayOffset = differenceInCalendarDays(startOfDay(dueDate), today);

    if (dayOffset < 0) {
      overdueTasks.push(task);
      return;
    }

    if (dayOffset <= 6) {
      weekDays[dayOffset].taskCount += 1;
      upcomingTasks.push(task);
    }
  });

  upcomingTasks.sort((currentTask, nextTask) => {
    return (currentTask.dueDate || '').localeCompare(nextTask.dueDate || '');
  });

  return {
    weekDays,
    overdueTasks,
    upcomingTasks,
  };
}

function HomeDashboard({
  onOpenTask,
  onOpenBoard,
  onToggleFocusTask,
  isFocusTask,
  currentUser,
  activeWorkspace,
  onCreateBoard,
}: HomeDashboardProps) {
  const [dashboardData, setDashboardData] = useState<HomeDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const workspaceId = activeWorkspace?.id;

  const loadDashboardData = useCallback(async () => {
    try {
      const data = await fetchHomeDashboardData({
        currentUser,
        workspaceId,
      });
      setDashboardData(data);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load dashboard data.');
    }
  }, [workspaceId, currentUser]);

  useEffect(() => {
    let isMounted = true;

    fetchHomeDashboardData({
      currentUser,
      workspaceId,
    })
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
  }, [workspaceId, currentUser]);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    void loadDashboardData().finally(() => {
      setIsRetrying(false);
    });
  }, [loadDashboardData]);

  const myTasks = dashboardData?.myTasks || [];
  const recentBoards = dashboardData?.recentBoards || [];
  const heroTask = myTasks[0] ?? null;
  const upNextTasks = heroTask ? myTasks.filter((task) => task.id !== heroTask.id).slice(0, 3) : myTasks.slice(0, 3);
  const heroPriorityClass = heroTask ? getPriorityBadgeClass(heroTask.priority || undefined) : null;
  const heroIsFocused = heroTask ? isFocusTask(heroTask.id) : false;
  const weekGlance = getWeekGlance(myTasks);
  const hasWeekPlanningData = myTasks.length > 0;

  return (
    <div className="min-h-screen bg-canvas">
      <main className="mx-auto max-w-7xl px-5 py-6 sm:px-7" aria-busy={isLoading}>
        <PageHeader
          eyebrow="Home"
          title="Start your day"
          description="Pick one task, plan what matters, then move into focus."
          className="mb-6"
          actions={(
            <div className="hidden items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-2 shadow-card sm:flex">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="h-9 w-9 rounded-full object-cover"
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">{currentUser.name}</p>
                  <p className="text-xs text-slate-500">{activeWorkspace?.name || 'Current workspace'}</p>
                </div>
            </div>
          )}
        />

        {isLoading && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <SectionCard>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-2 h-3 w-44" />
                </div>
                <Skeleton className="h-6 w-20" rounded="rounded-full" />
              </div>
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    aria-hidden="true"
                    className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
                  >
                    <div className="min-w-0">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="mt-2 h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-5 w-16" rounded="rounded-full" />
                    <Skeleton className="h-5 w-20" rounded="rounded-full" />
                    <Skeleton className="h-7 w-20" rounded="rounded-2xl" />
                  </div>
                ))}
              </div>
            </SectionCard>

            <div className="space-y-6">
              <SectionCard>
                <div className="border-b border-slate-100 px-5 py-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-2 h-3 w-40" />
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1">
                  <SkeletonCard lines={2} />
                  <SkeletonCard lines={2} />
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {!isLoading && errorMessage && (
          <ErrorState
            title="Couldn't load your dashboard"
            description="Something went wrong while loading your tasks and boards."
            details={errorMessage}
            onRetry={handleRetry}
            isRetrying={isRetrying}
          />
        )}

        {!isLoading && !errorMessage && (
          <div className="space-y-6">
            {/* Focus Now hero — the decisive "what to do now" surface. Uses the
                top due-sorted assigned task and only existing handlers (open /
                toggle focus); no timer logic here (Focus Dock is Phase 4). */}
            {heroTask ? (
              <section
                aria-labelledby="home-focus-now-title"
                className="rounded-3xl border border-blue-200/70 bg-blue-50/50 p-6 sm:p-7"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-700">
                    Recommended next
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenTask(heroTask.id, heroTask.boardId)}
                  className="mt-2 block w-full cursor-pointer rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <h2
                    id="home-focus-now-title"
                    className="truncate text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-3xl"
                  >
                    {heroTask.title}
                  </h2>
                </button>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {heroTask.priority && heroPriorityClass && (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${heroPriorityClass}`}>
                      {heroTask.priority}
                    </span>
                  )}
                  <DueDateBadge dueDate={heroTask.dueDate || undefined} />
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    {heroTask.boardTitle}
                  </span>
                </div>

                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                  Your highest-priority assigned task. Open it to start, or pin it to your Focus Dock to
                  work on it next.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenTask(heroTask.id, heroTask.boardId)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                  >
                    <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  Open task
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleFocusTask(heroTask)}
                    aria-pressed={heroIsFocused}
                    className={`inline-flex cursor-pointer items-center rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 ${
                      heroIsFocused
                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {heroIsFocused ? 'Ready to focus' : 'Plan for focus'}
                  </button>
                </div>
              </section>
            ) : (
              <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-700">Start here</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  Nothing assigned to you yet
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                  When a task is assigned to you it shows up here first. Create a board to start planning
                  your work.
                </p>
                {onCreateBoard && (
                  <button
                    type="button"
                    onClick={onCreateBoard}
                    className="mt-5 inline-flex cursor-pointer items-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                  >
                    Create a board
                  </button>
                )}
              </section>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <SectionCard>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600">Up next</h2>
                  <p className="mt-1 text-sm text-slate-500">Only the next few tasks, sorted by due date.</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {myTasks.length} total
                </span>
              </div>

              <div className="border-b border-slate-100 px-5 py-3">
                <MyTasksSummary tasks={myTasks} />
              </div>

              <div className="divide-y divide-slate-100">
                {myTasks.length === 0 ? (
                  <div className="p-5">
                    <EmptyState
                      title="No assigned tasks"
                      description="Tasks assigned to you across this workspace will show up here."
                      compact
                    />
                  </div>
                ) : (
                  upNextTasks.map((task) => {
                    const priorityClassName = getPriorityBadgeClass(task.priority || undefined);

                    const isFocused = isFocusTask(task.id);

                    return (
                      <div
                        key={task.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenTask(task.id, task.boardId)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onOpenTask(task.id, task.boardId);
                          }
                        }}
                        className="grid w-full gap-3 px-5 py-4 text-left transition-[background,transform] duration-200 hover:bg-slate-50/90 active:scale-[0.995] md:grid-cols-[minmax(0,1fr)_auto_auto_auto] focus:outline-none focus:ring-2 focus:ring-sky-300"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{task.title}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{task.boardTitle}</p>
                        </div>

                        <div className="flex items-center">
                          {task.priority && priorityClassName ? (
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${priorityClassName}`}>
                              {task.priority}
                            </span>
                          ) : (
                            <span className="rounded-full border border-dashed border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-400">
                              No priority
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-start md:justify-end">
                          <DueDateBadge dueDate={task.dueDate || undefined} />
                        </div>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleFocusTask(task);
                          }}
                          className={`cursor-pointer rounded-2xl border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-300 ${
                            isFocused
                              ? 'border-sky-200 bg-sky-50 text-sky-700'
                              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                          aria-pressed={isFocused}
                          aria-label={`${isFocused ? 'Remove from' : 'Add to'} Focus Dock: ${task.title}`}
                        >
                          {isFocused ? FOCUS_BUTTON_LABELS.ACTIVE : FOCUS_BUTTON_LABELS.INACTIVE}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </SectionCard>

            <div className="space-y-6">
              {recentBoards.length > 0 && (
              <SectionCard>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600">Continue planning</h2>
                    <p className="mt-1 text-sm text-slate-500">Recent boards, kept secondary to today's work.</p>
                  </div>
                </div>

                <div className="grid gap-2 p-4">
                  {recentBoards.slice(0, 4).map((board) => (
                    <button
                      key={board.id}
                      type="button"
                      onClick={() => onOpenBoard(board.id)}
                      className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-left transition-colors hover:border-sky-200 hover:bg-sky-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                      aria-label={`Open board: ${board.title}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{board.title}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {board.updatedAt ? `Updated ${format(parseISO(board.updatedAt), 'MMM d')}` : 'No recent activity'}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {board.taskCount} tasks
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </SectionCard>
              )}

              {hasWeekPlanningData && (
              <SectionCard className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600">This Week</h2>
                    <p className="mt-1 text-sm text-slate-500">A quiet glance at upcoming due work.</p>
                  </div>
                  {weekGlance.overdueTasks.length > 0 && (
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                      {weekGlance.overdueTasks.length} overdue
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {weekGlance.weekDays.map((day) => (
                    <div
                      key={day.date.toISOString()}
                      className={`rounded-2xl border px-2 py-2 text-center ${
                        day.isToday
                          ? 'border-blue-200 bg-blue-50 text-blue-800'
                          : day.taskCount > 0
                            ? 'border-slate-200 bg-slate-50 text-slate-700'
                            : 'border-slate-100 bg-white text-slate-400'
                      }`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide">{day.label}</p>
                      <p className="mt-1 text-sm font-semibold">{day.dayNumber}</p>
                      <div className="mt-1 flex h-4 items-center justify-center">
                        {day.taskCount > 0 ? (
                          <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            {day.taskCount}
                          </span>
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-200" aria-hidden="true" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {weekGlance.upcomingTasks.length > 0 ? (
                  <div className="mt-4 grid gap-2">
                    {weekGlance.upcomingTasks.slice(0, 3).map((task) => {
                      const dueDate = parseTaskDueDate(task);

                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => onOpenTask(task.id, task.boardId)}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-left transition-colors hover:border-sky-200 hover:bg-sky-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                        >
                          <span className="min-w-0 truncate text-sm font-semibold text-slate-800">{task.title}</span>
                          <span className="shrink-0 text-xs font-medium text-slate-500">
                            {dueDate && isSameDay(dueDate, new Date()) ? 'Today' : dueDate ? format(dueDate, 'EEE d') : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    No deadlines this week.
                  </p>
                )}
              </SectionCard>
              )}
            </div>
          </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default HomeDashboard;
