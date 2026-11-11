import type { DailyCarryoverSummary } from '../../features/today/dailyRitual';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useSummaryCompletion } from '../../hooks/use-summary-completion';
import { uiSpring } from '../../shared/motion';
import type { BoardData } from '../../types/task.type';
import { TASK_WORKFLOW_CHANGED } from '../../services/task-workflow.service';

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
import { NOTES_PREVIEW_ENABLED } from '../../constants/features';
import { followUpDue, useOwnDeadlines, useTaskFollowUps } from '../../features/today/task-followups';
import { splitStaleTasks } from '../../features/today/utils/staleTasks';

const localDay = (offset = 0) => {
  const date = new Date(); date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

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
  onCreateNote?: () => void;
  onCompleteTask?: (task: TodayTaskSummary) => Promise<boolean>;
  /** Writes a new due date, or none. Resolves false when it could not be saved. */
  onRescheduleTask?: (task: TodayTaskSummary, dueDate: string | null) => Promise<boolean>;
  taskRevision?: BoardData['task'];
  /** Yesterday's unfinished tasks, offered once at the top of Today. */
  carryover?: { summary: DailyCarryoverSummary | null; onCarry: (taskIds: string[]) => void; onDismiss: () => void };
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
  focusTasks: plannedTasks,
  dailyFocusStats,
  isFocusTask,
  onOpenTask,
  onStartFocus,
  onToggleTodayFocus,
  onQuickCreateTask,
  onCreateNote,
  onCompleteTask,
  onRescheduleTask,
  taskRevision,
  carryover,
}: TodayPageProps) {
  const [loadedData, setTodayData] = useState<TodayPageData>(getEmptyTodayData);
  const completion = useSummaryCompletion(onCompleteTask);
  const focusTasks = plannedTasks.filter(task => !task.isDone && !completion.completed.has(task.id));
  const { followUps, wait, clear: stopWaiting } = useTaskFollowUps({ userId: currentUser.id, workspaceId: activeWorkspace?.id ?? null });
  // Waiting tasks are someone else's move, so they leave every other group and get their own.
  const todayData = useMemo(() => Object.fromEntries(Object.entries(loadedData).map(([key, tasks]) => [key,
    (tasks as TodayTaskSummary[]).filter(task => !completion.completed.has(task.id) && !followUps[task.id])])) as unknown as TodayPageData, [loadedData, completion.completed, followUps]);
  const waitingTasks = useMemo(() => {
    const byId = new Map<string, TodayTaskSummary>();
    for (const tasks of Object.values(loadedData) as TodayTaskSummary[][]) for (const task of tasks)
      if (followUps[task.id] && !completion.completed.has(task.id)) byId.set(task.id, task);
    return [...byId.values()].sort((a, b) => followUps[a.id].followUpOn.localeCompare(followUps[b.id].followUpOn));
  }, [loadedData, completion.completed, followUps]);
  const { deadlines, set: setOwnDeadline, takeNudges } = useOwnDeadlines({ userId: currentUser.id, workspaceId: activeWorkspace?.id ?? null });
  const [rescheduling, setRescheduling] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState('');
  const handleComplete = async (task: TodayTaskSummary) => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const section = opener?.closest<HTMLElement>('[data-task-section]');
    if (await completion.run(task)) requestAnimationFrame(() => {
      if (section?.isConnected) {
        section.focus();
      } else document.getElementById('today-content')?.focus();
    });
  };
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
  }, [workspaceId, currentUser, t, taskRevision]);

  // Tell the person once, on the day a personal deadline arrives. It never repeats.
  useEffect(() => {
    if (isLoading) return;
    const day = localDay();
    const open = [...loadedData.assignedTasks, ...loadedData.recentlyActiveTasks].filter(task => !task.isDone && task.dueDate && task.dueDate.slice(0, 10) > day);
    const told = takeNudges(day, new Set(open.map(task => task.id)));
    if (!told.length) return;
    const first = open.find(task => task.id === told[0]);
    const message = told.length === 1 && first ? t('today.own.nudgeOne', { task: first.title }) : t('today.own.nudgeMany', { count: told.length });
    // Announced after this render, since taking the nudge has just written to storage.
    queueMicrotask(() => setNotice(message));
  }, [isLoading, loadedData, deadlines, takeNudges, t]);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    void loadTodayData().finally(() => {
      setIsRetrying(false);
    });
  }, [loadTodayData]);
  useEffect(() => {
    const refresh = () => { void loadTodayData(); };
    window.addEventListener(TASK_WORKFLOW_CHANGED, refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(TASK_WORKFLOW_CHANGED, refresh); window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); };
  }, [loadTodayData]);

  const handleReschedule = async (task: TodayTaskSummary, to: 'tomorrow' | 'none') => {
    if (!onRescheduleTask || rescheduling.has(task.id)) return;
    setRescheduling(current => new Set(current).add(task.id));
    const saved = await onRescheduleTask(task, to === 'tomorrow' ? localDay(1) : null);
    if (saved) await loadTodayData();
    setNotice(t(saved ? to === 'tomorrow' ? 'today.overdue.movedTomorrow' : 'today.overdue.dateDropped' : 'today.overdue.saveFailed', { task: task.title }));
    setRescheduling(current => { const next = new Set(current); next.delete(task.id); return next; });
  };
  const handleWait = (task: TodayTaskSummary, who: string, followUpOn: string) => {
    if (wait(task.id, who, followUpOn)) setNotice(t('today.waiting.saved', { task: task.title }));
  };
  const today = localDay();
  // A personal deadline that has arrived moves the task up, while its real due date is still ahead.
  const ownDue = (task: TodayTaskSummary) => Boolean(deadlines[task.id] && deadlines[task.id].on <= today && task.dueDate && task.dueDate.slice(0, 10) > today);
  const ownDueTasks = [...new Map([...todayData.assignedTasks, ...todayData.recentlyActiveTasks].filter(ownDue).map(task => [task.id, task])).values()];
  const handleOwnDeadline = (task: TodayTaskSummary, on: string) => {
    if (setOwnDeadline(task.id, on, task.dueDate)) setNotice(t(on ? 'today.own.saved' : 'today.own.cleared', { task: task.title }));
  };
  const hasUrgentTasks = todayData.overdueTasks.length > 0 || todayData.dueTodayTasks.length > 0 || ownDueTasks.length > 0;
  // Each task appears once under More tasks; ones left alone for two weeks fold behind a single line.
  const assigned = splitStaleTasks(todayData.assignedTasks.filter(task => !ownDue(task)));
  const assignedIds = new Set(todayData.assignedTasks.map(task => task.id));
  const recent = splitStaleTasks(todayData.recentlyActiveTasks.filter(task => !assignedIds.has(task.id) && !ownDue(task)));
  const staleTasks = [...assigned.stale, ...recent.stale];
  const moreCount = assigned.fresh.length + recent.fresh.length + staleTasks.length;
  const hasSecondaryTasks = moreCount > 0 || waitingTasks.length > 0;

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
    <main id="main" className="bg-canvas px-4 py-4 sm:px-6" aria-busy={isLoading}>
      <section id="today-content" tabIndex={-1} className="mx-auto max-w-7xl focus-visible:outline-2 focus-visible:outline-blue-600">
        <PageHeader
          eyebrow={t('today.eyebrow')}
          title={t('today.title')}
          className="mb-4"
          actions={(
            <div className="flex flex-wrap gap-2">{NOTES_PREVIEW_ENABLED && onCreateNote && <button type="button" onClick={onCreateNote} className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">{t('notes.quick')}</button>}<button
              type="button"
              onClick={onQuickCreateTask}
              className="cursor-pointer rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
            >
              {t('today.quickAddTask')}
            </button></div>
          )}
        />
        {carryover?.summary && carryover.summary.unfinishedTasks.length > 0 && (
          <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-700">
            <p className="mr-auto">{t('dailyRitual.carryQuestion', { summary: t('dailyRitual.carrySummary', { finished: carryover.summary.finishedCount, total: carryover.summary.totalCount }) })}</p>
            <button type="button" className="min-h-9 rounded-xl px-3 font-semibold text-slate-600 hover:bg-white" onClick={carryover.onDismiss}>{t('dailyRitual.dismissCarryover')}</button>
            <button type="button" className="min-h-9 rounded-xl bg-blue-600 px-3 font-semibold text-white hover:bg-blue-700" onClick={() => carryover.onCarry(carryover.summary!.unfinishedTasks.map(task => task.id))}>{t('dailyRitual.carryAction')}</button>
          </div>
        )}

        <p role="status" aria-live="polite" className="mb-3 text-sm text-slate-700">{completion.message || notice}</p>

        {isLoading && (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="space-y-4">
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

            <div className="space-y-4">
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
          <div className={`grid items-start gap-4 ${hasUrgentTasks || hasSecondaryTasks ? 'lg:grid-cols-2' : ''}`}>
            <div className="space-y-4">
              <div data-task-section tabIndex={-1}><SectionCard className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 id="today-plan-heading" tabIndex={-1} className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600">
                      {t('today.plan')}
                    </h2>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {plannedTasks.length}/3
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  {focusTasks.length === 0 ? (focusSuggestions.length > 0 ? <p className="text-sm text-slate-500">{t('today.noFocusPick')}</p> : <EmptyState
                      compact
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
                    <AnimatePresence initial={false}>{focusTasks.map((focusTask, focusIndex) => {
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
                        <motion.div key={focusTask.id} layout={prefersReducedMotion ? false : 'position'} exit={{ opacity: 0 }} transition={prefersReducedMotion ? { duration: 0 } : uiSpring} className="flex items-start gap-3">
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
                              onCompleteTask={handleComplete}
                              isCompleting={completion.pending.has(focusTask.id)}
                            />
                          </div>
                        </motion.div>
                      );
                    })}</AnimatePresence>
                  )}
                </div>
                {plannedTasks.filter(task => task.isDone).map(task => <div key={task.id} className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <span className="min-w-0 break-words">✓ {task.title}</span>
                  <button type="button" className="min-h-9 shrink-0 cursor-pointer rounded px-2 font-semibold focus-visible:outline-2 focus-visible:outline-blue-600"
                    aria-label={`${t('today.removeFromToday')}: ${task.title}`}
                    onClick={() => onToggleTodayFocus({ ...task, description: '', priority: task.priority ?? null, dueDate: task.dueDate ?? null, listId: task.listId || '', listTitle: task.listTitle || '', isDone: true, updatedAt: null })}>{t('today.removeFromToday')}</button>
                </div>)}
              </SectionCard></div>

              {focusSuggestions.length > 0 && (
                <div data-task-section tabIndex={-1} className="focus-visible:outline-2 focus-visible:outline-blue-600"><SectionCard className="p-4">
                  <div className="mb-4">
                    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600">
                      {t('today.focusTitle')}
                    </h2>
                  </div>
                  <div className="grid gap-3">
                    <AnimatePresence initial={false}>{focusSuggestions.map(({ task, reasons }) => (
                      <motion.div key={task.id} layout={prefersReducedMotion ? false : 'position'} exit={{ opacity: 0 }} transition={prefersReducedMotion ? { duration: 0 } : uiSpring}>
                        <TodayTaskCard task={task} isFocusTask={false} onOpenTask={onOpenTask} onStartFocus={onStartFocus} onToggleTodayFocus={onToggleTodayFocus} onCompleteTask={handleComplete} isCompleting={completion.pending.has(task.id)}
                          reasons={reasons.map(reason => <span key={reason} className={focusReasonBadgeClass(reason)}>{focusReasonLabels[reason]}</span>)} />
                      </motion.div>
                    ))}</AnimatePresence>
                  </div>
                </SectionCard></div>
              )}

              {/* A quiet line, not another card: nothing needs attention. */}
              {!hasUrgentTasks && <p className="px-1 text-sm text-slate-500">{t('today.noUrgentTitle')}</p>}
            </div>

            {(hasUrgentTasks || hasSecondaryTasks) && <div id="today-due-tasks" className="space-y-4">
              {hasUrgentTasks && (
                <SectionCard className="p-4">
                  <div className="mb-4">
                    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600">
                      {t('today.needsAttention')}
                    </h2>
                  </div>
                  <div className="grid gap-5">
                    {todayData.overdueTasks.length > 0 && (
                      <TodayTaskSection
                        title={t('common.overdue')}
                        description={onRescheduleTask ? t('today.overdue.question') : undefined}
                        cardProps={task => ({ onReschedule: onRescheduleTask ? handleReschedule : undefined, isRescheduling: rescheduling.has(task.id), onWait: handleWait })}
                        tasks={todayData.overdueTasks}
                        emptyMessage={t('today.noOverdue')}
                        isFocusTask={isFocusTask}
                        onOpenTask={onOpenTask}
                        onStartFocus={onStartFocus}
                        onToggleTodayFocus={onToggleTodayFocus}
                        onCompleteTask={handleComplete}
                        completingIds={completion.pending}
                        compactShell
                      />
                    )}

                    {ownDueTasks.length > 0 && (
                      <TodayTaskSection
                        title={t('today.own.title')}
                        tasks={ownDueTasks}
                        emptyMessage=""
                        isFocusTask={isFocusTask}
                        onOpenTask={onOpenTask}
                        onStartFocus={onStartFocus}
                        onToggleTodayFocus={onToggleTodayFocus}
                        onCompleteTask={handleComplete}
                        completingIds={completion.pending}
                        cardProps={task => ({ ownDeadline: deadlines[task.id], ownDeadlineDue: true, onSetOwnDeadline: handleOwnDeadline, onWait: handleWait })}
                        compactShell
                      />
                    )}

                    {todayData.dueTodayTasks.length > 0 && (
                      <TodayTaskSection
                        title={t('today.dueTodayTitle')}
                        cardProps={() => ({ onWait: handleWait })}
                        tasks={todayData.dueTodayTasks}
                        emptyMessage={t('today.emptyUrgent')}
                        isFocusTask={isFocusTask}
                        onOpenTask={onOpenTask}
                        onStartFocus={onStartFocus}
                        onToggleTodayFocus={onToggleTodayFocus}
                        onCompleteTask={handleComplete}
                        completingIds={completion.pending}
                        compactShell
                      />
                    )}
                  </div>
                </SectionCard>
              )}

              {waitingTasks.length > 0 && (
                <SectionCard className="p-4">
                  <TodayTaskSection
                    title={t('today.waiting.title')}
                    tasks={waitingTasks}
                    cardProps={task => ({ waiting: followUps[task.id], followUpDue: followUpDue(followUps[task.id], today), onStopWaiting: item => stopWaiting(item.id) })}
                    isFocusTask={isFocusTask}
                    onOpenTask={onOpenTask}
                    onStartFocus={onStartFocus}
                    onToggleTodayFocus={onToggleTodayFocus}
                    onCompleteTask={handleComplete}
                    completingIds={completion.pending}
                    emptyMessage=""
                    compactShell
                  />
                </SectionCard>
              )}

              {moreCount > 0 && (
                <details className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
                  <summary className="cursor-pointer text-sm font-bold uppercase tracking-[0.2em] text-slate-600">
                    {t('today.moreTasks')} ({moreCount})
                  </summary>
                  <div className="mt-3 grid gap-4">
                    {([[t('today.assignedTitle'), assigned.fresh], [t('today.recentTitle'), recent.fresh]] as const).map(([title, tasks]) => tasks.length > 0 && (
                      <TodayTaskSection
                        key={title}
                        title={title}
                        tasks={tasks}
                        cardProps={task => ({ onWait: handleWait, ownDeadline: deadlines[task.id], onSetOwnDeadline: handleOwnDeadline })}
                        isFocusTask={isFocusTask}
                    onOpenTask={onOpenTask}
                    onStartFocus={onStartFocus}
                    onToggleTodayFocus={onToggleTodayFocus}
                    onCompleteTask={handleComplete}
                    completingIds={completion.pending}
                    emptyMessage=""
                    compactShell
                      />
                    ))}
                    {staleTasks.length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-sm font-semibold text-slate-600">{t('today.stale.summary', { count: staleTasks.length })}</summary>
                        <div className="mt-3">
                          <TodayTaskSection
                            title={t('today.stale.title')}
                            tasks={staleTasks}
                            isFocusTask={isFocusTask}
                    onOpenTask={onOpenTask}
                    onStartFocus={onStartFocus}
                    onToggleTodayFocus={onToggleTodayFocus}
                    onCompleteTask={handleComplete}
                    completingIds={completion.pending}
                    emptyMessage=""
                    compactShell
                          />
                        </div>
                      </details>
                    )}
                  </div>
                </details>
              )}
            </div>}
          </div>
        )}
        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white px-4 py-2 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">
              {t('today.stats.sessions', { count: dailyFocusStats.completedSessions, plural: dailyFocusStats.completedSessions === 1 ? '' : 's' })}
            </p>
            <p className="text-sm text-slate-500">
              {t('today.stats.minutes', { count: dailyFocusStats.focusedMinutes })}
              {dailyFocusStats.interruptedSessions > 0 ? ` · ${t('ux.interrupted', { count: dailyFocusStats.interruptedSessions })}` : ''}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
