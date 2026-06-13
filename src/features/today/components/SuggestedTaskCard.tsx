import type { TodayTaskSummary } from '../../../services/today.service';
import { getPriorityBadgeClass } from '../../../utils/taskMetadata';
import DueDateBadge from '../../../components/atoms/DueDateBadge';

interface SuggestedTaskCardProps {
  task: TodayTaskSummary;
  onAdd: (task: TodayTaskSummary) => void;
  disabled: boolean;
}

export default function SuggestedTaskCard({
  task,
  onAdd,
  disabled,
}: SuggestedTaskCardProps) {
  const priorityClassName = getPriorityBadgeClass(task.priority || undefined);

  return (
    <article className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/60 bg-white p-3 shadow-sm transition hover:border-slate-300">
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-semibold tracking-[-0.01em] text-slate-900">
          {task.title}
        </h4>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="truncate">{task.boardTitle} · {task.listTitle}</span>
          {(task.priority || task.dueDate) && <span className="text-slate-300">•</span>}
          {task.priority && priorityClassName && (
            <span className={`px-1 font-bold uppercase ${priorityClassName} bg-transparent p-0`}>
              {task.priority}
            </span>
          )}
          {task.dueDate && <DueDateBadge dueDate={task.dueDate} />}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAdd(task)}
        disabled={disabled}
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Thêm việc: ${task.title}`}
        title="Thêm vào hôm nay"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </article>
  );
}
