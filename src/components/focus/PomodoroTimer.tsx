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
    <section className="rounded-2xl border border-white/80 bg-white/76 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Pomodoro
          </p>
          <div className="mt-1 text-4xl font-semibold tracking-[-0.06em] text-slate-950">
            {formatPomodoroTime(remainingSeconds)}
          </div>
        </div>

        <PomodoroModeSwitch mode={timerState.mode} onModeChange={onModeChange} />
      </div>

      <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        Timer task
      </label>
      <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
        Today: {dailyFocusStats.completedSessions} session{dailyFocusStats.completedSessions === 1 ? '' : 's'} · {dailyFocusStats.focusedMinutes} focused minutes
      </div>
      <select
        value={activeTaskId || ''}
        onChange={(event) => onActiveTaskChange(event.target.value)}
        className="mt-2 w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition focus:ring-4 focus:ring-sky-100"
        aria-label="Choose active focus timer task"
      >
        {focusTasks.map((focusTask) => (
          <option key={focusTask.id} value={focusTask.id}>
            {focusTask.title}
          </option>
        ))}
      </select>

      <div className="mt-4 flex items-center gap-2">
        {timerState.isRunning ? (
          <button
            type="button"
            onClick={onPause}
            className="flex-1 cursor-pointer rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-slate-200 active:scale-[0.98]"
            aria-label="Pause focus timer"
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            className="flex-1 cursor-pointer rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-slate-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={focusTasks.length === 0}
            aria-label="Start focus timer"
          >
            Start
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-sky-100 active:scale-[0.98]"
          aria-label="Reset focus timer"
        >
          Reset
        </button>
      </div>

      <button
        type="button"
        onClick={onPopOutTimer}
        disabled={!canPopOutTimer}
        className="mt-3 w-full cursor-pointer rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 focus:outline-none focus:ring-4 focus:ring-blue-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
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
