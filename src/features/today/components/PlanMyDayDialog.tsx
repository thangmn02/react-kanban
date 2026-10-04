import { useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { enUS, vi } from 'date-fns/locale';
import { useI18n } from '../../../i18n';
import type { HomeTaskSummary } from '../../../services/home.service';
import { appendPlannedSteps, generateTaskBreakdown } from '../../../services/taskBreakdown.service';
import { rankTasksForDay, type RankedDayTask } from '../utils/rankTasksForDay';
import TaskBreakdownEditor from './TaskBreakdownEditor';

interface Props {
  tasks: HomeTaskSummary[];
  workspaceId?: string | null;
  onClose: () => void;
  onStart: (task: HomeTaskSummary, nextStep?: string) => void;
  onAddTopThree: (tasks: HomeTaskSummary[]) => void;
  onCreateTask?: () => void;
}

export default function PlanMyDayDialog({ tasks, workspaceId, onClose, onStart, onAddTopThree, onCreateTask }: Props) {
  const { t, language } = useI18n();
  const [order, setOrder] = useState(() => rankTasksForDay(tasks).slice(0, 5).map(({ task }) => task.id));
  const [selectedId, setSelectedId] = useState(order[0]);
  const dialog = useRef<HTMLElement>(null);
  const rankedById = new Map(rankTasksForDay(tasks).map((item) => [item.task.id, item]));
  const ranked = order.flatMap((id) => rankedById.has(id) ? [rankedById.get(id)!] : []);
  const selected = ranked.find(({ task }) => task.id === selectedId)?.task ?? ranked[0]?.task;
  const locale = language === 'vi' ? vi : enUS;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled)') ?? []);
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [onClose]);
  const reason = (item: RankedDayTask) => {
    if (item.reason === 'overdue') return t('planDay.reason.overdue', { count: item.daysOverdue });
    if (item.reason === 'today') return t('planDay.reason.today');
    if (item.reason === 'tomorrow') return t('planDay.reason.tomorrow');
    if (item.reason === 'week' && item.task.dueDate) return t('planDay.reason.week', { day: format(parseISO(item.task.dueDate), 'EEEE', { locale }) });
    return t('planDay.reason.noDate');
  };
  const move = (id: string, direction: number) => setOrder((current) => {
    const next = [...current]; const index = next.indexOf(id); const targetId = ranked[ranked.findIndex((item) => item.task.id === id) + direction]?.task.id;
    const target = next.indexOf(targetId ?? '');
    if (target >= 0) [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-stone-950/40 px-3 py-6 backdrop-blur-sm sm:px-6 sm:py-12" onClick={onClose}>
      <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="plan-day-title" onClick={(event) => event.stopPropagation()} className="mx-auto w-full max-w-4xl rounded-2xl border border-white/80 bg-[#fafaf8] p-5 shadow-2xl outline-none sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 id="plan-day-title" className="text-3xl font-bold tracking-tight text-stone-950">{t('planDay.title')}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="h-10 w-10 shrink-0 cursor-pointer rounded-full text-xl text-stone-400 hover:bg-stone-200">×</button>
        </div>
        <div className="mt-7 grid gap-7 md:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-[0.18em] text-stone-600">{t('aiPlan.yourPlan')}</h3><span className="rounded-full bg-stone-200/60 px-2.5 py-1 text-xs font-semibold text-stone-500">{Math.min(3, ranked.length)}/3</span></div>
            <ol className="border-t border-stone-900">
              {ranked.map((item, index) => <li key={item.task.id} className={`flex items-center gap-3 border-b border-stone-200 py-4 ${selected?.id === item.task.id ? 'bg-stone-100/60' : ''}`}>
                <span className="pl-2 text-sm font-bold tabular-nums text-amber-800">{String(index + 1).padStart(2, '0')}</span>
                <button type="button" aria-pressed={selected?.id === item.task.id} className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => setSelectedId(item.task.id)}><p className="break-words text-sm font-bold leading-6 text-stone-900">{item.task.title}</p><p className="mt-1 text-xs text-stone-500">{reason(item)}</p></button>
                <div className="flex flex-col text-stone-400"><button type="button" disabled={index === 0} aria-label={t('aiPlan.moveUp', { count: index + 1 })} onClick={() => move(item.task.id, -1)} className="px-2 hover:text-stone-950 disabled:opacity-20">↑</button><button type="button" disabled={index === ranked.length - 1} aria-label={t('aiPlan.moveDown', { count: index + 1 })} onClick={() => move(item.task.id, 1)} className="px-2 hover:text-stone-950 disabled:opacity-20">↓</button></div>
                <button type="button" aria-label={t('aiPlan.removeTask', { title: item.task.title })} className="pr-2 text-lg text-stone-300 hover:text-stone-900" onClick={() => setOrder((current) => current.filter((id) => id !== item.task.id))}>×</button>
              </li>)}
            </ol>
            {!ranked.length && <p className="py-8 text-sm text-stone-500">{t('planDay.empty')}</p>}
            {onCreateTask && <button type="button" className="mt-4 cursor-pointer text-sm font-semibold text-stone-500 hover:text-stone-950" onClick={() => { onClose(); onCreateTask(); }}>+ {t('aiPlan.newMission')}</button>}
            {!!ranked.length && <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => { onAddTopThree(ranked.slice(0, 3).map(({ task }) => task)); onClose(); }} className="cursor-pointer rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-stone-900/10 hover:bg-stone-800">{t('planDay.addTopThree')} <span aria-hidden="true">→</span></button><button type="button" onClick={() => { onStart(ranked[0].task); onClose(); }} className="cursor-pointer py-3 text-sm font-semibold text-stone-500 hover:text-stone-950">{t('planDay.start')}</button></div>}
          </div>
          {selected && <div>
            <div className="mb-3 rounded-xl bg-stone-950 p-5 text-white"><p style={{ color: '#fcd34d' }} className="text-[10px] font-bold uppercase tracking-[0.2em]">{t('aiPlan.mission')}</p><h3 style={{ color: '#ffffff' }} className="mt-2 break-words text-xl font-bold tracking-tight">{selected.title}</h3><p style={{ color: '#a8a29e' }} className="mt-2 text-xs">{selected.boardTitle}</p></div>
            <TaskBreakdownEditor key={`${selected.id}:${workspaceId}:${language}`} disabled={!workspaceId}
              onGenerate={(signal) => generateTaskBreakdown({ taskId: selected.id, boardId: selected.boardId, workspaceId: workspaceId!, language }, signal)}
              onApply={(items) => appendPlannedSteps(selected.id, selected.boardId, workspaceId!, items)}
              onStart={(firstStep) => { onStart(selected, firstStep); onClose(); }} />
          </div>}
        </div>
      </section>
    </div>
  );
}
