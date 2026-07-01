import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { fetchTodayPageData, type TodayPageData, type TodayTaskSummary } from '../../services/today.service';
import { getTodayFocusSuggestions, type FocusReason } from '../../features/today/utils/todayFocusSuggestions';
import type { AppUser, WorkspaceSummary } from '../../types/auth.type';
import type { DailyFocusStats, FocusTask } from '../../types/focus.type';
import PageHeader from '../atoms/PageHeader';
import SectionCard from '../atoms/SectionCard';
import EmptyState from '../atoms/EmptyState';
import ErrorState from '../atoms/ErrorState';
import TodayTaskSection from './TodayTaskSection';
import TodayTaskCard from './TodayTaskCard';
import { Skeleton, SkeletonTaskCard } from '../atoms/skeleton';
import { useI18n } from '../../i18n';

interface TodayPageProps {
  currentUser: AppUser;
  activeWorkspace: WorkspaceSummary | null;
  focusTasks: FocusTask[];
  dailyFocusStats: DailyFocusStats;
  isFocusTask: (taskId: string) => boolean;
  onOpenTask: (task: TodayTaskSummary) => void;
  onStartFocus: (task: TodayTaskSummary) => void;
  onToggleTodayFocus: (task: TodayTaskSummary) => void;
  onQuickCreateTask: () => void;
}

function getEmptyTodayData(): TodayPageData {
  return {
    overdueTasks: [],
    dueTodayTasks: [],
    assignedTasks: [],
    recentlyActiveTasks: [],
  };
}

