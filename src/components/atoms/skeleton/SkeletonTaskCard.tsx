import Skeleton from './Skeleton';

interface SkeletonTaskCardProps {
  className?: string;
}

/**
 * Task-card placeholder sized to match a board/today task card: a title line,
 * a shorter subtitle line, and a footer row with a small badge and an avatar
 * dot. Presentation only.
 */
export default function SkeletonTaskCard({ className = '' }: SkeletonTaskCardProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm ${className}`}
    >
      <Skeleton className="h-3.5 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-5 w-16" rounded="rounded-full" />
        <Skeleton className="h-6 w-6" rounded="rounded-full" />
      </div>
    </div>
  );
}
