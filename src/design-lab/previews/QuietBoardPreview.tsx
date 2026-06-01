import { useState } from 'react';

import Badge from '../../components/atoms/Badge';
import DesignLabLayout from '../DesignLabLayout';
import QuietTaskCard from '../QuietTaskCard';
import { MOCK_BOARD_COLUMNS } from '../mockData';

/**
 * Preview 3 — /design-lab/quiet-board
 * Board header, search/filter toolbar, columns with quiet task cards, and a
 * (preview-only) list action menu. Drag/drop is intentionally NOT wired here —
 * this validates the visual hierarchy and card readability only.
 */
export default function QuietBoardPreview() {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <DesignLabLayout current="/design-lab/quiet-board">
      {/* Board header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-600">Board</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Product</h1>
          <p className="mt-1 text-sm text-slate-500">18 tasks across 4 lists</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            <img src="https://api.dicebear.com/7.x/initials/svg?seed=Avery%20Quinn" alt="Avery Quinn" className="h-8 w-8 rounded-full border-2 border-white" />
            <img src="https://api.dicebear.com/7.x/initials/svg?seed=Sam%20Rivera" alt="Sam Rivera" className="h-8 w-8 rounded-full border-2 border-white" />
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
          >
            Add task
          </button>
        </div>
      </div>

      {/* Search / filter toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-card">
        <div className="relative min-w-0 flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            type="search"
            placeholder="Search tasks…"
            className="w-full rounded-xl border border-transparent bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>
        <button type="button" className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
          Priority
        </button>
        <button type="button" className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
          Assignee
        </button>
        <button type="button" className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
          Due date
        </button>
      </div>

      {/* Columns */}
      <div className="flex items-start gap-5 overflow-x-auto pb-4">
        {MOCK_BOARD_COLUMNS.map((column) => (
          <section key={column.id} className="flex w-80 flex-shrink-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">{column.title}</h2>
                <Badge tone="neutral">{column.tasks.length}</Badge>
              </div>
              <div className="relative">
                <button
                  type="button"
                  aria-label={`List actions for ${column.title}`}
                  aria-haspopup="menu"
                  aria-expanded={openMenuId === column.id}
                  onClick={() => setOpenMenuId((id) => (id === column.id ? null : column.id))}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <svg className="h-5 w-5" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                  </svg>
                </button>
                {openMenuId === column.id && (
                  <div role="menu" className="absolute right-0 z-10 mt-1 w-40 rounded-2xl border border-slate-200 bg-white p-1 shadow-card">
                    <button type="button" role="menuitem" className="block w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">Rename list</button>
                    <button type="button" role="menuitem" className="block w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">Add task</button>
                    <button type="button" role="menuitem" className="block w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300">Delete list</button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {column.tasks.map((task) => (
                <QuietTaskCard key={task.id} task={task} compact />
              ))}
            </div>

            <button
              type="button"
              className="mt-3 cursor-pointer rounded-xl border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-500 transition-colors hover:border-sky-300 hover:bg-sky-50/40 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              + Add task
            </button>
          </section>
        ))}

        <div className="w-80 flex-shrink-0">
          <button
            type="button"
            className="w-full cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-white/60 py-9 text-sm font-semibold text-slate-500 transition-colors hover:border-sky-300 hover:bg-white hover:text-slate-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
          >
            + Add another list
          </button>
        </div>
      </div>
    </DesignLabLayout>
  );
}
