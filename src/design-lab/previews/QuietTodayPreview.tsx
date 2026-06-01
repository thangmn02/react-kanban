import { useState } from 'react';

import PageHeader from '../../components/atoms/PageHeader';
import SectionCard from '../../components/atoms/SectionCard';
import FocusStatsCard from '../../components/atoms/FocusStatsCard';
import EmptyState from '../../components/atoms/EmptyState';
import Badge from '../../components/atoms/Badge';
import DesignLabLayout from '../DesignLabLayout';
import QuietTaskCard from '../QuietTaskCard';
import {
  MOCK_FOCUS_STATS,
  MOCK_FOCUS_TASKS,
  MOCK_OVERDUE_TASKS,
} from '../mockData';

/**
 * Preview 2 — /design-lab/quiet-today
 * Daily planning surface: 1–3 focus tasks in recommended order, focus stats,
 * overdue/due-today section, a start-focus action, and a no-tasks empty state.
 */
export default function QuietTodayPreview() {
  // Preview-only toggle to show the empty-state variant without mutations.
  const [showEmpty, setShowEmpty] = useState(false);
  const focusTasks = showEmpty ? [] : MOCK_FOCUS_TASKS;

  return (
    <DesignLabLayout current="/design-lab/quiet-today">
      <PageHeader
        eyebrow="Today"
        title="My Day"
        description="Pick the few tasks that matter today, then start a focused session."
        className="mb-6"
        actions={(
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmpty((value) => !value)}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              {showEmpty ? 'Show tasks' : 'Preview empty'}
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
            >
              Quick add task
            </button>
          </div>
        )}
      />

      {/* Focus stats */}
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <FocusStatsCard label="Today" value={`${MOCK_FOCUS_STATS.completedSessions} sessions`} caption={`${MOCK_FOCUS_STATS.focusedMinutes} focused minutes`} />
        <FocusStatsCard label="Interruptions" value={String(MOCK_FOCUS_STATS.interruptedSessions)} caption="stopped after 60s" />
        <FocusStatsCard label="Top focus" value={MOCK_FOCUS_STATS.topTaskTitle} caption="Most time invested" tone="sky" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* Daily focus plan */}
        <SectionCard className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600">Daily focus plan</h2>
              <p className="mt-1 text-sm text-slate-500">Up to 3 tasks, in recommended order.</p>
            </div>
            <Badge tone="accent">{focusTasks.length}/3</Badge>
          </div>

          {focusTasks.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No focus tasks yet"
                description="Choose one task to focus on and start a session."
                action={(
                  <button
                    type="button"
                    className="inline-flex cursor-pointer items-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                  >
                    Quick add task
                  </button>
                )}
              />
            </div>
          ) : (
            <ol className="mt-4 grid gap-3">
              {focusTasks.map((task, index) => (
                <li key={task.id} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <QuietTaskCard task={task} />
                    <button
                      type="button"
                      className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    >
                      <svg className="h-3.5 w-3.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Start focus
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>

        {/* Overdue / due today */}
        <div className="space-y-6">
          <SectionCard className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600">Overdue</h2>
                <p className="mt-1 text-sm text-slate-500">Clear these first if they still matter.</p>
              </div>
              <Badge tone="danger">{MOCK_OVERDUE_TASKS.length}</Badge>
            </div>
            <div className="grid gap-3">
              {MOCK_OVERDUE_TASKS.map((task) => (
                <QuietTaskCard key={task.id} task={task} />
              ))}
            </div>
          </SectionCard>

          <SectionCard className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600">Due today</h2>
                <p className="mt-1 text-sm text-slate-500">Deadline-driven work for today.</p>
              </div>
              <Badge tone="warning">1</Badge>
            </div>
            <div className="grid gap-3">
              <QuietTaskCard task={MOCK_FOCUS_TASKS[0]} />
            </div>
          </SectionCard>
        </div>
      </div>
    </DesignLabLayout>
  );
}
