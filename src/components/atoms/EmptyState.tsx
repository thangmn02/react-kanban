import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** Optional decorative icon (marked aria-hidden by the caller's svg). */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Optional action area (e.g. a primary button). */
  action?: ReactNode;
  /** Compact variant trims the vertical padding for inline list slots. */
  compact?: boolean;
  className?: string;
}

/**
 * Shared dashed-border empty-state surface. Consolidates the previously
 * duplicated empty blocks across the board, today sections, and dashboards so
 * the calm/flat direction stays consistent. Presentation only — no behavior.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 text-center ${
        compact ? 'px-4 py-6' : 'px-6 py-10'
      } ${className}`}
    >
      {icon && <div className="mb-2 text-slate-400">{icon}</div>}
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
