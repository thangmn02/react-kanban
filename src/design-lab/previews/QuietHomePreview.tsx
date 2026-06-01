import SectionCard from '../../components/atoms/SectionCard';
import EmptyState from '../../components/atoms/EmptyState';
import Badge from '../../components/atoms/Badge';
import DueDateBadge from '../../components/atoms/DueDateBadge';
import { Skeleton, SkeletonCard } from '../../components/atoms/skeleton';
import { getPriorityBadgeClass } from '../../utils/taskMetadata';
import DesignLabLayout from '../DesignLabLayout';
import QuietTaskCard from '../QuietTaskCard';
import {
  MOCK_FOCUS_STATS,
  MOCK_FOCUS_TASKS,
  MOCK_OVERDUE_TASKS,
  MOCK_RECENT_BOARDS,
} from '../mockData';

/**
 * Preview 1 — /design-lab/quiet-home (focus-first refinement)
 *
 * The page answers "what should I do now?" in the first viewport. A single
 * dominant Focus Now hero (primary task + why it matters + start CTA + focus
 * progress) outweighs everything else. "Up next" and carry-over are compact
 * supporting context; quick capture is a small secondary action; recent boards
 * are de-emphasized navigation chips. Original Quiet Velocity — no product clone.
 */
export default function QuietHomePreview() {
  const heroTask = MOCK_FOCUS_TASKS[0];
  const heroPriorityClass = getPriorityBadgeClass(heroTask.priority ?? undefined);
  const upNext = MOCK_FOCUS_TASKS.slice(1);
  const sessionGoal = 4;
  const sessionsDone = MOCK_FOCUS_STATS.completedSessions;
  const progressPct = Math.min(100, Math.round((sessionsDone / sessionGoal) * 100));

  return (
    <DesignLabLayout current="/design-lab/quiet-home">
      {/* Quiet greeting — deliberately small so the hero dominates */}
      <p className="text-sm text-slate-500">Monday · Good afternoon, Avery</p>

      {/* ===== FOCUS NOW HERO — the single dominant element ===== */}
      <section
        aria-labelledby="focus-now-title"
        className="mt-2 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card"
      >
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* Left: the one task to start now */}
          <div className="border-b border-slate-100 p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-700">
                Focus now
              </p>
            </div>

            <h1
              id="focus-now-title"
              className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl"
            >
              {heroTask.title}
            </h1>

            {/* Why it matters */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {heroTask.priority && heroPriorityClass && (
                <Badge className={heroPriorityClass} uppercase>
                  {heroTask.priority}
                </Badge>
              )}
              {heroTask.dueDate && <DueDateBadge dueDate={heroTask.dueDate} />}
              <Badge tone="neutral">{heroTask.boardTitle}</Badge>
            </div>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              Due today and highest priority on your plate — a focused 25-minute block clears it before
              the afternoon fills up.
            </p>

            {/* How to start */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
              >
                <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start 25-min focus
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Open task
              </button>
            </div>
          </div>

          {/* Right: focus progress for today (reinforces "finish, don't organize") */}
          <div className="bg-slate-50/70 p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Today's focus progress
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              {sessionsDone} of {sessionGoal} sessions
            </p>
            <div
              className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuenow={sessionsDone}
              aria-valuemin={0}
              aria-valuemax={sessionGoal}
              aria-label="Focus sessions completed today"
            >
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${progressPct}%` }} />
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Focused</dt>
                <dd className="mt-1 text-lg font-semibold text-slate-950">{MOCK_FOCUS_STATS.focusedMinutes} min</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Interruptions</dt>
                <dd className="mt-1 text-lg font-semibold text-slate-950">{MOCK_FOCUS_STATS.interruptedSessions}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ===== SUPPORTING CONTEXT — clearly secondary ===== */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* Carry-over / due — visible but not competing with the hero */}
          {MOCK_OVERDUE_TASKS.length > 0 && (
            <SectionCard className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600">Carry-over</h2>
                <Badge tone="danger">{MOCK_OVERDUE_TASKS.length} overdue</Badge>
              </div>
              <div className="grid gap-3">
                {MOCK_OVERDUE_TASKS.map((task) => (
                  <QuietTaskCard key={task.id} task={task} compact />
                ))}
              </div>
            </SectionCard>
          )}

          {/* Up next — compact list, not the headline */}
          <SectionCard className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-600">Up next</h2>
              <Badge tone="neutral">{upNext.length}</Badge>
            </div>
            <div className="grid gap-3">
              {upNext.map((task) => (
                <QuietTaskCard key={task.id} task={task} compact />
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          {/* Quick capture — secondary action, intentionally understated */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <label htmlFor="quick-capture" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Quick capture
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="quick-capture"
                type="text"
                placeholder="Park a thought…"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
              <button
                type="button"
                aria-label="Add captured task"
                className="cursor-pointer rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Add
              </button>
            </div>
          </div>

          {/* Recent boards — de-emphasized navigation chips */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Recent boards</p>
            <div className="flex flex-wrap gap-2">
              {MOCK_RECENT_BOARDS.map((board) => (
                <button
                  key={board.id}
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  {board.title}
                  <span className="text-xs text-slate-400">{board.taskCount}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* State previews (lab only) */}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Empty state preview</p>
          <EmptyState
            title="No assigned tasks"
            description="Tasks assigned to you across this workspace will show up here."
          />
        </div>
        <div aria-busy="true">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Skeleton state preview</p>
          <SectionCard className="p-4">
            <Skeleton className="h-4 w-32" />
            <div className="mt-4 grid gap-3">
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
            </div>
          </SectionCard>
        </div>
      </div>
    </DesignLabLayout>
  );
}
