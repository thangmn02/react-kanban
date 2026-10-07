import { useCallback, useEffect, useState } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { fetchHomeDashboardData, type HomeDashboardData, type HomeTaskSummary } from '../../services/home.service';
import type { AppUser, WorkspaceSummary } from '../../types/auth.type';
import type { BoardData } from '../../types/task.type';
import { useI18n } from '../../i18n';
import ErrorState from '../atoms/ErrorState';
import EmptyState from '../atoms/EmptyState';
import DueDateBadge from '../atoms/DueDateBadge';
import { Skeleton } from '../atoms/skeleton';
import { useBriefingPins } from '../../hooks/useBriefingPins';
import { fetchBriefingPinTaskBoard } from '../../services/briefing.service';
import { notify } from './toast/notify';
import HomeFocusView, { type HomeFocusControls } from '../home/HomeFocusView';
import BriefingPinForm from '../home/BriefingPinForm';
import type { BriefingPin } from '../../types/briefing.type';
import PlanMyDayDialog from '../../features/today/components/PlanMyDayDialog';
import { useHomeFocusView } from '../../hooks/useHomeFocusView';

interface HomeDashboardProps {
  focusControls?: HomeFocusControls;
  onOpenTask: (taskId: string, boardId: string) => void;
  onOpenBoard: (boardId: string) => void;
  onToggleFocusTask: (task: HomeTaskSummary) => void;
  onStartFocusTask?: (task: HomeTaskSummary, nextStep?: string) => void;
  onPlanFocusTasks?: (tasks: HomeTaskSummary[]) => void;
  isFocusTask: (taskId: string) => boolean;
  currentUser: AppUser | null;
  onRequireSignIn?: () => boolean;
  activeWorkspace: WorkspaceSummary | null;
  onCreateBoard?: () => void;
  onCreateTask?: () => void;
  onOpenQuickPlan?: () => void;
  onOpenToday?: () => void;
  focusTaskCount?: number;
  focusSessionsToday?: number;
  hasTeamMembers?: boolean;
  refreshKey?: boolean;
  taskRevision?: BoardData['task'];
}

const quietButton = 'inline-flex cursor-pointer items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';
const primaryButton = `${quietButton} bg-blue-600 text-white hover:bg-blue-700 hover:text-white`;
const sectionLabel = 'text-xs! font-semibold uppercase tracking-[0.16em] text-slate-500!';
function formatPinnedAgo(value: string, language: 'en' | 'vi') {
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  const formatter = new Intl.RelativeTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { numeric: 'auto' });
  if (elapsedSeconds < 60) return formatter.format(-elapsedSeconds, 'second');
  if (elapsedSeconds < 3600) return formatter.format(-Math.floor(elapsedSeconds / 60), 'minute');
  if (elapsedSeconds < 86400) return formatter.format(-Math.floor(elapsedSeconds / 3600), 'hour');
  return formatter.format(-Math.floor(elapsedSeconds / 86400), 'day');
}

