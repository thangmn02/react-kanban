import type { DailyFocusStats, FocusTask, PomodoroMode, PomodoroTimerState } from '../../types/focus.type';
import { formatPomodoroTime } from '../../utils/pomodoroTime';
import PomodoroModeSwitch from './PomodoroModeSwitch';

interface PomodoroTimerProps {
  focusTasks: FocusTask[];
  activeTaskId: string | null;
  timerState: PomodoroTimerState;
  dailyFocusStats: DailyFocusStats;
  remainingSeconds: number;
  onActiveTaskChange: (taskId: string) => void;
  onModeChange: (mode: PomodoroMode) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onPopOutTimer: () => void;
  canPopOutTimer: boolean;
  isPictureInPictureSupported: boolean;
  isPictureInPictureOpen: boolean;
}

function PomodoroTimer({
  focusTasks,
  activeTaskId,
  timerState,
  dailyFocusStats,
  remainingSeconds,
  onActiveTaskChange,
  onModeChange,
  onStart,
  onPause,
  onReset,
  onPopOutTimer,
  canPopOutTimer,
  isPictureInPictureSupported,
  isPictureInPictureOpen,
}: PomodoroTimerProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">
            Pomodoro
          </p>
          <div className="mt-1 text-4xl font-semibold tracking-[-0.06em] tabular-nums text-white">
            {formatPomodoroTime(remainingSeconds)}
          </div>
        </div>

        <PomodoroModeSwitch mode={timerState.mode} onModeChange={onModeChange} />
      </div>

      <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        Timer task
      </label>
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">
        Today: {dailyFocusStats.completedSessions} session{dailyFocusStats.completedSessions === 1 ? '' : 's'} · {dailyFocusStats.focusedMinutes} focused minutes
      </div>
      <select
        value={activeTaskId || ''}
        onChange={(event) => onActiveTaskChange(event.target.value)}
        className="mt-2 w-full cursor-pointer rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white outline-none transition focus:ring-4 focus:ring-sky-400/30"
        aria-label="Choose active focus timer task"
      >
        {focusTasks.map((focusTask) => (
          <option key={focusTask.id} value={focusTask.id} className="text-slate-900">
            {focusTask.title}
          </option>
        ))}
      </select>

      <div className="mt-4 flex items-center gap-2">
        {timerState.isRunning ? (
          <button
            type="button"
            onClick={onPause}
            className="flex-1 cursor-pointer rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-blue-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/40 active:scale-[0.98]"
            aria-label="Pause focus timer"
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            className="flex-1 cursor-pointer rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-blue-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={focusTasks.length === 0}
            aria-label="Start focus timer"
          >
            Start
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="cursor-pointer rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/30 active:scale-[0.98]"
          aria-label="Reset focus timer"
        >
          Reset
        </button>
      </div>

      <button
        type="button"
        onClick={onPopOutTimer}
        disabled={!canPopOutTimer}
        className="mt-3 w-full cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-sky-200 transition hover:bg-white/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Open floating focus timer"
      >
        {isPictureInPictureOpen
          ? 'Floating timer open'
          : isPictureInPictureSupported
            ? 'Pop out timer'
            : 'Pop out unavailable'}
      </button>
    </section>
  );
}

export default PomodoroTimer;
