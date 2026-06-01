import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Small uppercase label above the title. */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Optional right-aligned action block (buttons, badges, avatar). */
  actions?: ReactNode;
  /** 'page' = larger hero scale; 'section' = compact in-card heading. */
  size?: 'page' | 'section';
  className?: string;
}

/**
 * Standardized eyebrow + title + description + actions header. Consolidates the
 * hero/section header pattern repeated across Today, Home, Auth, Onboarding,
 * and the board empty state, and normalizes eyebrow tracking to the two
 * documented values (0.28em hero / 0.2em section). Presentation only.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  size = 'page',
  className = '',
}: PageHeaderProps) {
  const isPage = size === 'page';

  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p
            className={`font-semibold uppercase text-blue-600 ${
              isPage ? 'text-[11px] tracking-[0.28em]' : 'text-[11px] tracking-[0.2em]'
            }`}
          >
            {eyebrow}
          </p>
        )}
        <h1
          className={`font-semibold tracking-[-0.03em] text-slate-950 ${
            isPage ? 'mt-2 text-3xl sm:text-4xl' : 'mt-1 text-xl'
          }`}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
