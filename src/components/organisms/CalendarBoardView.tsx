import { useMemo, useState } from 'react';
import { addDays, addMonths, differenceInCalendarDays, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, parseISO, startOfDay, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { enUS, vi } from 'date-fns/locale';

import type { BoardData, ITaskItem } from '../../types/task.type';
import { doesTaskMatchFilters } from '../../utils/taskFilters';
import { statusColor, taskStatusDotClass, type TaskStatusColor } from '../../utils/taskStatus';
import { useI18n } from '../../i18n';

interface CalendarBoardViewProps {
  boardData: BoardData;
  searchQuery: string;
  filterPriority: string;
  filterAssignee: string;
  filterDueDate: string;
  onOpenTask: (task: ITaskItem) => void;
}

interface ScheduledTask { task: ITaskItem; color: TaskStatusColor }

function CalendarBoardView({ boardData, searchQuery, filterPriority, filterAssignee, filterDueDate, onOpenTask }: CalendarBoardViewProps) {
  const { language, t } = useI18n();
  const locale = language === 'vi' ? vi : enUS;
  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const finalActiveColumnId = boardData.columns.at(-2);

  const taskColumnById = useMemo(() => {
    const mapping = new Map<string, string>();
    boardData.columns.forEach((columnId) => boardData.list[columnId]?.tasks.forEach((taskId) => mapping.set(taskId, columnId)));
    return mapping;
  }, [boardData.columns, boardData.list]);

  const tasksByDueDate = useMemo(() => {
    const groups = new Map<string, ScheduledTask[]>();
    Object.values(boardData.task)
      .filter((task): task is ITaskItem => Boolean(task?.dueDate))
      .filter((task) => doesTaskMatchFilters(task, { searchQuery, filterPriority, filterAssignee, filterDueDate }))
      .sort((first, second) => first.title.localeCompare(second.title))
      .forEach((task) => {
        const dueDate = task.dueDate;
        if (!dueDate) return;
        const tasks = groups.get(dueDate) || [];
        tasks.push({ task, color: statusColor(task, taskColumnById.get(task.id) === finalActiveColumnId) });
        groups.set(dueDate, tasks);
      });
    return groups;
  }, [boardData.task, filterAssignee, filterDueDate, filterPriority, finalActiveColumnId, searchQuery, taskColumnById]);

  const calendarDays = useMemo(() => {
    const firstVisibleDay = startOfWeek(startOfMonth(activeMonth), { weekStartsOn: 1 });
    const lastVisibleDay = endOfWeek(endOfMonth(activeMonth), { weekStartsOn: 1 });
    const days: Date[] = [];
    for (let day = firstVisibleDay; day <= lastVisibleDay; day = addDays(day, 1)) days.push(day);
    return days;
  }, [activeMonth]);

  const selectedTasks = tasksByDueDate.get(format(selectedDay, 'yyyy-MM-dd')) || [];
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => format(addDays(new Date(2026, 0, 5), index), 'EEEEE', { locale }));

  const chooseMonth = (month: Date) => {
    const firstDay = startOfMonth(month);
    setActiveMonth(firstDay);
    setSelectedDay(firstDay);
  };

  const dueLabel = (task: ITaskItem) => {
    if (!task.dueDate) return '';
    const difference = differenceInCalendarDays(startOfDay(parseISO(task.dueDate)), startOfDay(new Date()));
    if (difference < 0) return t('calendar.overdue', { count: Math.abs(difference) });
    if (difference === 0) return t('calendar.dueToday');
    if (difference === 1) return t('calendar.dueTomorrow');
    return format(parseISO(task.dueDate), 'd MMM', { locale });
  };

  return (
    <main className="px-4 pb-8 pt-2 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <section className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-label={t('calendar.title')}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">{t('calendar.lazyBadge')}</span>
              <h2 className="mt-3 text-xl font-bold tracking-[-0.03em] text-slate-950">{format(activeMonth, 'LLLL yyyy', { locale })}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => chooseMonth(subMonths(activeMonth, 1))} aria-label={t('calendar.previousMonth')} className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-xl text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100">‹</button>
              <button type="button" onClick={() => chooseMonth(new Date())} className="cursor-pointer rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 transition hover:bg-sky-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100">{t('calendar.today')}</button>
              <button type="button" onClick={() => chooseMonth(addMonths(activeMonth, 1))} aria-label={t('calendar.nextMonth')} className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-xl text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100">›</button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {weekdayLabels.map((label, index) => <div key={`${label}-${index}`} className="py-2 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:text-xs">{label}</div>)}
            {calendarDays.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const tasks = tasksByDueDate.get(key) || [];
              const outsideMonth = !isSameMonth(day, activeMonth);
              const selected = isSameDay(day, selectedDay);
              return (
                <button key={key} type="button" onClick={() => setSelectedDay(day)} aria-label={format(day, 'PPPP', { locale })} aria-pressed={selected} className={`group flex aspect-square min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 sm:rounded-2xl sm:text-sm ${selected ? 'border-sky-500' : 'border-transparent hover:bg-slate-50'} ${isToday(day) ? 'bg-slate-950 text-white hover:bg-slate-800' : outsideMonth ? 'text-slate-300' : 'text-slate-700'}`}>
                  <span>{format(day, 'd')}</span>
                  <span className="flex h-2 items-center gap-1" aria-label={tasks.length > 0 ? t('calendar.taskCount', { count: tasks.length }) : undefined}>
                    {tasks.slice(0, 3).map(({ task, color }) => <span key={task.id} className={`h-1.5 w-1.5 rounded-full ${taskStatusDotClass[color]}`} />)}
                    {tasks.length > 3 && <span className={`text-[9px] font-bold ${isToday(day) ? 'text-slate-200' : 'text-slate-400'}`}>+{tasks.length - 3}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="self-start rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-600">{isToday(selectedDay) ? t('calendar.today') : t('calendar.selectedDay')}</p>
          <h3 className="mt-1 text-lg font-bold tracking-[-0.02em] text-slate-950">{format(selectedDay, 'EEEE, d MMMM', { locale })}</h3>
          <p className="mt-1 text-sm text-slate-500">{t('calendar.taskCount', { count: selectedTasks.length })}</p>
          <div className="mt-5 divide-y divide-slate-100">
            {selectedTasks.map(({ task, color }) => (
              <button key={task.id} type="button" onClick={() => onOpenTask(task)} className="group flex w-full cursor-pointer items-center gap-3 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${taskStatusDotClass[color]}`} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 transition group-hover:text-sky-700">{task.title}</span>
                <span className="shrink-0 text-xs font-medium text-slate-500">{dueLabel(task)}</span>
              </button>
            ))}
          </div>
          {selectedTasks.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg text-slate-300 shadow-sm">✓</div>
              <p className="text-sm font-semibold text-slate-500">{t('calendar.emptyTitle')}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{t('calendar.emptyDescription')}</p>
            </div>
          )}
          <div className="mt-6 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-400">{t('calendar.helper')}</div>
        </aside>
      </div>
    </main>
  );
}

export default CalendarBoardView;
