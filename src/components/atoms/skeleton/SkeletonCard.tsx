import Skeleton from './Skeleton';

interface SkeletonCardProps {
  className?: string;
  /** Number of body lines rendered under the title. Defaults to 2. */
  lines?: number;
}

/**
 * Generic card placeholder: a rounded slate surface with a title bar and a few
 * body lines. Mirrors the calm card surfaces used across dashboards and panels.
 * Presentation only; the whole card is decorative (children are aria-hidden).
 */
export default function SkeletonCard({ className = '', lines = 2 }: SkeletonCardProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card ${className}`}
    >
      <Skeleton className="h-4 w-1/2" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: Math.max(1, lines) }).map((_, index) => (
          <Skeleton
            key={index}
            className={`h-3 ${index === lines - 1 ? 'w-2/3' : 'w-full'}`}
          />
        ))}
      </div>
    </div>
  );
}
