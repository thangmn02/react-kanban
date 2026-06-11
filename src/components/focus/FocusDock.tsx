import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import type { DailyFocusStats, FocusTask, PomodoroMode, PomodoroTimerState } from '../../types/focus.type';
import { formatPomodoroTime } from '../../utils/pomodoroTime';
import { useI18n } from '../../i18n';
import FocusDockHeader from './FocusDockHeader';
import FocusTaskMiniCard from './FocusTaskMiniCard';
import PomodoroTimer from './PomodoroTimer';

interface FocusDockProps {
  focusTasks: FocusTask[];
  activeTaskId: string | null;
  isCollapsed: boolean;
  timerState: PomodoroTimerState;
  dailyFocusStats: DailyFocusStats;
  remainingSeconds: number;
  onCollapseChange: (isCollapsed: boolean) => void;
  onActiveTaskChange: (taskId: string) => void;
  onModeChange: (mode: PomodoroMode) => void;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onResetTimer: () => void;
  onPopOutTimer: () => void;
  onOpenTask: (task: FocusTask) => void;
  onMarkDone: (task: FocusTask) => void;
  onRemoveTask: (taskId: string) => void;
  isPictureInPictureSupported: boolean;
  isPictureInPictureOpen: boolean;
}

function FocusDock({
  focusTasks,
  activeTaskId,
  isCollapsed,
  timerState,
  dailyFocusStats,
  remainingSeconds,
  onCollapseChange,
  onActiveTaskChange,
  onModeChange,
  onStartTimer,
  onPauseTimer,
  onResetTimer,
  onPopOutTimer,
  onOpenTask,
  onMarkDone,
  onRemoveTask,
  isPictureInPictureSupported,
  isPictureInPictureOpen,
}: FocusDockProps) {
  const shouldReduceMotion = useReducedMotion();
  const { t } = useI18n();

  if (focusTasks.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 max-w-[calc(100vw-2.5rem)]">
      <AnimatePresence mode="wait">
        {isCollapsed ? (
          <motion.button
            key="focus-dock-pill"
            type="button"
            onClick={() => onCollapseChange(false)}
            className="cursor-pointer rounded-full border border-white/60 bg-slate-900/90 px-4 py-3 text-sm font-semibold text-white shadow-focus-surface backdrop-blur-md transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 active:scale-[0.98]"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 24 }}
            aria-label={t('focus.dock.expand')}
          >
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
              {t('focus.dock.taskCount', { count: focusTasks.length, plural: focusTasks.length === 1 ? '' : 's' })} · <span className="tabular-nums">{formatPomodoroTime(remainingSeconds)}</span>
            </span>
          </motion.button>
        ) : (
          <motion.aside
            key="focus-dock-panel"
            className="w-[min(420px,calc(100vw-2.5rem))] rounded-3xl border border-white/60 bg-slate-900/90 p-4 shadow-focus-surface backdrop-blur-md"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 25 }}
            aria-label={t('focus.dock.title')}
          >
            <FocusDockHeader taskCount={focusTasks.length} onCollapse={() => onCollapseChange(true)} />

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
                dailyFocusStats={dailyFocusStats}
                remainingSeconds={remainingSeconds}
                onActiveTaskChange={onActiveTaskChange}
                onModeChange={onModeChange}
                onStart={onStartTimer}
                onPause={onPauseTimer}
                onReset={onResetTimer}
                onPopOutTimer={onPopOutTimer}
                canPopOutTimer={focusTasks.length > 0 || Boolean(timerState.activeTaskId)}
                isPictureInPictureSupported={isPictureInPictureSupported}
                isPictureInPictureOpen={isPictureInPictureOpen}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FocusDock;
