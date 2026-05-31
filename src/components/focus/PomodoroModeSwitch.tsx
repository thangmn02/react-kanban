import type { PomodoroMode } from '../../types/focus.type';
import { POMODORO_MODE_LABELS } from '../../utils/pomodoroTime';
import { POMODORO_MODES } from '../../constants';

interface PomodoroModeSwitchProps {
  mode: PomodoroMode;
  onModeChange: (mode: PomodoroMode) => void;
}

function PomodoroModeSwitch({ mode, onModeChange }: PomodoroModeSwitchProps) {
  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner">
      {POMODORO_MODES.map((currentMode) => (
        <button
          key={currentMode}
          type="button"
          onClick={() => onModeChange(currentMode)}
          className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-300 ${
            mode === currentMode
              ? 'bg-white text-slate-950 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          aria-pressed={mode === currentMode}
        >
          {POMODORO_MODE_LABELS[currentMode]}
        </button>
      ))}
    </div>
  );
}

export default PomodoroModeSwitch;
