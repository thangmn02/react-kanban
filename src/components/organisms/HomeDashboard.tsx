import { useEffect, useState } from 'react';
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
import HomeAppearanceSwitcher from '../home/HomeAppearanceSwitcher';
import HomeFocusView, { type HomeFocusControls } from '../home/HomeFocusView';

interface HomeDashboardProps {
  focusControls?: HomeFocusControls;
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
  refreshKey?: boolean;
  taskRevision?: BoardData['task'];
}

const quietButton = 'inline-flex cursor-pointer items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';
const primaryButton = `${quietButton} bg-blue-600 text-white hover:bg-blue-700 hover:text-white`;
const sectionLabel = 'text-xs font-semibold uppercase tracking-[0.16em] text-slate-500';

function dueOffset(task: HomeTaskSummary) {
  return task.dueDate ? differenceInCalendarDays(parseISO(task.dueDate), new Date()) : null;
}

// Reset immediately on workspace/identity changes, including in-flight retries.
export default function HomeDashboard(props: HomeDashboardProps) {
  return <HomeBriefing key={`${props.currentUser.id}:${props.activeWorkspace?.id ?? 'none'}`} {...props} />;
}

function HomeBriefing({ currentUser, activeWorkspace, onOpenTask, onOpenBoard,
  onToggleFocusTask, onStartFocusTask, isFocusTask, onCreateBoard, onCreateTask,
  onOpenQuickPlan, onOpenToday, focusTaskCount = 0, focusSessionsToday = 0, refreshKey, taskRevision, focusControls,
}: HomeDashboardProps) {
  const { t, language } = useI18n();
  const { appearance, setAppearance } = useHomeAppearance();
  const [data, setData] = useState<HomeDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [focusViewId, setFocusViewId] = useState<string | null>(() => focusControls?.session.timerState.startedAt ? focusControls.session.timerState.activeTaskId : null);
  const workspaceId = activeWorkspace?.id;

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
  const supporting = tasks.filter((task) => task.id !== featured?.id).slice(0, 4);
  const overdue = tasks.filter((task) => { const offset = dueOffset(task); return offset !== null && offset < 0; }).length;
  const dueToday = tasks.filter((task) => dueOffset(task) === 0).length;
  const loading = !data && !error;
  const date = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'briefing.morning' : hour < 18 ? 'briefing.afternoon' : 'briefing.evening';
  const focusViewTask = focusControls?.session.focusTasks.find((task) => task.id === focusViewId && task.id === focusControls.session.timerState.activeTaskId && !task.isDone);

  if (focusControls && focusViewTask) {
    return <div className="bg-canvas" data-home-theme={appearance}><HomeFocusView {...focusControls} task={focusViewTask} onExit={() => setFocusViewId(null)} /></div>;
  }

  return (
    <div className="bg-canvas" data-home-theme={appearance}>
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12" aria-busy={loading}>
        <header className="mb-9">
          <p className="text-sm text-slate-500">{date}<span className="mx-2" aria-hidden="true">·</span>{activeWorkspace?.name}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{t(greeting, { name: currentUser.name.split(' ')[0] })}</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">{t('briefing.intro')}</p>
          {data && !error && <p className="mt-2 text-sm leading-6 text-slate-500">{t('briefing.summary', { count: tasks.length, overdue, today: dueToday })}</p>}
        </header>

        {loading && <div className="space-y-5"><Skeleton className="h-56 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>}
        {error && <ErrorState title={t('today.errorTitle')} description={t('today.errorDescription')} details={error} onRetry={() => { setError(null); setAttempt((value) => value + 1); }} />}

        {data && !error && <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0 space-y-9">
            <section aria-labelledby="briefing-featured">
              <h2 id="briefing-featured" className={`mb-4 ${sectionLabel}`}>{featured && isFocusTask(featured.id) ? t('home.focusNow') : t('briefing.suggested')}</h2>
              {featured ? <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{featured.boardTitle}</span><DueDateBadge dueDate={featured.dueDate ?? undefined} /></div>
                <button type="button" onClick={() => onOpenTask(featured.id, featured.boardId)} className="mt-3 block w-full rounded text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
                  <h3 className="break-words text-2xl font-semibold leading-snug tracking-tight text-slate-950">{featured.title}</h3>
                </button>
                <p className="mt-4 border-l-2 border-blue-200 pl-3 text-sm leading-6 text-slate-600">{isFocusTask(featured.id) ? t('home.focusNowHelper') : t('briefing.suggestionHelper')}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {onStartFocusTask && <button type="button" className={primaryButton} onClick={() => { setFocusViewId(featured.id); onStartFocusTask(featured); }}>{t('home.startFocus')}</button>}
                  <button type="button" className={quietButton} onClick={() => onOpenTask(featured.id, featured.boardId)}>{t('briefing.details')}</button>
                  <button type="button" className={quietButton} aria-pressed={isFocusTask(featured.id)} onClick={() => onToggleFocusTask(featured)}>{isFocusTask(featured.id) ? t('home.removeFromFocus') : t('home.addToFocus')}</button>
                </div>
              </div> : <EmptyState compact title={t('home.noTasksTitle')} description={t('briefing.empty')} />}
            </section>

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
              {focusTaskCount > 0 && !tasks.some((task) => isFocusTask(task.id)) && <p className="mt-3 text-sm leading-6 text-slate-500">{t('home.focusElsewhereDescription', { count: focusTaskCount })}</p>}
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
      {import.meta.env.DEV && <HomeAppearanceSwitcher current={appearance} onChange={setAppearance} />}
    </div>
  );
}
