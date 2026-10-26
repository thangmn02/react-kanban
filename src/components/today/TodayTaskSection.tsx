import type { TodayTaskSummary } from '../../services/today.service';
import SectionCard from '../atoms/SectionCard';
import EmptyState from '../atoms/EmptyState';
import TodayTaskCard from './TodayTaskCard';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { uiSpring } from '../../shared/motion';

interface TodayTaskSectionProps {
  title: string;
  description: string;
  tasks: TodayTaskSummary[];
  emptyMessage: string;
  isFocusTask: (taskId: string) => boolean;
  onOpenTask: (task: TodayTaskSummary) => void;
  onStartFocus: (task: TodayTaskSummary) => void;
  onToggleTodayFocus: (task: TodayTaskSummary) => void;
  compactShell?: boolean;
  onCompleteTask?: (task: TodayTaskSummary) => void;
  completingIds?: ReadonlySet<string>;
}

export default function TodayTaskSection({
  title,
  description,
  tasks,
  emptyMessage,
  isFocusTask,
  onOpenTask,
  onStartFocus,
  onToggleTodayFocus,
  compactShell = false,
  onCompleteTask,
  completingIds,
}: TodayTaskSectionProps) {
  const reduced = useReducedMotion();
  const content = (
    <>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-600">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <EmptyState title={emptyMessage} compact />
      ) : (
        <div className="grid gap-3">
          <AnimatePresence initial={false}>{tasks.map((task) => (
            <motion.div key={task.id} layout={reduced ? false : 'position'} exit={reduced ? { opacity: 0 } : { opacity: 0, x: 8 }} transition={reduced ? { duration: 0 } : uiSpring}>
            <TodayTaskCard
              key={task.id}
              task={task}
              isFocusTask={isFocusTask(task.id)}
              onOpenTask={onOpenTask}
              onStartFocus={onStartFocus}
              onToggleTodayFocus={onToggleTodayFocus}
              onCompleteTask={onCompleteTask}
              isCompleting={completingIds?.has(task.id)}
            />
            </motion.div>
          ))}</AnimatePresence>
        </div>
      )}
    </>
  );

  if (compactShell) {
    return <div data-task-section tabIndex={-1}>{content}</div>;
  }

  return (
    <div data-task-section tabIndex={-1}><SectionCard className="p-5">
      {content}
    </SectionCard></div>
  );
}
