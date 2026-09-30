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
import { useHomeAppearance } from '../../hooks/useHomeAppearance';
import { useBriefingPins } from '../../hooks/useBriefingPins';
import { fetchBriefingPinTaskBoard } from '../../services/briefing.service';
import { notify } from './toast/notify';
import HomeAppearanceSwitcher from '../home/HomeAppearanceSwitcher';
import HomeFocusView, { type HomeFocusControls } from '../home/HomeFocusView';
import BriefingPinForm from '../home/BriefingPinForm';
import type { BriefingPin } from '../../types/briefing.type';
import PlanMyDayDialog from '../../features/today/components/PlanMyDayDialog';
import { dismissedFocusStorageKey, readDismissedFocusSession } from '../../utils/homeFocusSession';

interface HomeDashboardProps {
  focusControls?: HomeFocusControls;
  onOpenTask: (taskId: string, boardId: string) => void;
  onOpenBoard: (boardId: string) => void;
  onToggleFocusTask: (task: HomeTaskSummary) => void;
  onStartFocusTask?: (task: HomeTaskSummary, nextStep?: string) => void;
  onPlanFocusTasks?: (tasks: HomeTaskSummary[]) => void;
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
  refreshKey?: boolean;
  taskRevision?: BoardData['task'];
}

const quietButton = 'inline-flex cursor-pointer items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';
const primaryButton = `${quietButton} bg-blue-600 text-white hover:bg-blue-700 hover:text-white`;
const sectionLabel = 'text-xs font-semibold uppercase tracking-[0.16em] text-slate-500';
function writeDismissedFocusSession(key: string, startedAt: number | null) {
  try {
    if (startedAt) window.sessionStorage.setItem(key, String(startedAt));
    else window.sessionStorage.removeItem(key);
  } catch {
    // Ignore unavailable storage; focus mode still exits for the current mount.
  }
}

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
  return <HomeBriefing key={`${props.currentUser.id}:${props.activeWorkspace?.id ?? 'none'}`} {...props} />;
}

