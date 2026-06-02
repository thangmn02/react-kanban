import type { FocusTask } from '../../types/focus.type';
import { getPriorityBadgeClass } from '../../utils/taskMetadata';
import DueDateBadge from '../atoms/DueDateBadge';

interface FocusTaskMiniCardProps {
  task: FocusTask;
  isActive: boolean;
  onActivate: (taskId: string) => void;
  onOpenTask: (task: FocusTask) => void;
  onMarkDone: (task: FocusTask) => void;
  onRemove: (taskId: string) => void;
}

function FocusTaskMiniCard({
  task,
  isActive,
  onActivate,
  onOpenTask,
  onMarkDone,
  onRemove,
}: FocusTaskMiniCardProps) {
  const priorityBadgeClass = getPriorityBadgeClass(task.priority);

  return (
    <article
      className={`rounded-2xl border bg-white/5 p-3 transition-[border,background,box-shadow,transform] hover:-translate-y-0.5 hover:bg-white/10 ${
        isActive ? 'border-sky-400/50 ring-2 ring-sky-400/30' : 'border-white/10'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onActivate(task.id)}
          className={`mt-1 h-3 w-3 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
            isActive ? 'bg-sky-400' : 'bg-slate-500 hover:bg-sky-300'
          }`}
          aria-label={`Set ${task.title} as active timer task`}
          aria-pressed={isActive}
        />

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpenTask(task)}
            className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            <p className="line-clamp-2 text-sm font-semibold leading-snug tracking-[-0.01em] text-white">
              {task.title}
            </p>
            <p className="mt-1 truncate text-xs text-slate-300">
              {task.boardTitle}{task.listTitle ? ` · ${task.listTitle}` : ''}
            </p>
          </button>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {task.priority && priorityBadgeClass && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${priorityBadgeClass}`}>
                {task.priority}
              </span>
            )}
            <DueDateBadge dueDate={task.dueDate} isDone={task.isDone} className="rounded-full" />
          </div>
        </div>

        {task.assigneeAvatar && (
          <img
            src={task.assigneeAvatar}
            alt=""
            className="h-7 w-7 rounded-full border-2 border-white/70 object-cover shadow-sm"
          />
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenTask(task)}
          className="cursor-pointer rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          Open
        </button>
        <button
          type="button"
          onClick={() => onMarkDone(task)}
          className="cursor-pointer rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={task.isDone}
        >
          {task.isDone ? 'Done' : 'Mark done'}
        </button>
        <button
          type="button"
          onClick={() => onRemove(task.id)}
          className="ml-auto cursor-pointer rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          aria-label={`Remove ${task.title} from Focus Dock`}
        >
          Remove
        </button>
      </div>
    </article>
  );
}

export default FocusTaskMiniCard;
