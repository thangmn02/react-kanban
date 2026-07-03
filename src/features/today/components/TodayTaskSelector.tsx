import { notify } from '../../../components/organisms/toast/notify';

import { MAX_FOCUS_TASKS } from '../../../constants';
import { useI18n } from '../../../i18n';
import type { TodayPageData, TodayTaskSummary } from '../../../services/today.service';
import type { FocusTask } from '../../../types/focus.type';
import type { DailyCarryoverSummary } from '../dailyRitual';
import { useTodaySuggestions } from '../hooks/useTodaySuggestions';
import PlanTodayTaskCard from './PlanTodayTaskCard';
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
}: TodayTaskSelectorProps) {
  const { t } = useI18n();
  const selectedTaskIds = new Set(focusTasks.map((task) => task.id));
  const suggestedTasks = useTodaySuggestions(todayData, selectedTaskIds, 6);
  const isAtLimit = focusTasks.length >= MAX_FOCUS_TASKS;
  const unfinishedFocusTasks = focusTasks.filter((task) => !task.isDone);
  const completedFocusTasks = focusTasks.filter((task) => task.isDone);

  const handleAdd = (task: TodayTaskSummary) => {
    if (isAtLimit) {
      notify.warning(t('dailyRitual.limitWarning', { max: MAX_FOCUS_TASKS }));
      return;
    }

    onToggleTodayFocus(task);
  };

  const carrySummaryText = carryoverSummary
    ? t('dailyRitual.carrySummary', {
        finished: carryoverSummary.finishedCount,
        total: carryoverSummary.totalCount,
      })
    : '';

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      {/* Selected — Today's focus */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-600">
              {t('dailyRitual.heading')}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              {t('dailyRitual.description')}
            </p>
          </div>

          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-bold text-slate-600">
            {t('dailyRitual.progress', { count: focusTasks.length, max: MAX_FOCUS_TASKS })}
          </span>
        </div>

        {carryoverSummary && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              {t('dailyRitual.carryQuestion', { summary: carrySummaryText })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {carryoverSummary.unfinishedTasks.map((task) => (
                <span
                  key={task.id}
                  className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
                >
                  {task.title}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onCarryYesterday(carryoverSummary.unfinishedTasks.map((task) => task.id))}
                className="cursor-pointer rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
              >
                {t('dailyRitual.carryAction')}
              </button>
              <button
                type="button"
                onClick={onDismissCarryover}
                className="cursor-pointer rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-100"
              >
                {t('dailyRitual.dismissCarryover')}
              </button>
            </div>
          </div>
        )}

        {/* Unfinished selected — main list */}
        <div className="mt-5 grid gap-3">
          {unfinishedFocusTasks.length === 0 && completedFocusTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">{t('dailyRitual.emptyTitle')}</p>
              <p className="mt-2 text-sm text-slate-500">{t('dailyRitual.emptyDescription')}</p>
            </div>
          ) : (
            unfinishedFocusTasks.map((focusTask, index) => (
              <div key={focusTask.id} className="relative pl-2">
                <PlanTodayTaskCard
                  task={mapFocusTaskToTodayTask(focusTask, t('today.untitledList'))}
                  index={index + 1}
                  onOpenTask={onOpenTask}
                  onStartFocus={onStartFocus}
                  onRemove={onToggleTodayFocus}
                />
              </div>
            ))
          )}
        </div>

        {/* Completed today — smaller secondary section */}
        {completedFocusTasks.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              {t('dailyRitual.completedToday')} · {completedFocusTasks.length}
            </p>
            <div className="grid gap-2">
              {completedFocusTasks.map((focusTask) => (
                <PlanTodayTaskCard
                  key={focusTask.id}
                  task={mapFocusTaskToTodayTask(focusTask, t('today.untitledList'))}
                  onOpenTask={onOpenTask}
                  onStartFocus={onStartFocus}
                  onRemove={onToggleTodayFocus}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Smart suggestions */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <header>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
            {t('dailyRitual.suggestionsEyebrow')}
          </p>
          <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">
            {t('dailyRitual.suggestionsTitle')}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {t('dailyRitual.suggestionsDescription')}
          </p>
        </header>

        <div className="mt-5 grid gap-3">
          {suggestedTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center">
              <p className="text-sm font-semibold text-slate-700">{t('dailyRitual.noSuggestions')}</p>
              <p className="mt-1 text-sm text-slate-500">{t('dailyRitual.noSuggestionsHint')}</p>
            </div>
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
        </div>
      </section>
    </div>
  );
}
