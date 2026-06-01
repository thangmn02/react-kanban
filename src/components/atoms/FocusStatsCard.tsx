interface FocusStatsCardProps {
  label: string;
  value: string;
  caption?: string;
  /** Optional tint for the eyebrow label (defaults to muted slate). */
  tone?: 'slate' | 'sky' | 'amber';
}

const toneClassMap: Record<NonNullable<FocusStatsCardProps['tone']>, string> = {
  slate: 'text-slate-400',
  sky: 'text-sky-500',
  amber: 'text-amber-600',
};

/**
 * Compact stat tile for daily focus metrics (Today / Home dashboards).
 * Specialization of the flat SectionCard surface. Presentation only.
 */
export default function FocusStatsCard({
  label,
  value,
  caption,
  tone = 'slate',
}: FocusStatsCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
      <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${toneClassMap[tone]}`}>
        {label}
      </p>
      <p className="mt-2 truncate text-2xl font-semibold tracking-[-0.04em] text-slate-950">
        {value}
      </p>
      {caption && <p className="mt-1 text-sm text-slate-500">{caption}</p>}
    </div>
  );
}
