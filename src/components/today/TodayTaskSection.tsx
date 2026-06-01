import type { TodayTaskSummary } from '../../services/today.service';
import SectionCard from '../atoms/SectionCard';
import EmptyState from '../atoms/EmptyState';
import TodayTaskCard from './TodayTaskCard';

interface TodayTaskSectionProps {
  title: string;
  description: string;
  tasks: TodayTaskSummary[];
  emptyMessage: string;
  isFocusTask: (taskId: string) => boolean;
  onOpenTask: (task: TodayTaskSummary) => void;
  onStartFocus: (task: TodayTaskSummary) => void;
  onToggleTodayFocus: (task: TodayTaskSummary) => void;
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
}: TodayTaskSectionProps) {
  return (
    <SectionCard className="p-5">
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
          {tasks.map((task) => (
            <TodayTaskCard
              key={task.id}
              task={task}
              isFocusTask={isFocusTask(task.id)}
              onOpenTask={onOpenTask}
              onStartFocus={onStartFocus}
              onToggleTodayFocus={onToggleTodayFocus}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}