function HomeBriefing({ currentUser, activeWorkspace, onOpenTask, onOpenBoard,
  onToggleFocusTask, onStartFocusTask, isFocusTask, onCreateBoard, onCreateTask,
  onPlanFocusTasks, onOpenQuickPlan, onOpenToday, focusTaskCount = 0, focusSessionsToday = 0, refreshKey, taskRevision, focusControls,
}: HomeDashboardProps) {
  const { t, language } = useI18n();
  const { appearance, setAppearance } = useHomeAppearance();
  const workspaceId = activeWorkspace?.id;
  const [data, setData] = useState<HomeDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const focusDismissalKey = dismissedFocusStorageKey(currentUser.id, workspaceId);
  const focusStartedAt = focusControls?.session.timerState.startedAt ?? null;
  const [focusViewId, setFocusViewId] = useState<string | null>(() => (
    focusStartedAt && readDismissedFocusSession(focusDismissalKey) !== String(focusStartedAt)
      ? focusControls?.session.timerState.activeTaskId ?? null
      : null
  ));
  const [isPinFormOpen, setIsPinFormOpen] = useState(false);
  const [isPlanMyDayOpen, setIsPlanMyDayOpen] = useState(false);
  const closePlanMyDay = useCallback(() => setIsPlanMyDayOpen(false), []);
  const { pins, isLoading: arePinsLoading, error: pinsError, createPin, removePin } = useBriefingPins(workspaceId);

  useEffect(() => {
    let active = true;
    fetchHomeDashboardData({ currentUser, workspaceId }).then((result) => {
      if (active) { setData(result); setError(null); }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => { active = false; };
  }, [currentUser, workspaceId, attempt, refreshKey, taskRevision]);

  const tasks = data?.myTasks ?? [];
  const featured = tasks.find((task) => isFocusTask(task.id)) ?? tasks[0];
  const supporting = tasks.filter((task) => task.id !== featured?.id).slice(0, 2);
  const overdue = tasks.filter((task) => { const offset = dueOffset(task); return offset !== null && offset < 0; }).length;
  const dueToday = tasks.filter((task) => dueOffset(task) === 0).length;
  const loading = !data && !error;
  const date = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'briefing.morning' : hour < 18 ? 'briefing.afternoon' : 'briefing.evening';
  const rawFirstName = currentUser.name.trim().split(/\s+/)[0] || '';
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
    writeDismissedFocusSession(focusDismissalKey, focusStartedAt);
    setFocusViewId(null);
  };

  if (focusControls && focusViewTask) {
    return <div className="bg-canvas" data-home-theme={appearance}><HomeFocusView {...focusControls} task={focusViewTask} onOpenTask={onOpenTask} onExit={exitFocusView} /></div>;
  }

  return (
    <div className="bg-canvas" data-home-theme={appearance}>
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12" aria-busy={loading}>
        <header className="mb-9">
          <p className="text-sm text-slate-500">{date}<span className="mx-2" aria-hidden="true">·</span>{activeWorkspace?.name}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{t(greeting, { name: firstName })}</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">{t('briefing.intro')}</p>
          {data && !error && tasks.length > 0 && <p className="mt-2 text-sm leading-6 text-slate-500">{t('briefing.summary', { count: tasks.length, overdue, today: dueToday })}</p>}
          {data && !error && canEditPins && <button type="button" onClick={() => setIsPinFormOpen(true)} className={`${primaryButton} mt-4`}>{t('briefing.pin.pinAction')}</button>}
        </header>

        {loading && <div className="space-y-5"><Skeleton className="h-56 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>}
        {error && <ErrorState title={t('today.errorTitle')} description={t('today.errorDescription')} details={error} onRetry={() => { setError(null); setAttempt((value) => value + 1); }} />}

        {data && !error && <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0 space-y-9">
            {(arePinsLoading || pins.length > 0 || pinsError) && <section aria-labelledby="briefing-pins">
              <div className="mb-4 flex items-center justify-between gap-3"><h2 id="briefing-pins" className={sectionLabel}>{t('briefing.pin.sectionTitle')}</h2><span className="text-xs text-slate-400">{t('briefing.pin.teamVisible')}</span></div>
              {arePinsLoading && <Skeleton className="h-44 w-full" />}
              {pinsError && <p className="text-sm text-rose-600">{t('briefing.pin.loadError')}</p>}
              <div className="space-y-3">{pins.map((pin) => <PinnedThreadCard key={pin.id} pin={pin} language={language} canDelete={canEditPins || pin.createdBy === currentUser.id} onOpenLinkedTask={() => { void openLinkedPinTask(pin); }} onDelete={(pinId) => { void removePin(pinId).catch((reason) => notify.error(reason instanceof Error ? reason.message : t('briefing.pin.deleteError'))); }} t={t} />)}</div>
            </section>}
            {featured && <section aria-labelledby="briefing-featured">
              <h2 id="briefing-featured" className={`mb-4 ${sectionLabel}`}>{isFocusTask(featured.id) ? t('home.focusNow') : t('briefing.suggested')}</h2>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{featured.boardTitle}</span><DueDateBadge dueDate={featured.dueDate ?? undefined} /></div>
                <button type="button" onClick={() => onOpenTask(featured.id, featured.boardId)} className="mt-3 block w-full rounded text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
                  <h3 className="break-words text-2xl font-semibold leading-snug tracking-tight text-slate-950">{featured.title}</h3>
                </button>
                <p className="mt-4 border-l-2 border-blue-200 pl-3 text-sm leading-6 text-slate-600">{isFocusTask(featured.id) ? t('home.focusNowHelper') : t('briefing.suggestionHelper')}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {onStartFocusTask && <button type="button" className={primaryButton} onClick={() => { writeDismissedFocusSession(focusDismissalKey, null); setFocusViewId(featured.id); onStartFocusTask(featured); }}>{t('home.startFocus')}</button>}
                  <button type="button" className={quietButton} onClick={() => onOpenTask(featured.id, featured.boardId)}>{t('briefing.details')}</button>
                  <button type="button" className={quietButton} aria-pressed={isFocusTask(featured.id)} onClick={() => onToggleFocusTask(featured)}>{isFocusTask(featured.id) ? t('home.removeFromFocus') : t('home.addToFocus')}</button>
                </div>
              </div>
            </section>}
            {!featured && pins.length === 0 && !arePinsLoading && <EmptyState compact title={t('home.noTasksTitle')} description={t('briefing.empty')} />}

            {supporting.length > 0 && <section aria-labelledby="briefing-supporting">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id="briefing-supporting" className={sectionLabel}>{t('briefing.upNext')}</h2>{onOpenToday && <button type="button" className={quietButton} onClick={onOpenToday}>{t('home.openToday')}</button>}</div>
              <ul className="divide-y divide-slate-200 border-y border-slate-200">
                {supporting.map((task) => <li key={task.id} className="flex flex-wrap items-center gap-2 py-3">
                  <button type="button" onClick={() => onOpenTask(task.id, task.boardId)} className="min-w-0 flex-1 rounded py-1 text-left focus-visible:outline-2 focus-visible:outline-blue-600">
                    <span className="block break-words text-sm font-semibold text-slate-900">{task.title}</span><span className="mt-1 block text-xs text-slate-500">{task.boardTitle}</span>
                  </button>
                  <DueDateBadge dueDate={task.dueDate ?? undefined} />
                  <button type="button" className={quietButton} aria-pressed={isFocusTask(task.id)} aria-label={`${isFocusTask(task.id) ? t('home.removeFromFocus') : t('home.addToFocus')}: ${task.title}`} onClick={() => onToggleFocusTask(task)}>{isFocusTask(task.id) ? t('briefing.pinned') : t('briefing.pin')}</button>
                </li>)}
              </ul>
              <p className="mt-3 text-xs text-slate-500">{t('briefing.preview', { shown: supporting.length + 1, total: tasks.length })}</p>
            </section>}

            <section aria-labelledby="briefing-plan" className="border-t border-slate-200 pt-6">
              <h2 id="briefing-plan" className={sectionLabel}>{t('briefing.makeRoom')}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{t('briefing.planHelper')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {onStartFocusTask && onPlanFocusTasks && <button type="button" className={primaryButton} onClick={() => setIsPlanMyDayOpen(true)}>{t('planDay.action')}</button>}
                {onOpenQuickPlan && <button type="button" className={primaryButton} onClick={onOpenQuickPlan}>{t('home.quickPlan')}</button>}
                {onCreateTask && <button type="button" className={quietButton} onClick={onCreateTask}>{t('home.createSingleTask')}</button>}
              </div>
            </section>
          </div>

          <aside className="space-y-8 lg:border-l lg:border-slate-200 lg:pl-6">
            <section aria-labelledby="briefing-focus">
              <h2 id="briefing-focus" className={sectionLabel}>{t('today.plan')}</h2>
              <p className="mt-4 text-sm text-slate-700">{t('home.focusSelectedCount', { count: focusTaskCount, max: 3 })}</p>
              <p className="mt-2 text-sm text-slate-500">{t('today.stats.sessions', { count: focusSessionsToday, plural: focusSessionsToday === 1 ? '' : 's' })}</p>
              {focusTaskCount > 0 && !tasks.some((task) => isFocusTask(task.id)) && <p className="mt-3 text-sm leading-6 text-slate-500">{t(focusTaskCount === 1 ? 'home.focusElsewhereDescriptionOne' : 'home.focusElsewhereDescriptionOther', { count: focusTaskCount })}</p>}
              {onOpenToday && <button type="button" className={`${quietButton} mt-3`} onClick={onOpenToday}>{t('home.openToday')} <span aria-hidden="true" className="ml-2">→</span></button>}
            </section>
            <section aria-labelledby="briefing-boards">
              <h2 id="briefing-boards" className={sectionLabel}>{t('briefing.boards')}</h2>
              <ul className="mt-3 divide-y divide-slate-200">
                {data.recentBoards.slice(0, 4).map((board) => <li key={board.id}><button type="button" aria-label={`${t('home.openBoard')}: ${board.title}`} onClick={() => onOpenBoard(board.id)} className="w-full rounded py-3 text-left focus-visible:outline-2 focus-visible:outline-blue-600"><span className="block break-words text-sm font-semibold text-slate-800">{board.title}</span><span className="mt-1 block text-xs text-slate-500">{t('home.taskCount', { count: board.taskCount })}</span></button></li>)}
              </ul>
              {data.recentBoards.length === 0 && <p className="mt-3 text-sm text-slate-500">{t('home.noBoardsTitle')}</p>}
              {onCreateBoard && <button type="button" className={`${quietButton} mt-2`} onClick={onCreateBoard}>{t('home.createBoard')}</button>}
            </section>
          </aside>
        </div>}
      </main>
      {workspaceId && <BriefingPinForm isOpen={isPinFormOpen} workspaceId={workspaceId} currentUser={currentUser} tasks={tasks} onClose={() => setIsPinFormOpen(false)} onSubmit={async (input) => { await createPin(input); notify.success(t('briefing.pin.created')); }} />}
      {isPlanMyDayOpen && onStartFocusTask && onPlanFocusTasks && <PlanMyDayDialog tasks={tasks} workspaceId={workspaceId} onCreateTask={onCreateTask} onClose={closePlanMyDay} onStart={(task, nextStep) => { writeDismissedFocusSession(focusDismissalKey, null); setFocusViewId(task.id); onStartFocusTask(task, nextStep); }} onAddTopThree={onPlanFocusTasks} />}
      {import.meta.env.DEV && <HomeAppearanceSwitcher current={appearance} onChange={setAppearance} />}
    </div>
  );
}