export default function TodayPage({
  currentUser,
  activeWorkspace,
  focusTasks,
  dailyFocusStats,
  isFocusTask,
  onOpenTask,
  onStartFocus,
  onToggleTodayFocus,
  onQuickCreateTask,
}: TodayPageProps) {
  const [todayData, setTodayData] = useState<TodayPageData>(getEmptyTodayData);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { t } = useI18n();

  const workspaceId = activeWorkspace?.id;

  const loadTodayData = useCallback(async () => {
    try {
      const data = await fetchTodayPageData({
        currentUser,
        workspaceId: workspaceId || null,
      });
      setTodayData(data);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('today.loadError'));
    }
  }, [workspaceId, currentUser, t]);

  useEffect(() => {
    let isMounted = true;

    fetchTodayPageData({
      currentUser,
      workspaceId: workspaceId || null,
    })
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setTodayData(data);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : t('today.loadError'));
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [workspaceId, currentUser, t]);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    void loadTodayData().finally(() => {
      setIsRetrying(false);
    });
  }, [loadTodayData]);

  const hasUrgentTasks = todayData.overdueTasks.length > 0 || todayData.dueTodayTasks.length > 0;
  const hasSecondaryTasks = todayData.assignedTasks.length > 0 || todayData.recentlyActiveTasks.length > 0;

  const focusSuggestions = useMemo(() => {
    const focusTaskIds = new Set(focusTasks.map((task) => task.id));
    return getTodayFocusSuggestions(todayData, 5)
      .filter((suggestion) => !focusTaskIds.has(suggestion.task.id))
      .slice(0, 3);
  }, [todayData, focusTasks]);

  const focusReasonLabels: Record<FocusReason, string> = {
    overdue: t('today.focus.reason.overdue'),
    dueToday: t('today.focus.reason.dueToday'),
    highPriority: t('today.focus.reason.highPriority'),
    recentlyActive: t('today.focus.reason.recentlyActive'),
  };

  const focusReasonBadgeClass = (reason: FocusReason): string => {
    switch (reason) {
      case 'overdue':
        return 'inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700';
      case 'dueToday':
        return 'inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700';
      case 'highPriority':
        return 'inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700';
      case 'recentlyActive':
        return 'inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600';
      default:
        return 'inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600';
    }
  };

  return (
    <main className="min-h-screen bg-canvas px-5 py-7 sm:px-7" aria-busy={isLoading}>
      <section className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow={t('today.eyebrow')}
          title={t('today.title')}
          description={t('today.description')}
          className="mb-7"
          actions={(
            <button
              type="button"
              onClick={onQuickCreateTask}
              className="cursor-pointer rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
            >
              {t('today.quickAddTask')}
            </button>
          )}
        />

        <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">
              {t('today.stats.sessions', { count: dailyFocusStats.completedSessions, plural: dailyFocusStats.completedSessions === 1 ? '' : 's' })}
            </p>
            <p className="text-sm text-slate-500">
              {t('today.stats.minutes', { count: dailyFocusStats.focusedMinutes })}
              {dailyFocusStats.interruptedSessions > 0 ? ` · ${dailyFocusStats.interruptedSessions} interrupted` : ''}
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-6">
              <SectionCard className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="mt-2 h-3 w-56" />
                  </div>
                  <Skeleton className="h-6 w-12" rounded="rounded-full" />
                </div>
                <div className="mt-4 grid gap-3">
                  <SkeletonTaskCard />
                  <SkeletonTaskCard />
                </div>
              </SectionCard>
            </div>

            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, sectionIndex) => (
                <SectionCard key={sectionIndex} className="p-5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-3 w-48" />
                  <div className="mt-4 grid gap-3">
                    <SkeletonTaskCard />
                    <SkeletonTaskCard />
                  </div>
                </SectionCard>
              ))}
            </div>
          </div>
        )}

        {!isLoading && errorMessage && (
          <ErrorState
            title={t('today.errorTitle')}
            description={t('today.errorDescription')}
            details={errorMessage}
            onRetry={handleRetry}
            isRetrying={isRetrying}
          />
        )}

        {!isLoading && !errorMessage && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-6">
              <SectionCard className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600">
                      {t('today.plan')}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {t('today.planDescription')}
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {focusTasks.length}/3
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  {focusTasks.length === 0 ? (
                    <EmptyState
                      title={t('today.noFocusTitle')}
                      description={t('today.noFocusDescription')}
                      action={(
                        <button
                          type="button"
                          onClick={onQuickCreateTask}
                          className="inline-flex cursor-pointer items-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                        >
                          {t('today.quickAddTask')}
                        </button>
                      )}
                    />
                  ) : (
                    focusTasks.map((focusTask, focusIndex) => {
                      const taskSummary: TodayTaskSummary = {
                        id: focusTask.id,
                        boardId: focusTask.boardId,
                        boardTitle: focusTask.boardTitle,
                        listId: focusTask.listId || '',
                        listTitle: focusTask.listTitle || t('today.untitledList'),
                        title: focusTask.title,
                        description: '',
                        priority: focusTask.priority || null,
                        dueDate: focusTask.dueDate || null,
                        assigneeAvatar: focusTask.assigneeAvatar,
                        isDone: Boolean(focusTask.isDone),
                        updatedAt: null,
                      };

                      return (
                        <div key={focusTask.id} className="flex items-start gap-3">
                          <span
                            aria-hidden="true"
                            className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white"
                          >
                            {focusIndex + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <TodayTaskCard
                              task={taskSummary}
                              isFocusTask
                              onOpenTask={onOpenTask}
                              onStartFocus={onStartFocus}
                              onToggleTodayFocus={onToggleTodayFocus}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </SectionCard>

              {focusSuggestions.length > 0 && (
                <SectionCard className="p-5">
                  <div className="mb-4">
                    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600">
                      {t('today.focusTitle')}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">{t('today.focusDescription')}</p>
                  </div>
                  <div className="grid gap-3">
                    {focusSuggestions.map(({ task, reasons }) => (
                      <div
                        key={task.id}
                        className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => onOpenTask(task)}
                            className="min-w-0 text-left text-sm font-semibold text-slate-800 transition hover:text-blue-600"
                          >
                            {task.title}
                          </button>
                          <button
                            type="button"
                            onClick={() => onStartFocus(task)}
                            className="shrink-0 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                          >
                            {t('today.startFocus')}
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {reasons.map((reason) => (
                            <span key={reason} className={focusReasonBadgeClass(reason)}>
                              {focusReasonLabels[reason]}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 truncate text-xs text-slate-400">
                          {task.boardTitle} · {task.listTitle}
                        </p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {!hasUrgentTasks && (
                <motion.div
                  className="rounded-2xl border border-sky-100 bg-sky-50/70 p-5 text-slate-700 shadow-card"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 160, damping: 20 }}
                >
                  <h2 className="text-sm font-semibold text-slate-950">{t('today.noUrgentTitle')}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t('today.planningSpace')}
                  </p>
                </motion.div>
              )}
            </div>

            <div className="space-y-6">
              {(todayData.overdueTasks.length > 0 || todayData.dueTodayTasks.length > 0) && (
                <SectionCard className="p-5">
                  <div className="mb-4">
                    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600">
                      {t('today.needsAttention')}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {t('today.needsAttentionDescription')}
                    </p>
                  </div>
                  <div className="grid gap-5">
                    {todayData.overdueTasks.length > 0 && (
                      <TodayTaskSection
                        title={t('common.overdue')}
                        description={t('today.overdueDescription')}
                        tasks={todayData.overdueTasks}
                        emptyMessage={t('today.noOverdue')}
                        isFocusTask={isFocusTask}
                        onOpenTask={onOpenTask}
                        onStartFocus={onStartFocus}
                        onToggleTodayFocus={onToggleTodayFocus}
                        compactShell
                      />
                    )}

                    {todayData.dueTodayTasks.length > 0 && (
                      <TodayTaskSection
                        title={t('today.dueTodayTitle')}
                        description={t('today.dueTodayDescription')}
                        tasks={todayData.dueTodayTasks}
                        emptyMessage={t('today.emptyUrgent')}
                        isFocusTask={isFocusTask}
                        onOpenTask={onOpenTask}
                        onStartFocus={onStartFocus}
                        onToggleTodayFocus={onToggleTodayFocus}
                        compactShell
                      />
                    )}
                  </div>
                </SectionCard>
              )}

              {hasSecondaryTasks && (
                <details className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
                  <summary className="cursor-pointer text-sm font-bold uppercase tracking-[0.2em] text-slate-600">
                    {t('today.moreTasks')}
                  </summary>
                  <div className="mt-5 grid gap-5">
                    {todayData.assignedTasks.length > 0 && (
                      <TodayTaskSection
                        title={t('today.assignedTitle')}
                        description={t('today.assignedDescription')}
                        tasks={todayData.assignedTasks}
                        emptyMessage={t('today.noAssigned')}
                        isFocusTask={isFocusTask}
                        onOpenTask={onOpenTask}
                        onStartFocus={onStartFocus}
                        onToggleTodayFocus={onToggleTodayFocus}
                        compactShell
                      />
                    )}

                    {todayData.recentlyActiveTasks.length > 0 && (
                      <TodayTaskSection
                        title={t('today.recentTitle')}
                        description={t('today.recentDescription')}
                        tasks={todayData.recentlyActiveTasks}
                        emptyMessage={t('today.noRecent')}
                        isFocusTask={isFocusTask}
                        onOpenTask={onOpenTask}
                        onStartFocus={onStartFocus}
                        onToggleTodayFocus={onToggleTodayFocus}
                        compactShell
                      />
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
