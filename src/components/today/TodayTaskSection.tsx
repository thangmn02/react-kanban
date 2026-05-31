import type { TodayTaskSummary } from '../../services/today.service';
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
    <section className="rounded-[2rem] border border-white/80 bg-white/72 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
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
        <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
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
    </section>
  );
}