function PinnedThreadCard({
  pin,
  language,
  canDelete,
  onOpenLinkedTask,
  onDelete,
  t,
}: {
  pin: BriefingPin;
  language: 'en' | 'vi';
  canDelete: boolean;
  onOpenLinkedTask: () => void;
  onDelete: (pinId: string) => void;
  t: ReturnType<typeof useI18n>['t'];
}) {
  const safeLink = pin.linkUrl && /^https?:\/\//i.test(pin.linkUrl) ? pin.linkUrl : null;
  const content = <><blockquote className="text-lg font-semibold leading-7 text-slate-900">“{pin.quotedText}”</blockquote><p className="mt-2 text-sm text-slate-500">— {pin.authorName}</p></>;
  return (
    <article className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm ring-1 ring-blue-50">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">{pin.sourceLabel} · {formatPinnedAgo(pin.pinnedAt, language)}</p>
        {canDelete && <button type="button" onClick={() => onDelete(pin.id)} className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-rose-50 hover:text-rose-600">{t('briefing.pin.unpinAction')}</button>}
      </div>
      <div className="mt-3">
        {safeLink ? <a href={safeLink} target="_blank" rel="noreferrer" className="block rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">{content}</a>
          : pin.taskId ? <button type="button" onClick={onOpenLinkedTask} className="block w-full rounded text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">{content}</button>
            : content}
      </div>
      <p className="mt-4 border-l-2 border-blue-400 pl-3 text-sm leading-6 text-slate-600"><strong className="text-slate-800">{t('briefing.pin.whyPrefix')}</strong> {pin.whyMatters}</p>
    </article>
  );
}

function dueOffset(task: HomeTaskSummary) {
  return task.dueDate ? differenceInCalendarDays(parseISO(task.dueDate), new Date()) : null;
}

// Reset immediately on workspace/identity changes, including in-flight retries.
export default function HomeDashboard(props: HomeDashboardProps) {
  return <HomeBriefing key={`${props.currentUser?.id ?? 'public'}:${props.activeWorkspace?.id ?? 'none'}`} {...props} />;
}

function HomeBriefing({ currentUser, activeWorkspace, onOpenTask, onOpenBoard,
  onToggleFocusTask, onStartFocusTask, isFocusTask, onCreateBoard, onCreateTask,
  onPlanFocusTasks, onOpenQuickPlan, onOpenToday, focusTaskCount = 0, focusSessionsToday = 0, refreshKey, taskRevision, focusControls, onRequireSignIn,
}: HomeDashboardProps) {
  const { t, language } = useI18n();
  const workspaceId = activeWorkspace?.id;
  const [data, setData] = useState<HomeDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { focusViewId, setFocusViewId } = useHomeFocusView(currentUser?.id, workspaceId);
  const [isPinFormOpen, setIsPinFormOpen] = useState(false);
  const [isPlanMyDayOpen, setIsPlanMyDayOpen] = useState(false);
  const closePlanMyDay = useCallback(() => setIsPlanMyDayOpen(false), []);
  const { pins, isLoading: arePinsLoading, error: pinsError, createPin, removePin } = useBriefingPins(workspaceId);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    fetchHomeDashboardData({ currentUser, workspaceId }).then((result) => {
      if (active) { setData(result); setError(null); }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => { active = false; };
  }, [currentUser, workspaceId, attempt, refreshKey, taskRevision]);

  const tasks = data?.myTasks ?? [];
  const attentionTasks = tasks.slice(0, 3);
  const plannedTasks = focusControls
    ? focusControls.session.focusTasks.filter((task) => !task.isDone).slice(0, 3).map((task) => {
      const liveTask = tasks.find((candidate) => candidate.id === task.id);
      return { ...task, ...liveTask, priority: liveTask ? liveTask.priority : task.priority ?? null, dueDate: liveTask ? liveTask.dueDate : task.dueDate ?? null };
    })
    : tasks.filter((task) => isFocusTask(task.id)).slice(0, 3).map((task) => ({ ...task, listTitle: undefined }));
  const overdue = tasks.filter((task) => { const offset = dueOffset(task); return offset !== null && offset < 0; }).length;
  const dueToday = tasks.filter((task) => dueOffset(task) === 0).length;
  const loading = Boolean(currentUser) && !data && !error;
  const showBriefing = !error && (!currentUser || Boolean(data));
  const date = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'briefing.morning' : hour < 18 ? 'briefing.afternoon' : 'briefing.evening';
  const rawFirstName = currentUser?.name.trim().split(/\s+/)[0] || '';
  const firstName = rawFirstName ? rawFirstName.charAt(0).toLocaleUpperCase(language === 'vi' ? 'vi-VN' : 'en-US') + rawFirstName.slice(1) : '';
  const canEditPins = activeWorkspace?.role !== 'viewer';
  const openLinkedPinTask = async (pin: BriefingPin) => {
    if (!workspaceId || !pin.taskId) return;
    try {
      const boardId = tasks.find((task) => task.id === pin.taskId)?.boardId
        ?? await fetchBriefingPinTaskBoard(workspaceId, pin.taskId);
      if (boardId) onOpenTask(pin.taskId, boardId);
      else notify.error(t('briefing.pin.taskUnavailable'));
    } catch (reason) {
      notify.error(reason instanceof Error ? reason.message : t('briefing.pin.taskUnavailable'));
    }
  };
  const focusViewTask = focusControls?.session.focusTasks.find((task) => task.id === focusViewId && task.id === focusControls.session.timerState.activeTaskId && !task.isDone);
  const exitFocusView = () => {
    setFocusViewId(null);
  };
  const startTask = (task: HomeTaskSummary) => {
    setFocusViewId(task.id);
    onStartFocusTask?.(task);
  };

  if (focusControls && focusViewTask) {
    return <div className="bg-canvas"><HomeFocusView {...focusControls} task={focusViewTask} onOpenTask={onOpenTask} onExit={exitFocusView} /></div>;
  }

  return (
    <div className="bg-canvas">
      <main className="mx-auto grid max-w-[1140px] items-start gap-10 px-5 py-8 pb-28 sm:px-8 sm:py-11 sm:pb-28 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-x-16" aria-busy={loading}>
        <div className="min-w-0">
          <header>
            <p className="text-[13px] text-slate-500">{date}<span className="mx-2" aria-hidden="true">·</span>{activeWorkspace?.name || 'Kora'}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{currentUser ? t(greeting, { name: firstName }) : 'Kora'}</h1>
            {showBriefing && <p className="mt-2 text-[13px] leading-6 text-slate-500">{t('briefing.dailyFacts', { sessions: focusSessionsToday, plural: focusSessionsToday === 1 ? '' : 's', overdue, today: dueToday })}</p>}
            {showBriefing && canEditPins && <button type="button" onClick={() => { if (onRequireSignIn?.() !== false) setIsPinFormOpen(true); }} className={`${primaryButton} mt-4 px-5 py-2.5`}>{t('briefing.pin.pinAction')}</button>}
          </header>

          {loading && <div className="mt-10 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>}
          {error && <div className="mt-8"><ErrorState title={t('today.errorTitle')} description={t('today.errorDescription')} details={error} onRetry={() => { setError(null); setAttempt((value) => value + 1); }} /></div>}

          {showBriefing && <>
            {(arePinsLoading || pins.length > 0 || pinsError) && <section aria-labelledby="briefing-pins" className="mt-10 border-t border-slate-200 pt-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 id="briefing-pins" className={sectionLabel}>{t('briefing.pin.sectionTitle')}</h2><span className="text-xs text-slate-400">{t('briefing.pin.teamVisible')}</span></div>
              {arePinsLoading && <Skeleton className="h-44 w-full" />}
              {pinsError && <p className="text-sm text-rose-600">{t('briefing.pin.loadError')}</p>}
              <div className="space-y-3">{pins.map((pin) => <PinnedThreadCard key={pin.id} pin={pin} language={language} canDelete={canEditPins || pin.createdBy === currentUser?.id} onOpenLinkedTask={() => { void openLinkedPinTask(pin); }} onDelete={(pinId) => { void removePin(pinId).catch((reason) => notify.error(reason instanceof Error ? reason.message : t('briefing.pin.deleteError'))); }} t={t} />)}</div>
            </section>}

            <section aria-labelledby="briefing-attention" className="mt-10 border-t border-slate-200 pt-8">
              <h2 id="briefing-attention" className={sectionLabel}>{t('briefing.attention')}</h2>
              {attentionTasks.length > 0 ? <ul className="mt-2 divide-y divide-slate-200">
                {attentionTasks.map((task) => {
                  const offset = dueOffset(task);
                  const dueLabel = offset !== null && offset < 0
                    ? t('common.overdueDays', { count: -offset, plural: offset === -1 ? '' : 's' })
                    : offset === 0 ? t('common.dueToday')
                    : offset === 1 ? t('common.dueTomorrow')
                    : offset !== null && Number.isFinite(offset) ? t('common.daysLeft', { count: offset })
                    : t('common.noDueDate');
                  return <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3.5">
                    <button type="button" onClick={() => onOpenTask(task.id, task.boardId)} className="min-w-0 flex-1 cursor-pointer rounded text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
                      <span className="block break-words text-sm font-semibold leading-6 text-slate-900">{task.title}</span>
                      <span className="text-xs text-slate-500">{task.boardTitle}</span>
                    </button>
                    <span className={`text-xs font-semibold ${offset !== null && offset < 0 ? 'text-amber-800' : offset === 0 ? 'text-slate-900' : 'text-slate-500'}`}>{dueLabel}</span>
                    <button type="button" aria-pressed={isFocusTask(task.id)} aria-label={`${isFocusTask(task.id) ? t('home.removeFromFocus') : t('home.addToFocus')}: ${task.title}`} onClick={() => { onToggleFocusTask(task); focusControls?.session.setIsFocusDockCollapsed(true); }} className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"><span aria-hidden="true">{isFocusTask(task.id) ? '✓' : '+'}</span></button>
                  </li>;
                })}
              </ul> : <div className="mt-4"><EmptyState compact title={t('home.noTasksTitle')} /></div>}
              {tasks.length > attentionTasks.length && onOpenToday && <button type="button" className={`${quietButton} mt-2`} onClick={onOpenToday}>{t('home.openToday')} <span aria-hidden="true" className="ml-2">→</span></button>}
            </section>

            <section aria-labelledby="briefing-plan" className="mt-8 border-t border-slate-200 pt-8">
              <h2 id="briefing-plan" className={sectionLabel}>{t('briefing.makeRoom')}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {onStartFocusTask && onPlanFocusTasks && <button type="button" className={`${primaryButton} px-5 py-2.5`} onClick={() => { if (onRequireSignIn?.() !== false) setIsPlanMyDayOpen(true); }}>{t('planDay.action')}</button>}
                {onOpenQuickPlan && <button type="button" className={`${primaryButton} px-5 py-2.5`} onClick={onOpenQuickPlan}>{t('home.quickPlan')}</button>}
                {onCreateTask && <button type="button" className={quietButton} onClick={onCreateTask}>{t('home.createSingleTask')}</button>}
              </div>
            </section>
          </>}
        </div>

        {showBriefing && <aside className="min-w-0 space-y-10 border-t border-slate-200 pt-8 lg:border-0 lg:pt-0">
          <section aria-labelledby="briefing-focus">
            <h2 id="briefing-focus" className={sectionLabel}>{t('today.plan')}</h2>
            <p className="mt-2 text-[13px] text-slate-600">{t('home.focusSelectedCount', { count: focusControls ? plannedTasks.length : focusTaskCount || plannedTasks.length, max: 3 })}</p>
            <ol className="mt-3 space-y-3">
              {plannedTasks.map((task, index) => <li key={task.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <span className="text-xs font-bold text-blue-600">{index + 1}</span>
                <button type="button" onClick={() => onOpenTask(task.id, task.boardId)} aria-label={`${t('briefing.details')}: ${task.title}`} className="mt-1 block w-full cursor-pointer rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><h3 className="break-words text-base font-semibold leading-6 text-slate-900">{task.title}</h3></button>
                <p className="mt-1 text-xs text-slate-500">{task.boardTitle}{task.listTitle && <> · {task.listTitle}</>}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {task.priority && <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{task.priority}</span>}
                  <DueDateBadge dueDate={task.dueDate ?? undefined} />
                </div>
                {onStartFocusTask && <button type="button" onClick={() => startTask(task)} className="mt-4 w-full cursor-pointer rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{t('home.startFocus')}</button>}
              </li>)}
            </ol>
            {plannedTasks.length === 0 && <p className="mt-4 text-sm text-slate-500">{t('home.focusEmptyTitle')}</p>}
            {onOpenToday && <button type="button" className={`${quietButton} mt-2 -ml-3`} onClick={onOpenToday}>{t('home.openToday')} <span aria-hidden="true" className="ml-2">→</span></button>}
            <p className="mt-3 text-[13px] text-slate-500">{t('today.stats.sessions', { count: focusSessionsToday, plural: focusSessionsToday === 1 ? '' : 's' })}</p>
          </section>
          <section aria-labelledby="briefing-boards">
            <h2 id="briefing-boards" className={sectionLabel}>{t('briefing.boards')}</h2>
            <ul className="mt-2 space-y-2">
              {(data?.recentBoards ?? []).slice(0, 4).map((board) => <li key={board.id}><button type="button" aria-label={`${t('home.openBoard')}: ${board.title}`} onClick={() => onOpenBoard(board.id)} className="w-full cursor-pointer rounded py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><span className="block break-words text-sm font-semibold text-slate-800">{board.title}</span><span className="mt-1 block text-xs text-slate-500">{t('home.taskCount', { count: board.taskCount })}</span></button></li>)}
            </ul>
            {!data?.recentBoards.length && <p className="mt-3 text-sm text-slate-500">{t('home.noBoardsTitle')}</p>}
            {onCreateBoard && <button type="button" className={`${quietButton} mt-1 -ml-3`} onClick={onCreateBoard}>{t('home.createBoard')}</button>}
          </section>
        </aside>}
      </main>
      {workspaceId && currentUser && <BriefingPinForm isOpen={isPinFormOpen} workspaceId={workspaceId} currentUser={currentUser} tasks={tasks} onClose={() => setIsPinFormOpen(false)} onSubmit={async (input) => { await createPin(input); notify.success(t('briefing.pin.created')); }} />}
      {isPlanMyDayOpen && onStartFocusTask && onPlanFocusTasks && <PlanMyDayDialog tasks={tasks} workspaceId={workspaceId} onCreateTask={onCreateTask} onClose={closePlanMyDay} onStart={(task, nextStep) => { setFocusViewId(task.id); onStartFocusTask(task, nextStep); }} onAddTopThree={onPlanFocusTasks} />}
    </div>
  );
}
