import Badge from '../../components/atoms/Badge';
import DesignLabLayout from '../DesignLabLayout';
import { MOCK_COMPLETED_SESSION, MOCK_FOCUS_TASKS } from '../mockData';

/**
 * Preview 4 — /design-lab/quiet-focus
 * The Focus Layer showcase. These are the ONLY surfaces that get the reserved
 * depth (shadow-focus-surface) + restrained glass (backdrop-blur) + confident
 * accent edge, so "active focus" reads as a distinct elevated plane.
 *
 * Motion is kept minimal and CSS-only; the global prefers-reduced-motion guard
 * in index.css collapses any transition/animation, so this preview is
 * reduced-motion safe without extra JS.
 */
export default function QuietFocusPreview() {
  const task = MOCK_FOCUS_TASKS[0];

  return (
    <DesignLabLayout current="/design-lab/quiet-focus">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-600">Focus Layer</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">Focus surfaces</h1>
        <p className="mt-1 text-sm text-slate-500">
          Elevated, glassy, intentional — depth and glass appear only here.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Focus Dock — expanded */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Focus Dock — expanded</p>
          <div className="rounded-3xl border border-white/60 bg-slate-900/90 p-5 shadow-[var(--shadow-focus-surface)] backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
                <p className="text-sm font-semibold text-white">Focus Dock</p>
              </div>
              <button type="button" aria-label="Collapse focus dock" className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
                <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">Now focusing</p>
              <p className="mt-1 truncate text-sm font-semibold text-white">{task.title}</p>
              <p className="mt-0.5 text-xs text-slate-200">{task.boardTitle} · {task.listTitle}</p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-3xl font-semibold tracking-[-0.04em] tabular-nums text-white">24:13</span>
              <div className="flex gap-2">
                <button type="button" aria-label="Pause timer" className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl bg-white/10 text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
                  <svg className="h-5 w-5" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                </button>
                <button type="button" className="cursor-pointer rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">Done</button>
              </div>
            </div>
          </div>
        </div>

        {/* Focus Dock — collapsed */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Focus Dock — collapsed</p>
          <div className="inline-flex items-center gap-3 rounded-2xl border border-white/60 bg-slate-900/90 px-4 py-3 shadow-[var(--shadow-focus-surface)] backdrop-blur-md">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
            <span className="text-2xl font-semibold tabular-nums text-white">24:13</span>
            <span className="max-w-[12rem] truncate text-xs text-slate-200">{task.title}</span>
            <button type="button" aria-label="Expand focus dock" className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
              <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
            </button>
          </div>
        </div>

        {/* Pomodoro active state */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pomodoro — active</p>
          <div className="rounded-3xl border border-white/60 bg-slate-900/90 p-6 text-center shadow-[var(--shadow-focus-surface)] backdrop-blur-md">
            <Badge tone="accent">Focus</Badge>
            <div className="mx-auto mt-4 flex h-40 w-40 items-center justify-center rounded-full border-4 border-sky-400/40">
              <span className="text-4xl font-semibold tracking-[-0.04em] tabular-nums text-white">24:13</span>
            </div>
            <div className="mt-5 flex justify-center gap-2">
              <button type="button" className="cursor-pointer rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">Pause</button>
              <button type="button" className="cursor-pointer rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">Reset</button>
            </div>
          </div>
        </div>

        {/* Floating Timer preview */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Floating Timer (PiP)</p>
          <div className="inline-flex flex-col gap-2 rounded-3xl border border-white/60 bg-slate-900/95 p-4 shadow-[var(--shadow-focus-surface)] backdrop-blur-md">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">Focus</span>
            <span className="text-5xl font-semibold tabular-nums text-white">24:13</span>
            <span className="max-w-[14rem] truncate text-xs text-slate-200">{task.title}</span>
          </div>
        </div>
      </div>

      {/* Completed focus session summary */}
      <div className="mt-8">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Completed session summary</p>
        <div className="rounded-3xl border border-emerald-200/70 bg-emerald-50/60 p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-white" aria-hidden="true">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Focus session complete</p>
              <p className="text-xs text-slate-600">{MOCK_COMPLETED_SESSION.completedAtLabel}</p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-4">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Duration</dt>
              <dd className="mt-1 text-xl font-semibold text-slate-950">{MOCK_COMPLETED_SESSION.durationLabel}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Mode</dt>
              <dd className="mt-1 text-xl font-semibold text-slate-950">{MOCK_COMPLETED_SESSION.mode}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Task</dt>
              <dd className="mt-1 truncate text-sm font-semibold text-slate-950">{MOCK_COMPLETED_SESSION.taskTitle}</dd>
            </div>
          </dl>
        </div>
      </div>
    </DesignLabLayout>
  );
}
