import type { TodayTaskSummary } from '../../services/today.service';
import { getPriorityBadgeClass } from '../../utils/taskMetadata';
import DueDateBadge from '../atoms/DueDateBadge';
import { useI18n } from '../../i18n';

interface TodayTaskCardProps {
  task: TodayTaskSummary;
  isFocusTask: boolean;
  onOpenTask: (task: TodayTaskSummary) => void;
  onStartFocus: (task: TodayTaskSummary) => void;
  onToggleTodayFocus: (task: TodayTaskSummary) => void;
}

export default function TodayTaskCard({
  task,
  isFocusTask,
  onOpenTask,
  onStartFocus,
  onToggleTodayFocus,
}: TodayTaskCardProps) {
  const priorityClassName = getPriorityBadgeClass(task.priority || undefined);
  const { t } = useI18n();

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md">
      <button
        type="button"
        onClick={() => onOpenTask(task)}
        className="block w-full cursor-pointer text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold tracking-[-0.01em] text-slate-950">
              {task.title}
            </h3>
            <p className="mt-1 truncate text-xs text-slate-500">
              {task.boardTitle} - {task.listTitle}
            </p>
          </div>
          {task.assigneeAvatar && (
            <img
              src={task.assigneeAvatar}
              alt=""
              className="h-8 w-8 rounded-full border-2 border-white object-cover shadow-sm"
            />
          )}
        </div>

        {task.description && (
          <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
            {task.description}
          </p>
        )}
      </button>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {task.priority && priorityClassName ? (
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${priorityClassName}`}>
            {task.priority}
          </span>
        ) : (
          <span className="rounded-full border border-dashed border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-400">
            {t('common.noPriority')}
          </span>
        )}
        <DueDateBadge dueDate={task.dueDate || undefined} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onStartFocus(task)}
          className="cursor-pointer rounded-2xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 active:scale-[0.98]"
          aria-label={`${t('task.startFocus')}: ${task.title}`}
        >
          {t('today.startFocus')}
        </button>
        <button
          type="button"
          onClick={() => onToggleTodayFocus(task)}
          className={`cursor-pointer rounded-2xl border px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 active:scale-[0.98] ${
            isFocusTask
              ? 'border-sky-200 bg-sky-50 text-sky-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
          aria-pressed={isFocusTask}
          aria-label={`${isFocusTask ? t('today.removeFromToday') : t('today.planToday')}: ${task.title}`}
        >
          {isFocusTask ? t('today.removeFromToday') : t('today.planToday')}
        </button>
      </div>
    </article>
  );
}
