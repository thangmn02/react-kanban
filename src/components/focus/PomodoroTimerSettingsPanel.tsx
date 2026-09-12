import type { PomodoroTimerSettings } from '../../types/focus.type';
import {
  FOCUS_LENGTH_PRESETS,
  LONG_BREAK_EVERY_MAX,
  LONG_BREAK_EVERY_MIN,
  LONG_BREAK_PRESETS,
  SHORT_BREAK_PRESETS,
} from '../../utils/pomodoroTime';
import { useI18n } from '../../i18n';

interface PomodoroTimerSettingsPanelProps {
  settings: PomodoroTimerSettings;
  hasActiveSession: boolean;
  onChange: (patch: Partial<PomodoroTimerSettings>) => void;
}

function DurationRow({
  label,
  presets,
  value,
  onSelect,
  formatMinutes,
}: {
  label: string;
  presets: readonly number[];
  value: number;
  onSelect: (minutes: number) => void;
  formatMinutes: (minutes: number) => string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-300">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const isSelected = preset === value;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onSelect(preset)}
              aria-pressed={isSelected}
              className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                isSelected
                  ? 'bg-sky-400 text-slate-900 shadow-sm'
                  : 'bg-white/10 text-slate-200 hover:bg-white/20'
              }`}
            >
              {formatMinutes(preset)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
          checked ? 'bg-sky-400' : 'bg-white/15'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function PomodoroTimerSettingsPanel({
  settings,
  hasActiveSession,
  onChange,
}: PomodoroTimerSettingsPanelProps) {
  const { t } = useI18n();
  const formatMinutes = (minutes: number) => t('focus.timer.minutes', { count: minutes });

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
      <DurationRow
        label={t('focus.timer.focusLength')}
        presets={FOCUS_LENGTH_PRESETS}
        value={settings.focusMinutes}
        onSelect={(focusMinutes) => onChange({ focusMinutes })}
        formatMinutes={formatMinutes}
      />
      <DurationRow
        label={t('focus.timer.shortBreakLength')}
        presets={SHORT_BREAK_PRESETS}
        value={settings.shortBreakMinutes}
        onSelect={(shortBreakMinutes) => onChange({ shortBreakMinutes })}
        formatMinutes={formatMinutes}
      />
      <DurationRow
        label={t('focus.timer.longBreakLength')}
        presets={LONG_BREAK_PRESETS}
        value={settings.longBreakMinutes}
        onSelect={(longBreakMinutes) => onChange({ longBreakMinutes })}
        formatMinutes={formatMinutes}
      />

      <div className="flex items-center justify-between gap-3">
        <span id="pomodoro-long-break-every-label" className="text-xs font-semibold text-slate-300">
          {t('focus.timer.longBreakEvery')}
        </span>
        <div className="flex items-center gap-2" role="group" aria-labelledby="pomodoro-long-break-every-label">
          <button
            type="button"
            onClick={() => onChange({ longBreakEvery: settings.longBreakEvery - 1 })}
            disabled={settings.longBreakEvery <= LONG_BREAK_EVERY_MIN}
            aria-label={t('focus.timer.decrease')}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/10 text-sm font-bold text-slate-100 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            -
          </button>
          <span className="min-w-[4.5rem] text-center text-xs font-semibold tabular-nums text-slate-100">
            {t('focus.timer.sessionsCount', { count: settings.longBreakEvery })}
          </span>
          <button
            type="button"
            onClick={() => onChange({ longBreakEvery: settings.longBreakEvery + 1 })}
            disabled={settings.longBreakEvery >= LONG_BREAK_EVERY_MAX}
            aria-label={t('focus.timer.increase')}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/10 text-sm font-bold text-slate-100 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      <ToggleRow
        label={t('focus.timer.autoStartBreaks')}
        checked={settings.autoStartBreaks}
        onChange={(autoStartBreaks) => onChange({ autoStartBreaks })}
      />
      <ToggleRow
        label={t('focus.timer.autoStartFocus')}
        checked={settings.autoStartFocus}
        onChange={(autoStartFocus) => onChange({ autoStartFocus })}
      />
      {hasActiveSession && (
        <p className="text-[11px] leading-4 text-slate-400">{t('focus.timer.settingsApplyNext')}</p>
      )}
    </div>
  );
}

export default PomodoroTimerSettingsPanel;
