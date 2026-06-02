import type { PomodoroMode } from '../../types/focus.type';
import { POMODORO_MODE_LABELS } from '../../utils/pomodoroTime';
import { POMODORO_MODES } from '../../constants';

interface PomodoroModeSwitchProps {
  mode: PomodoroMode;
  onModeChange: (mode: PomodoroMode) => void;
}

function PomodoroModeSwitch({ mode, onModeChange }: PomodoroModeSwitchProps) {
  return (
    <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
      {POMODORO_MODES.map((currentMode) => (
        <button
          key={currentMode}
          type="button"
          onClick={() => onModeChange(currentMode)}
          className={`cursor-pointer rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
            mode === currentMode
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-300 hover:text-white'
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
