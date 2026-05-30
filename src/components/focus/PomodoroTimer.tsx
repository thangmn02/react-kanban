import type { FocusTask, PomodoroMode, PomodoroTimerState } from '../../types/focus.type';
import { formatPomodoroTime } from '../../utils/pomodoroTime';
import PomodoroModeSwitch from './PomodoroModeSwitch';

interface PomodoroTimerProps {
  focusTasks: FocusTask[];
  activeTaskId: string | null;
  timerState: PomodoroTimerState;
  remainingSeconds: number;
  onActiveTaskChange: (taskId: string) => void;
  onModeChange: (mode: PomodoroMode) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

function PomodoroTimer({
  focusTasks,
  activeTaskId,
  timerState,
  remainingSeconds,
  onActiveTaskChange,
  onModeChange,
  onStart,
  onPause,
  onReset,
}: PomodoroTimerProps) {
  return (
    <section className="rounded-[1.35rem] border border-white/80 bg-white/76 p-4 shadow-sm">
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
      <select
        value={activeTaskId || ''}
        onChange={(event) => onActiveTaskChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition focus:ring-4 focus:ring-sky-100"
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
            className="flex-1 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-slate-200 active:scale-[0.98]"
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            className="flex-1 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-slate-200 active:scale-[0.98]"
            disabled={focusTasks.length === 0}
          >
            Start
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-sky-100 active:scale-[0.98]"
        >
          Reset
        </button>
      </div>
    </section>
  );
}

export default PomodoroTimer;
