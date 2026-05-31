import type { TodayTaskSummary } from '../../services/today.service';
import { getPriorityBadgeClass } from '../../utils/taskMetadata';
import DueDateBadge from '../atoms/DueDateBadge';

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

  return (
    <article className="rounded-[1.5rem] border border-white/80 bg-white/86 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(15,23,42,0.10)]">
      <button
        type="button"
        onClick={() => onOpenTask(task)}
        className="block w-full cursor-pointer text-left focus:outline-none focus:ring-4 focus:ring-sky-100"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold tracking-[-0.01em] text-slate-950">
              {task.title}
            </h3>
            <p className="mt-1 truncate text-xs text-slate-500">
              {task.boardTitle} · {task.listTitle}
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
            No priority
          </span>
        )}
        <DueDateBadge dueDate={task.dueDate || undefined} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onStartFocus(task)}
          className="cursor-pointer rounded-2xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-slate-200 active:scale-[0.98]"
          aria-label={`Start focus session for ${task.title}`}
        >
          Start focus
        </button>
        <button
          type="button"
          onClick={() => onToggleTodayFocus(task)}
          className={`cursor-pointer rounded-2xl border px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-4 focus:ring-sky-100 active:scale-[0.98] ${
            isFocusTask
              ? 'border-sky-200 bg-sky-50 text-sky-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
          aria-pressed={isFocusTask}
          aria-label={`${isFocusTask ? 'Remove from' : 'Add to'} today focus: ${task.title}`}
        >
          {isFocusTask ? 'Remove from today' : 'Plan today'}
        </button>
      </div>
    </article>
  );
}
