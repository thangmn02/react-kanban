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
      className={`rounded-[1.25rem] border bg-white/80 p-3 shadow-sm transition-[border,background,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md ${
        isActive ? 'border-sky-200 ring-2 ring-sky-100' : 'border-white/80'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onActivate(task.id)}
          className={`mt-1 h-3 w-3 shrink-0 rounded-full transition focus:outline-none focus:ring-2 focus:ring-sky-300 ${
            isActive ? 'bg-sky-500' : 'bg-slate-300 hover:bg-sky-300'
          }`}
          aria-label={`Set ${task.title} as active timer task`}
        />

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpenTask(task)}
            className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-sky-300"
          >
            <p className="line-clamp-2 text-sm font-semibold leading-snug tracking-[-0.01em] text-slate-950">
              {task.title}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500">
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
            className="h-7 w-7 rounded-full border-2 border-white object-cover shadow-sm"
          />
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenTask(task)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-300"
        >
          Open
        </button>
        <button
          type="button"
          onClick={() => onMarkDone(task)}
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          disabled={task.isDone}
        >
          {task.isDone ? 'Done' : 'Mark done'}
        </button>
        <button
          type="button"
          onClick={() => onRemove(task.id)}
          className="ml-auto rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-300"
          aria-label={`Remove ${task.title} from Focus Dock`}
        >
          Remove
        </button>
      </div>
    </article>
  );
}

export default FocusTaskMiniCard;
