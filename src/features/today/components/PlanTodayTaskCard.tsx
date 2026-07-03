import DueDateBadge from '../../../components/atoms/DueDateBadge';
import { useI18n } from '../../../i18n';
import type { TodayTaskSummary } from '../../../services/today.service';
import { getPriorityBadgeClass } from '../../../utils/taskMetadata';

interface PlanTodayTaskCardProps {
  task: TodayTaskSummary;
  /** 1-based order badge shown for unfinished tasks. Omit for completed tasks. */
  index?: number;
  onOpenTask: (task: TodayTaskSummary) => void;
  onStartFocus: (task: TodayTaskSummary) => void;
  onRemove: (task: TodayTaskSummary) => void;
}

/**
 * Task card used inside the Plan Today modal. Purpose-built for the ritual view
 * with a clear, compact action set:
 *  - Unfinished tasks: "Start focus", "Open task", "Remove" (+ priority/due badges).
 *  - Completed tasks: a "Completed" badge and "Open task" only — no due/overdue
 *    badges and no Remove, per the Plan Today spec.
 * Calm Astryx-inspired surface (white card, subtle border, soft shadow).
 */
export default function PlanTodayTaskCard({
  task,
  index,
  onOpenTask,
  onStartFocus,
  onRemove,
}: PlanTodayTaskCardProps) {
  const { t } = useI18n();
  const priorityClassName = getPriorityBadgeClass(task.priority || undefined);
  const isDone = Boolean(task.isDone);

  return (
    <article
      className={`relative rounded-2xl border p-4 transition ${
        isDone
          ? 'border-slate-200 bg-slate-50/60'
          : 'border-slate-200/80 bg-white shadow-card hover:border-sky-200 hover:shadow-md'
      }`}
    >
      {!isDone && typeof index === 'number' && (
        <span className="absolute -left-2 top-4 z-10 grid h-7 w-7 place-items-center rounded-full bg-sky-600 text-xs font-black text-white shadow-sm">
          {index}
        </span>
      )}

      <button
        type="button"
        onClick={() => onOpenTask(task)}
        className="block w-full cursor-pointer text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              className={`truncate text-sm font-semibold tracking-[-0.01em] ${
                isDone ? 'text-slate-400 line-through' : 'text-slate-950'
              }`}
            >
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
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isDone ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase text-emerald-700"
            aria-label={t('today.taskCompleted')}
          >
            <svg className="h-3.5 w-3.5 shrink-0" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {t('today.taskCompleted')}
          </span>
        ) : (
          <>
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
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!isDone && (
          <button
            type="button"
            onClick={() => onStartFocus(task)}
            className="cursor-pointer rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 active:scale-[0.98]"
            aria-label={`${t('today.startFocus')}: ${task.title}`}
          >
            {t('today.startFocus')}
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenTask(task)}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 active:scale-[0.98]"
        >
          {t('dailyRitual.openTask')}
        </button>
        {!isDone && (
          <button
            type="button"
            onClick={() => onRemove(task)}
            className="cursor-pointer rounded-xl border border-transparent px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 active:scale-[0.98]"
            aria-label={`${t('dailyRitual.remove')}: ${task.title}`}
          >
            {t('dailyRitual.remove')}
          </button>
        )}
      </div>
    </article>
  );
}
