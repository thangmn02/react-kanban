import { useIslandPosition } from './useIslandPosition';
import './focusIsland.css';
import { motion, useReducedMotion } from 'framer-motion';

import type {
  DailyFocusStats,
  FocusTask,
  PomodoroMode,
  PomodoroTimerSettings,
  PomodoroTimerState,
} from '../../types/focus.type';
import { formatPomodoroTime } from '../../utils/pomodoroTime';
import { useI18n } from '../../i18n';
import FocusDockHeader from './FocusDockHeader';
import FocusTaskMiniCard from './FocusTaskMiniCard';
import PomodoroTimer from './PomodoroTimer';

interface FocusDockProps {
  focusTasks: FocusTask[];
  showWhenEmpty?: boolean;
  activeTaskId: string | null;
  isCollapsed: boolean;
  timerState: PomodoroTimerState;
  timerSettings: PomodoroTimerSettings;
  dailyFocusStats: DailyFocusStats;
  remainingSeconds: number;
  onCollapseChange: (isCollapsed: boolean) => void;
  onActiveTaskChange: (taskId: string) => void;
  onModeChange: (mode: PomodoroMode) => void;
  onTimerSettingsChange: (patch: Partial<PomodoroTimerSettings>) => void;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onResetTimer: () => void;
  onPopOutTimer: () => void;
  onOpenShutdown: () => void;
  onOpenTask: (task: FocusTask) => void;
  onMarkDone: (task: FocusTask) => void;
  onRemoveTask: (taskId: string) => void;
  isPictureInPictureSupported: boolean;
  isPictureInPictureOpen: boolean;
}

function FocusDock({
  focusTasks,
  showWhenEmpty = false,
  activeTaskId,
  isCollapsed,
  timerState,
  timerSettings,
  dailyFocusStats,
  remainingSeconds,
  onCollapseChange,
  onActiveTaskChange,
  onModeChange,
  onTimerSettingsChange,
  onStartTimer,
  onPauseTimer,
  onResetTimer,
  onPopOutTimer,
  onOpenShutdown,
  onOpenTask,
  onMarkDone,
  onRemoveTask,
  isPictureInPictureSupported,
  isPictureInPictureOpen,
}: FocusDockProps) {
  const shouldReduceMotion = useReducedMotion();
  const { t } = useI18n();
  const { ref: islandRef, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onKeyDown } = useIslandPosition(focusTasks.length > 0);
  const activeTask = focusTasks.find((task) => task.id === (timerState.activeTaskId || activeTaskId)) || focusTasks[0];
  const cycle = Math.min((timerState.completedCycleFocus || 0) + 1, timerSettings.longBreakEvery);

  if (focusTasks.length === 0 && !showWhenEmpty) {
    return null;
  }

  return (
    <div ref={islandRef} className="focus-island">
      <div className="island-bar island-glass" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
        <button type="button" data-drag-handle className="island-grip" onKeyDown={onKeyDown} aria-label={t('focus.island.move')} title={t('focus.island.move')}>
          <svg viewBox="0 0 16 24" aria-hidden="true" fill="currentColor"><circle cx="5" cy="6" r="1.3" /><circle cx="11" cy="6" r="1.3" /><circle cx="5" cy="12" r="1.3" /><circle cx="11" cy="12" r="1.3" /><circle cx="5" cy="18" r="1.3" /><circle cx="11" cy="18" r="1.3" /></svg>
        </button>
        <span className={`island-live ${timerState.isRunning ? 'is-running' : ''}`} aria-hidden="true" />
        <button type="button" className="island-task" onClick={() => onCollapseChange(!isCollapsed)} aria-expanded={!isCollapsed} aria-label={isCollapsed ? t('focus.dock.expand') : t('focus.dock.minimizeLabel')} title={activeTask?.title}>
          {activeTask?.title || t('focus.dock.title')}
        </button>
        <span className="island-cycle" title={t('focus.timer.cycleProgress', { current: cycle, total: timerSettings.longBreakEvery })}>{cycle}/{timerSettings.longBreakEvery}</span>
        <button type="button" className="island-time" aria-label={t('focus.timer.settings')}
          onClick={() => onCollapseChange(false)}>{formatPomodoroTime(remainingSeconds)}</button>
        <span className="island-divider" aria-hidden="true" />
        <button type="button" className="island-icon island-icon-solid" onClick={timerState.isRunning ? onPauseTimer : onStartTimer} aria-label={timerState.isRunning ? t('focus.timer.pause') : t('focus.timer.start')}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{timerState.isRunning ? <path d="M7 5h4v14H7zm6 0h4v14h-4z" /> : <path d="m8 5 11 7-11 7z" />}</svg>
        </button>
        <button type="button" className="island-icon" onClick={onPopOutTimer} disabled={!isPictureInPictureSupported} aria-label={t('dock.widget')} title={t('dock.widget')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><rect x="11" y="11" width="8" height="7" rx="1" /></svg>
        </button>
      </div>
      {!isCollapsed && (
          <motion.aside
            key="focus-dock-panel"
            className="island-details island-glass"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 25 }}
            aria-label={t('focus.dock.title')}
          >
            <FocusDockHeader
              taskCount={focusTasks.length}
              onCollapse={() => onCollapseChange(true)}
              onOpenShutdown={onOpenShutdown}
            />

            <div className="mt-4 space-y-3">
              {focusTasks.map((focusTask) => (
                <FocusTaskMiniCard
                  key={focusTask.id}
                  task={focusTask}
                  isActive={focusTask.id === activeTaskId}
                  onActivate={onActiveTaskChange}
                  onOpenTask={onOpenTask}
                  onMarkDone={onMarkDone}
                  onRemove={onRemoveTask}
                />
              ))}
            </div>

            <div className="mt-4">
              <PomodoroTimer
                focusTasks={focusTasks}
                activeTaskId={activeTaskId}
                timerState={timerState}
                timerSettings={timerSettings}
                dailyFocusStats={dailyFocusStats}
                remainingSeconds={remainingSeconds}
                onActiveTaskChange={onActiveTaskChange}
                onModeChange={onModeChange}
                onTimerSettingsChange={onTimerSettingsChange}
                onStart={onStartTimer}
                onPause={onPauseTimer}
                onReset={onResetTimer}
                onPopOutTimer={onPopOutTimer}
                canPopOutTimer={isPictureInPictureSupported}
                isPictureInPictureSupported={isPictureInPictureSupported}
                isPictureInPictureOpen={isPictureInPictureOpen}
              />
            </div>
          </motion.aside>
        )}
    </div>
  );
}

export default FocusDock;
