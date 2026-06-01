import Skeleton from './Skeleton';
import SkeletonTaskCard from './SkeletonTaskCard';

interface SkeletonBoardColumnProps {
  className?: string;
  /** Number of task-card placeholders inside the column. Defaults to 3. */
  taskCount?: number;
}

/**
 * Board column placeholder sized to match a Kanban list column (`w-80`): a
 * header row (title + menu dot) and a stack of task-card placeholders. Mirrors
 * the real column surface in `TaskList` to keep layout shift low. Presentation
 * only.
 */
export default function SkeletonBoardColumn({ className = '', taskCount = 3 }: SkeletonBoardColumnProps) {
  return (
    <div
      aria-hidden="true"
      className={`flex w-80 flex-shrink-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card ${className}`}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-5" rounded="rounded-full" />
      </div>
      <div className="mt-4 space-y-3">
        {Array.from({ length: Math.max(1, taskCount) }).map((_, index) => (
          <SkeletonTaskCard key={index} />
        ))}
      </div>
    </div>
  );
}
