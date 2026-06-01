import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  children: ReactNode;
  /** Semantic tone → maps to a slate/blue/emerald/amber/rose pill. */
  tone?: BadgeTone;
  /**
   * Escape hatch for callers that already compute a class string
   * (e.g. priority/label badges via utils/taskMetadata). When provided,
   * `tone` is ignored so existing color logic is preserved unchanged.
   */
  className?: string;
  /** Uppercase + wider tracking for priority/label style pills. */
  uppercase?: boolean;
}

const toneClassMap: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-600 border border-slate-200',
  accent: 'bg-blue-50 text-blue-700 border border-blue-100',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border border-rose-200',
};

/**
 * Presentational badge/pill primitive. Standardizes the rounded-full shape and
 * sizing duplicated across task cards, dashboards, and section headers. Accepts
 * either a semantic `tone` or a precomputed `className` (so existing
 * priority/label color logic keeps working with no behavior change).
 */
export default function Badge({
  children,
  tone = 'neutral',
  className,
  uppercase = false,
}: BadgeProps) {
  const colorClasses = className ?? toneClassMap[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        uppercase ? 'uppercase tracking-wide' : ''
      } ${colorClasses}`}
    >
      {children}
    </span>
  );
}
