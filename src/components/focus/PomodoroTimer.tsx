import { useState } from 'react';

import type {
  DailyFocusStats,
  FocusTask,
  PomodoroMode,
  PomodoroTimerSettings,
  PomodoroTimerState,
} from '../../types/focus.type';
import { formatPomodoroTime } from '../../utils/pomodoroTime';
import PomodoroModeSwitch from './PomodoroModeSwitch';
import PomodoroTimerSettingsPanel from './PomodoroTimerSettingsPanel';
import { useI18n } from '../../i18n';

interface PomodoroTimerProps {
  focusTasks: FocusTask[];
  activeTaskId: string | null;
  timerState: PomodoroTimerState;
  timerSettings: PomodoroTimerSettings;
  dailyFocusStats: DailyFocusStats;
  remainingSeconds: number;
  onActiveTaskChange: (taskId: string) => void;
  onModeChange: (mode: PomodoroMode) => void;
  onTimerSettingsChange: (patch: Partial<PomodoroTimerSettings>) => void;
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
  timerSettings,
  dailyFocusStats,
  remainingSeconds,
  onActiveTaskChange,
  onModeChange,
  onTimerSettingsChange,
  onStart,
  onPause,
  onReset,
  onPopOutTimer,
  canPopOutTimer,
  isPictureInPictureSupported,
  isPictureInPictureOpen,
}: PomodoroTimerProps) {
  const { t } = useI18n();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const cyclePosition = Math.min((timerState.completedCycleFocus || 0) + 1, timerSettings.longBreakEvery);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">
            {t('focus.timer.pomodoro')}
          </p>
          <div className="mt-1 text-4xl font-semibold tracking-[-0.06em] tabular-nums text-white">
            {formatPomodoroTime(remainingSeconds)}
          </div>
          {timerState.mode === 'focus' && (
            <p className="mt-1 text-xs font-medium text-slate-400">
              {t('focus.timer.cycleProgress', { current: cyclePosition, total: timerSettings.longBreakEvery })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <PomodoroModeSwitch mode={timerState.mode} onModeChange={onModeChange} />
          <button
            type="button"
            onClick={() => setIsSettingsOpen((open) => !open)}
            aria-expanded={isSettingsOpen}
            aria-label={isSettingsOpen ? t('focus.timer.closeSettings') : t('focus.timer.settings')}
            title={t('focus.timer.settings')}
            className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
              isSettingsOpen
                ? 'border-sky-300/50 bg-sky-400/20 text-sky-200'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
          </button>
        </div>
      </div>

      {isSettingsOpen && (
        <PomodoroTimerSettingsPanel
          settings={timerSettings}
          hasActiveSession={Boolean(timerState.startedAt)}
          onChange={onTimerSettingsChange}
        />
      )}

      {focusTasks.length > 0 && <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {t('focus.timer.task')}
      </label>}
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">
        {t('focus.timer.todayStats', {
          sessions: dailyFocusStats.completedSessions,
          sessionPlural: dailyFocusStats.completedSessions === 1 ? '' : 's',
          minutes: dailyFocusStats.focusedMinutes,
        })}
      </div>
      {focusTasks.length > 0 && <select
        value={activeTaskId || ''}
        onChange={(event) => onActiveTaskChange(event.target.value)}
        className="mt-2 w-full cursor-pointer rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white outline-none transition focus:ring-4 focus:ring-sky-400/30"
        aria-label={t('focus.timer.chooseTask')}
      >
        {focusTasks.map((focusTask) => (
          <option key={focusTask.id} value={focusTask.id} className="text-slate-900">
            {focusTask.title}
          </option>
        ))}
      </select>}

      <div className="mt-4 flex items-center gap-2">
        {timerState.isRunning ? (
          <button
            type="button"
            onClick={onPause}
            className="flex-1 cursor-pointer rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-blue-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/40 active:scale-[0.98]"
            aria-label={t('focus.timer.pause')}
          >
            {t('focus.timer.pause')}
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            className="flex-1 cursor-pointer rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-blue-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={t('focus.timer.start')}
          >
            {t('focus.timer.start')}
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="cursor-pointer rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/30 active:scale-[0.98]"
          aria-label={t('focus.timer.reset')}
        >
          {t('focus.timer.reset')}
        </button>
      </div>

      <button
        type="button"
        onClick={onPopOutTimer}
        disabled={!canPopOutTimer}
        className="mt-3 w-full cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-sky-200 transition hover:bg-white/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={t('focus.timer.openFloating')}
      >
        {isPictureInPictureOpen
          ? t('focus.timer.floatingOpen')
          : isPictureInPictureSupported
            ? t('focus.timer.popOut')
            : t('focus.timer.popOutUnavailable')}
      </button>
    </section>
  );
}

export default PomodoroTimer;
