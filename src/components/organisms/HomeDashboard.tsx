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
import { Skeleton, SkeletonCard } from '../atoms/skeleton';
import { useI18n } from '../../i18n';
import { useHomeAppearance } from '../../hooks/useHomeAppearance';
import HomeAppearanceSwitcher from '../home/HomeAppearanceSwitcher';

interface HomeDashboardProps {
  onOpenTask: (taskId: string, boardId: string) => void;
  onOpenBoard: (boardId: string) => void;
  onToggleFocusTask: (task: HomeTaskSummary) => void;
  onStartFocusTask?: (task: HomeTaskSummary) => void;
  isFocusTask: (taskId: string) => boolean;
  currentUser: AppUser;
  activeWorkspace: WorkspaceSummary | null;
  onCreateBoard?: () => void;
  onCreateTask?: () => void;
  onOpenQuickPlan?: () => void;
  onOpenToday?: () => void;
  focusTaskCount?: number;
  focusSessionsToday?: number;
  hasTeamMembers?: boolean;
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

function getTaskDueOffset(task: HomeTaskSummary) {
  const dueDate = parseTaskDueDate(task);

  if (!dueDate) {
    return null;
  }

  return differenceInCalendarDays(startOfDay(dueDate), startOfDay(new Date()));
}

function HomeDashboard({
  onOpenTask,
  onOpenBoard,
  onToggleFocusTask,
  onStartFocusTask,
  isFocusTask,
  currentUser,
  activeWorkspace,
  onCreateBoard,
  onCreateTask,
  onOpenQuickPlan,
  onOpenToday,
  focusTaskCount = 0,
  focusSessionsToday = 0,
  hasTeamMembers = false,
}: HomeDashboardProps) {
  const { t } = useI18n();
  const { appearance, setAppearance } = useHomeAppearance();
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
  const weekGlance = getWeekGlance(myTasks);
  const hasWeekPlanningData = myTasks.length > 0;
  const dueTodayCount = myTasks.filter((task) => getTaskDueOffset(task) === 0).length;
  const dueThisWeekCount = weekGlance.upcomingTasks.length;
  const firstBoardId = recentBoards[0]?.id;
  const openFirstBoard = firstBoardId ? () => onOpenBoard(firstBoardId) : onCreateBoard;
  const productSupportCopy = hasTeamMembers
    ? t('home.description.team')
    : t('home.description.solo');

  // --- Hero state machine: Plan -> Today -> Focus -> Done ---
  // The hero surfaces the single next step in the flow. Focus tasks are derived
  // from this page's own data (assigned-to-me tasks also pinned to the Focus
  // Dock) so the "Today's Focus" section never shows "0 / no tasks" while the
  // momentum stats report focus tasks are selected.
  const hasTasks = myTasks.length > 0;
  const hasFocus = focusTaskCount > 0;
  const focusTasksInMyList = myTasks.filter((task) => isFocusTask(task.id));
  const heroFocusTask = focusTasksInMyList[0] ?? null;
  const focusTasksElsewhere = hasFocus && focusTasksInMyList.length === 0;
  const heroFocusPriorityClass = heroFocusTask
    ? getPriorityBadgeClass(heroFocusTask.priority || undefined)
    : null;

  // Candidate tasks for the "choose focus" guiding empty state — top assigned
  // tasks not yet pinned to focus (myTasks is already due-date sorted by the
  // service).
  const focusCandidates = myTasks
    .filter((task) => !isFocusTask(task.id))
    .slice(0, 5);

  const heroMode: 'empty' | 'choose' | 'focus' = !hasTasks && !hasFocus
    ? 'empty'
    : !hasFocus
      ? 'choose'
      : 'focus';

  return (
    <div className="min-h-screen bg-canvas" data-home-theme={appearance}>
      <main className="mx-auto max-w-7xl px-5 py-6 sm:px-7" aria-busy={isLoading}>
        <PageHeader
          eyebrow={t('home.eyebrow')}
          title={t('home.title')}
          description={productSupportCopy}
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
            <section
              aria-label={t('home.momentum')}
              className="grid gap-3 rounded-3xl border border-slate-200/80 bg-white p-3 shadow-card sm:grid-cols-2 lg:grid-cols-5"
            >
              <div className={`rounded-2xl px-4 py-3 ${weekGlance.overdueTasks.length > 0 ? 'bg-rose-50 text-rose-800' : 'bg-slate-50 text-slate-700'}`}>
                <p className="text-2xl font-semibold tracking-[-0.04em]">{weekGlance.overdueTasks.length}</p>
                <p className="mt-1 text-xs font-semibold">
                  {weekGlance.overdueTasks.length === 1 ? t('home.overdue.one') : t('home.overdue.many')}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">
                <p className="text-2xl font-semibold tracking-[-0.04em]">{dueTodayCount}</p>
                <p className="mt-1 text-xs font-semibold">{dueTodayCount === 1 ? t('home.dueToday.one') : t('home.dueToday.many')}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">
                <p className="text-2xl font-semibold tracking-[-0.04em]">{dueThisWeekCount}</p>
                <p className="mt-1 text-xs font-semibold">{dueThisWeekCount === 1 ? t('home.dueWeek.one') : t('home.dueWeek.many')}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">
                <p className="text-2xl font-semibold tracking-[-0.04em]">{focusTaskCount}</p>
                <p className="mt-1 text-xs font-semibold">{focusTaskCount === 1 ? t('home.focusTask.one') : t('home.focusTask.many')}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">
                <p className="text-2xl font-semibold tracking-[-0.04em]">{focusSessionsToday}</p>
                <p className="mt-1 text-xs font-semibold">{focusSessionsToday === 1 ? t('home.focusSession.one') : t('home.focusSession.many')}</p>
              </div>
            </section>

            {heroMode === 'empty' && (
              <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-700">
                  {t('home.startHere')}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  {t('home.emptyTitle')}
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                  {t('home.emptyDescription')}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {onOpenQuickPlan && (
                    <button
                      type="button"
                      onClick={onOpenQuickPlan}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                    >
                      <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      {t('home.quickPlanCta')}
                    </button>
                  )}
                  {onCreateTask && (
                    <button
                      type="button"
                      onClick={onCreateTask}
                      className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
                    >
                      {t('home.createSingleTask')}
                    </button>
                  )}
                  {openFirstBoard && (
                    <button
                      type="button"
                      onClick={openFirstBoard}
                      className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
                    >
                      {t('home.openBoard')}
                    </button>
                  )}
                </div>
              </section>
            )}

            {heroMode === 'choose' && (
              <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-700">
                  {t('home.chooseFocus')}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  {t('home.chooseFocusTitle')}
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                  {t('home.chooseFocusHelper', { count: myTasks.length })}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {onOpenToday && (
                    <button
                      type="button"
                      onClick={onOpenToday}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                    >
                      <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                      {t('home.openToday')}
                    </button>
                  )}
                  {onOpenQuickPlan && (
                    <button
                      type="button"
                      onClick={onOpenQuickPlan}
                      className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
                    >
                      {t('home.quickPlan')}
                    </button>
                  )}
                  {openFirstBoard && (
                    <button
                      type="button"
                      onClick={openFirstBoard}
                      className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
                    >
                      {t('home.openBoard')}
                    </button>
                  )}
                </div>
              </section>
            )}
            {heroMode === 'focus' && (
              <section
                aria-labelledby="home-focus-now-title"
                className="rounded-3xl border border-blue-200/70 bg-blue-50/50 p-6 sm:p-7"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-700">
                    {t('home.focusNow')}
                  </p>
                </div>

                {heroFocusTask ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenTask(heroFocusTask.id, heroFocusTask.boardId)}
                      className="mt-2 block w-full cursor-pointer rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    >
                      <h2
                        id="home-focus-now-title"
                        className="truncate text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-3xl"
                      >
                        {heroFocusTask.title}
                      </h2>
                    </button>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {heroFocusTask.priority && heroFocusPriorityClass && (
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${heroFocusPriorityClass}`}>
                          {heroFocusTask.priority}
                        </span>
                      )}
                      <DueDateBadge dueDate={heroFocusTask.dueDate || undefined} />
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                        {heroFocusTask.boardTitle}
                      </span>
                    </div>

                    <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                      {t('home.focusNowHelper')}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={onStartFocusTask ? () => onStartFocusTask(heroFocusTask) : onOpenToday || (() => onOpenTask(heroFocusTask.id, heroFocusTask.boardId))}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                      >
                        <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t('home.startFocus')}
                      </button>
                      {onOpenToday && (
                        <button
                          type="button"
                          onClick={onOpenToday}
                          className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
                        >
                          {t('home.openToday')}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <h2
                      id="home-focus-now-title"
                      className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950"
                    >
                      {t('home.focusElsewhereTitle')}
                    </h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                      {t('home.focusElsewhereDescription', { count: focusTaskCount })}
                    </p>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      {onOpenToday && (
                        <button
                          type="button"
                          onClick={onOpenToday}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                        >
                          <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                          </svg>
                          {t('home.openToday')}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <SectionCard>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600">
                    {t('home.focusSectionTitle')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">{t('home.focusSectionHelper')}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {t('home.focusSelectedCount', { count: focusTaskCount, max: 3 })}
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {focusTasksInMyList.length > 0 ? (
                  focusTasksInMyList.map((task) => {
                    const priorityClassName = getPriorityBadgeClass(task.priority || undefined);

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
                        className="grid w-full gap-3 px-5 py-4 text-left transition-[background,transform] duration-200 hover:bg-slate-50/90 active:scale-[0.995] md:grid-cols-[minmax(0,1fr)_auto_auto] focus:outline-none focus:ring-2 focus:ring-sky-300"
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
                              {t('home.noPriority')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-start gap-2 md:justify-end">
                          <DueDateBadge dueDate={task.dueDate || undefined} />
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onToggleFocusTask(task);
                            }}
                            className="cursor-pointer rounded-2xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-300"
                            aria-pressed={true}
                            aria-label={`${t('home.removeFromFocus')}: ${task.title}`}
                          >
                            {FOCUS_BUTTON_LABELS.ACTIVE}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : focusTasksElsewhere ? (
                  <div className="p-5">
                    <EmptyState
                      title={t('home.focusElsewhereTitle')}
                      description={t('home.focusElsewhereDescription', { count: focusTaskCount })}
                      compact
                      action={onOpenToday ? (
                        <button
                          type="button"
                          onClick={onOpenToday}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                        >
                          {t('home.openToday')}
                        </button>
                      ) : undefined}
                    />
                  </div>
                ) : hasTasks ? (                  <>
                    <div className="p-5">
                      <EmptyState
                        title={t('home.focusEmptyTitle')}
                        description={t('home.focusEmptyDescription')}
                        compact
                      />
                    </div>
                    {focusCandidates.length > 0 && (
                      <div className="border-t border-slate-100 px-5 py-4">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          {t('home.focusCandidatesLabel')}
                        </p>
                        <div className="divide-y divide-slate-100">
                          {focusCandidates.map((task) => {
                            const priorityClassName = getPriorityBadgeClass(task.priority || undefined);

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
                                className="grid w-full gap-3 py-3 text-left transition-colors hover:bg-slate-50/90 md:grid-cols-[minmax(0,1fr)_auto_auto] focus:outline-none focus:ring-2 focus:ring-sky-300"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-800">{task.title}</p>
                                  <p className="mt-0.5 truncate text-xs text-slate-500">{task.boardTitle}</p>
                                </div>
                                <div className="flex items-center">
                                  {task.priority && priorityClassName ? (
                                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${priorityClassName}`}>
                                      {task.priority}
                                    </span>
                                  ) : (
                                    <span className="rounded-full border border-dashed border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-400">
                                      {t('home.noPriority')}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-end">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onToggleFocusTask(task);
                                    }}
                                    className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-300"
                                    aria-pressed={false}
                                    aria-label={`${t('home.addToFocus')}: ${task.title}`}
                                  >
                                    {FOCUS_BUTTON_LABELS.INACTIVE}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-5">
                    <EmptyState
                      title={t('home.noTasksTitle')}
                      description={t('home.noTasksDescription')}
                      compact
                      action={onOpenQuickPlan ? (
                        <button
                          type="button"
                          onClick={onOpenQuickPlan}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                        >
                          {t('home.quickPlanCta')}
                        </button>
                      ) : undefined}
                    />
                  </div>
                )}
              </div>
            </SectionCard>

            <div className="space-y-6">
              <SectionCard>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600">
                      {t('home.continuePlanning')}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">{t('home.continuePlanningHelper')}</p>
                  </div>
                </div>

                {recentBoards.length > 0 ? (
                  <div className="grid gap-2 p-4">
                    {recentBoards.slice(0, 4).map((board) => (
                      <button
                        key={board.id}
                        type="button"
                        onClick={() => onOpenBoard(board.id)}
                        className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-left transition-colors hover:border-sky-200 hover:bg-sky-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                        aria-label={`Open board: ${board.title}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{board.title}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {board.updatedAt ? t('home.updatedOn', { date: format(parseISO(board.updatedAt), 'MMM d') }) : t('home.noRecentActivity')}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                              {t('home.taskCount', { count: board.taskCount })}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition-colors group-hover:text-sky-600">
                              {t('home.openBoard')}
                              <svg className="h-3.5 w-3.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-5">
                    <EmptyState
                      title={t('home.noBoardsTitle')}
                      description={t('home.noBoardsDescription')}
                      compact
                      action={onCreateBoard ? (
                        <button
                          type="button"
                          onClick={onCreateBoard}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
                        >
                          <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          {t('home.createBoard')}
                        </button>
                      ) : undefined}
                    />
                  </div>
                )}
              </SectionCard>

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
      {import.meta.env.DEV && (
        <HomeAppearanceSwitcher current={appearance} onChange={setAppearance} />
      )}
    </div>
  );
}

export default HomeDashboard;
