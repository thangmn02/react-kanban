import { isPast, isToday, parseISO, startOfDay } from 'date-fns';

import type { HomeTaskSummary } from '../../services/home.service';
import Typography from '../atoms/Typography';

interface MyTasksSummaryProps {
  tasks: HomeTaskSummary[];
}

function countTasksDueToday(tasks: HomeTaskSummary[]) {
  return tasks.filter((task) => task.dueDate && isToday(parseISO(task.dueDate))).length;
}

function countOverdueTasks(tasks: HomeTaskSummary[]) {
  return tasks.filter((task) => {
    if (!task.dueDate) {
      return false;
    }

    const dueDate = startOfDay(parseISO(task.dueDate));
    return isPast(dueDate) && !isToday(dueDate);
  }).length;
}

export default function MyTasksSummary({ tasks }: MyTasksSummaryProps) {
  const dueTodayCount = countTasksDueToday(tasks);
  const overdueCount = countOverdueTasks(tasks);
  const noDateCount = tasks.filter((task) => !task.dueDate).length;

  return (
    <div className="grid gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-3">
      <div className="rounded-2xl bg-amber-50 px-4 py-3">
        <Typography component="p" content="Due today" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-600" />
        <Typography component="p" content={String(dueTodayCount)} className="mt-1 text-2xl font-semibold text-amber-900" />
      </div>
      <div className="rounded-2xl bg-rose-50 px-4 py-3">
        <Typography component="p" content="Overdue" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-600" />
        <Typography component="p" content={String(overdueCount)} className="mt-1 text-2xl font-semibold text-rose-900" />
      </div>
      <div className="rounded-2xl bg-slate-50 px-4 py-3">
        <Typography component="p" content="No date" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500" />
        <Typography component="p" content={String(noDateCount)} className="mt-1 text-2xl font-semibold text-slate-900" />
      </div>
    </div>
  );
}
