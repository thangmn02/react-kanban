import type { ReactNode } from 'react';

import { MOCK_USER } from './mockData';

export type LabRoute =
  | '/design-lab/quiet-home'
  | '/design-lab/quiet-today'
  | '/design-lab/quiet-board'
  | '/design-lab/quiet-focus';

interface DesignLabLayoutProps {
  current: LabRoute;
  children: ReactNode;
}

const LAB_LINKS: { href: LabRoute; label: string }[] = [
  { href: '/design-lab/quiet-home', label: 'Home' },
  { href: '/design-lab/quiet-today', label: 'Today' },
  { href: '/design-lab/quiet-board', label: 'Board' },
  { href: '/design-lab/quiet-focus', label: 'Focus' },
];

/**
 * Shared chrome for every Quiet Velocity preview: the app shell background, a
 * calm header with workspace indicator, and preview navigation. Preview-only —
 * the nav uses plain anchors so it works without the production router and
 * touches no production routing logic.
 */
export default function DesignLabLayout({ current, children }: DesignLabLayoutProps) {
  return (
    <div className="min-h-screen bg-canvas text-slate-900">
      {/* App shell header (quiet surface) */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-7">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-600 text-sm font-bold text-white"
            >
              QV
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600">
                Quiet Velocity
              </p>
              <p className="truncate text-sm font-semibold text-slate-900">Design Lab preview</p>
            </div>
          </div>

          {/* Workspace indicator */}
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-1.5">
            <img src={MOCK_USER.avatar} alt="" aria-hidden="true" className="h-7 w-7 rounded-full" />
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-slate-900">{MOCK_USER.workspace}</p>
              <p className="text-[11px] text-slate-500">{MOCK_USER.name}</p>
            </div>
          </div>
        </div>

        {/* Preview navigation */}
        <nav aria-label="Design lab previews" className="mx-auto max-w-7xl px-5 pb-3 sm:px-7">
          <ul className="flex flex-wrap gap-2">
            {LAB_LINKS.map((link) => {
              const isActive = link.href === current;
              return (
                <li key={link.href}>
                  <a
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`inline-flex cursor-pointer items-center rounded-xl px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                      isActive
                        ? 'bg-slate-950 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {link.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-7 sm:px-7">{children}</main>

      <footer className="mx-auto max-w-7xl px-5 pb-10 sm:px-7">
        <p className="text-center text-xs text-slate-400">
          Preview only · static mock data · no backend, auth, or mutations
        </p>
      </footer>
    </div>
  );
}
