import { toast } from 'react-toastify';

import TodayTaskCard from '../../../components/today/TodayTaskCard';
import { MAX_FOCUS_TASKS } from '../../../constants';
import { useI18n } from '../../../i18n';
import type { TodayPageData, TodayTaskSummary } from '../../../services/today.service';
import type { FocusTask } from '../../../types/focus.type';
import type { DailyCarryoverSummary } from '../dailyRitual';
import { useTodaySuggestions } from '../hooks/useTodaySuggestions';
import QuickCreateTodayTask from './QuickCreateTodayTask';
import SuggestedTaskCard from './SuggestedTaskCard';

interface TodayTaskSelectorProps {
  todayData: TodayPageData;
  focusTasks: FocusTask[];
  carryoverSummary: DailyCarryoverSummary | null;
  onCarryYesterday: (taskIds: string[]) => void;
  onDismissCarryover: () => void;
  onToggleTodayFocus: (task: TodayTaskSummary) => void;
  onOpenTask: (task: TodayTaskSummary) => void;
  onStartFocus: (task: TodayTaskSummary) => void;
  onQuickCreateTask: () => void;
  onFinishRitual: () => void;
}

function mapFocusTaskToTodayTask(focusTask: FocusTask, fallbackListTitle: string): TodayTaskSummary {
  return {
    id: focusTask.id,
    boardId: focusTask.boardId,
    boardTitle: focusTask.boardTitle,
    listId: focusTask.listId || '',
    listTitle: focusTask.listTitle || fallbackListTitle,
    title: focusTask.title,
    description: '',
    priority: focusTask.priority || null,
    dueDate: focusTask.dueDate || null,
    assigneeAvatar: focusTask.assigneeAvatar,
    isDone: Boolean(focusTask.isDone),
    updatedAt: null,
  };
}

export default function TodayTaskSelector({
  todayData,
  focusTasks,
  carryoverSummary,
  onCarryYesterday,
  onDismissCarryover,
  onToggleTodayFocus,
  onOpenTask,
  onStartFocus,
  onQuickCreateTask,
  onFinishRitual,
}: TodayTaskSelectorProps) {
  const { t } = useI18n();
  const selectedTaskIds = new Set(focusTasks.map((task) => task.id));
  const suggestedTasks = useTodaySuggestions(todayData, selectedTaskIds, 6);
  const isAtLimit = focusTasks.length >= MAX_FOCUS_TASKS;
  const unfinishedFocusTasks = focusTasks.filter((task) => !task.isDone);
  const completionText = carryoverSummary
    ? t('dailyRitual.carrySummary', {
        finished: carryoverSummary.finishedCount,
        total: carryoverSummary.totalCount,
      })
    : '';

  const handleAdd = (task: TodayTaskSummary) => {
    if (isAtLimit) {
      toast.warn(t('dailyRitual.limitWarning', { max: MAX_FOCUS_TASKS }), { theme: 'colored' });
      return;
    }

    onToggleTodayFocus(task);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(330px,0.95fr)]">
      <section className="rounded-[2rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-2xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-300">
              {t('dailyRitual.eyebrow')}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
              {t('dailyRitual.heading')}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              {t('dailyRitual.description')}
            </p>
          </div>

          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-bold text-slate-100">
            {t('dailyRitual.progress', { count: focusTasks.length, max: MAX_FOCUS_TASKS })}
          </span>
        </div>

        {carryoverSummary && (
          <div className="mt-5 rounded-3xl border border-amber-300/30 bg-amber-300/10 p-4">
            <p className="text-sm font-semibold text-amber-100">
              {t('dailyRitual.carryQuestion', { summary: completionText })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {carryoverSummary.unfinishedTasks.map((task) => (
                <span key={task.id} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-amber-50">
                  {task.title}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onCarryYesterday(carryoverSummary.unfinishedTasks.map((task) => task.id))}
                className="rounded-2xl bg-amber-200 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/30"
              >
                {t('dailyRitual.carryAction')}
              </button>
              <button
                type="button"
                onClick={onDismissCarryover}
                className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/15"
              >
                {t('dailyRitual.dismissCarryover')}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-3">
          {focusTasks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/20 bg-white/[0.04] p-8 text-center">
              <p className="text-base font-semibold">{t('dailyRitual.emptyTitle')}</p>
              <p className="mt-2 text-sm text-slate-400">{t('dailyRitual.emptyDescription')}</p>
            </div>
          ) : (
            focusTasks.map((focusTask, index) => (
              <div key={focusTask.id} className="relative rounded-3xl bg-white/[0.03] p-1">
                <span className="absolute -left-2 top-5 z-10 grid h-7 w-7 place-items-center rounded-full bg-sky-300 text-xs font-black text-slate-950 shadow-lg">
                  {index + 1}
                </span>
                <TodayTaskCard
                  task={mapFocusTaskToTodayTask(focusTask, t('today.untitledList'))}
                  isFocusTask
                  onOpenTask={onOpenTask}
                  onStartFocus={onStartFocus}
                  onToggleTodayFocus={onToggleTodayFocus}
                />
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-400">
            {unfinishedFocusTasks.length > 0
              ? t('dailyRitual.readyWithTask', { task: unfinishedFocusTasks[0].title })
              : t('dailyRitual.readyEmpty')}
          </p>
          <button
            type="button"
            onClick={onFinishRitual}
            disabled={unfinishedFocusTasks.length === 0}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('dailyRitual.finish')}
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <header>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
            {t('dailyRitual.suggestionsEyebrow')}
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">
            {t('dailyRitual.suggestionsTitle')}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {t('dailyRitual.suggestionsDescription')}
          </p>
        </header>

        <div className="mt-5 grid gap-3">
          {suggestedTasks.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              {t('dailyRitual.noSuggestions')}
            </p>
          ) : (
            suggestedTasks.map((task) => (
              <SuggestedTaskCard
                key={task.id}
                task={task}
                onAdd={handleAdd}
                disabled={isAtLimit}
              />
            ))
          )}

          <QuickCreateTodayTask onQuickCreate={onQuickCreateTask} />
        </div>
      </section>
    </div>
  );
}
