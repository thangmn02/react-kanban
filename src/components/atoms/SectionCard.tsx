import type { ReactNode } from 'react';

interface SectionCardProps {
  children: ReactNode;
  /**
   * 'flat' (default) — calm content surface: subtle --shadow-card, slate
   * hairline, NO glass/blur. Use for dashboards, panels, lists.
   * 'plain' — same surface without padding wrapper assumptions; identical
   * styling, provided for naming clarity at call sites.
   */
  variant?: 'flat' | 'plain';
  className?: string;
}

/**
 * Calm, flat content-surface card (Apple Calm direction). Replaces the glassy
 * AppleCard on ordinary content surfaces: no backdrop-blur, the subtle
 * `--shadow-card` token, and a 1px slate hairline. Glass + the heavy
 * `--shadow-focus-surface` stay reserved for the Focus Dock / Floating Timer.
 * Presentation only — no behavior, no motion.
 */
export default function SectionCard({
  children,
  className = '',
}: SectionCardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-card ${className}`}
    >
      {children}
    </div>
  );
}
