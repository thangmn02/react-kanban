import type { PomodoroMode } from '../../types/focus.type';
import { POMODORO_MODES } from '../../constants';
import { useI18n } from '../../i18n';

interface PomodoroModeSwitchProps {
  mode: PomodoroMode;
  onModeChange: (mode: PomodoroMode) => void;
}

function PomodoroModeSwitch({ mode, onModeChange }: PomodoroModeSwitchProps) {
  const { t } = useI18n();
  const modeLabels: Record<PomodoroMode, string> = {
    focus: t('focus.mode.focus'),
    shortBreak: t('focus.mode.shortBreak'),
    longBreak: t('focus.mode.longBreak'),
  };

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
          {modeLabels[currentMode]}
        </button>
      ))}
    </div>
  );
}

export default PomodoroModeSwitch;
