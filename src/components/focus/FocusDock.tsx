import { AnimatePresence, motion } from 'framer-motion';

import type { FocusTask, PomodoroMode, PomodoroTimerState } from '../../types/focus.type';
import { formatPomodoroTime } from '../../utils/pomodoroTime';
import FocusDockHeader from './FocusDockHeader';
import FocusTaskMiniCard from './FocusTaskMiniCard';
import PomodoroTimer from './PomodoroTimer';

interface FocusDockProps {
  focusTasks: FocusTask[];
  activeTaskId: string | null;
  isCollapsed: boolean;
  timerState: PomodoroTimerState;
  remainingSeconds: number;
  onCollapseChange: (isCollapsed: boolean) => void;
  onActiveTaskChange: (taskId: string) => void;
  onModeChange: (mode: PomodoroMode) => void;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onResetTimer: () => void;
  onOpenTask: (task: FocusTask) => void;
  onMarkDone: (task: FocusTask) => void;
  onRemoveTask: (taskId: string) => void;
}

function FocusDock({
  focusTasks,
  activeTaskId,
  isCollapsed,
  timerState,
  remainingSeconds,
  onCollapseChange,
  onActiveTaskChange,
  onModeChange,
  onStartTimer,
  onPauseTimer,
  onResetTimer,
  onOpenTask,
  onMarkDone,
  onRemoveTask,
}: FocusDockProps) {
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
            className="rounded-full border border-white/80 bg-slate-950/92 px-4 py-3 text-sm font-semibold text-white shadow-[0_20px_60px_rgba(15,23,42,0.25)] backdrop-blur-xl transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-sky-200 active:scale-[0.98]"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            aria-label="Expand Focus Dock"
          >
            {focusTasks.length} focus task{focusTasks.length === 1 ? '' : 's'} · {formatPomodoroTime(remainingSeconds)}
          </motion.button>
        ) : (
          <motion.aside
            key="focus-dock-panel"
            className="w-[min(420px,calc(100vw-2.5rem))] rounded-[2rem] border border-white/80 bg-white/82 p-4 shadow-[0_28px_90px_rgba(15,23,42,0.20)] ring-1 ring-slate-900/[0.04] backdrop-blur-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 240, damping: 25 }}
            aria-label="Focus Dock"
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
                remainingSeconds={remainingSeconds}
                onActiveTaskChange={onActiveTaskChange}
                onModeChange={onModeChange}
                onStart={onStartTimer}
                onPause={onPauseTimer}
                onReset={onResetTimer}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FocusDock;
