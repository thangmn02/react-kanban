import Badge from '../components/atoms/Badge';
import DueDateBadge from '../components/atoms/DueDateBadge';
import { getPriorityBadgeClass } from '../utils/taskMetadata';
import type { MockTask } from './mockData';

interface QuietTaskCardProps {
  task: MockTask;
  /** Compact variant trims spacing for dense board columns. */
  compact?: boolean;
}

/**
 * Quiet Velocity task card preview. A quiet surface (flat, slate hairline, no
 * glass). Title → metadata → footer hierarchy with consistent Badge tokens,
 * checklist/attachment indicators, and an assignee avatar cluster.
 *
 * Preview-only: rendered as a real <button> so the whole card is keyboard
 * operable; nested actions are not wired (no mutations in the lab).
 */
export default function QuietTaskCard({ task, compact = false }: QuietTaskCardProps) {
  const priorityClass = getPriorityBadgeClass(task.priority ?? undefined);

  return (
    <button
      type="button"
      className={`group block w-full cursor-pointer rounded-2xl border border-slate-200/80 bg-white text-left shadow-card transition-colors hover:border-sky-200 hover:bg-sky-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`min-w-0 font-semibold text-slate-900 ${compact ? 'text-sm' : 'text-sm'} ${
            task.isDone ? 'line-through decoration-slate-300' : ''
          }`}
        >
          {task.title}
        </p>
        {task.isDone && (
          <Badge tone="success" uppercase>
            Done
          </Badge>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {task.priority && priorityClass && (
          <Badge className={priorityClass} uppercase>
            {task.priority}
          </Badge>
        )}
        {task.dueDate && <DueDateBadge dueDate={task.dueDate} isDone={task.isDone} />}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {task.checklist && (
            <span className="inline-flex items-center gap-1">
              <svg className="h-3.5 w-3.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {task.checklist.done}/{task.checklist.total}
            </span>
          )}
          {task.attachments > 0 && (
            <span className="inline-flex items-center gap-1">
              <svg className="h-3.5 w-3.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {task.attachments}
            </span>
          )}
        </div>

        <div className="flex -space-x-2">
          {task.assignees.map((assignee) => (
            <img
              key={assignee.name}
              src={assignee.avatar}
              alt={assignee.name}
              className="h-6 w-6 rounded-full border-2 border-white object-cover"
            />
          ))}
        </div>
      </div>
    </button>
  );
}
