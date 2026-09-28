import { format, parseISO } from 'date-fns';
import { enUS, vi } from 'date-fns/locale';

import { useI18n } from '../../../i18n';
import type { HomeTaskSummary } from '../../../services/home.service';
import { rankTasksForDay, type RankedDayTask } from '../utils/rankTasksForDay';

interface Props {
  tasks: HomeTaskSummary[];
  onClose: () => void;
  onStart: (task: HomeTaskSummary) => void;
  onAddTopThree: (tasks: HomeTaskSummary[]) => void;
}

export default function PlanMyDayDialog({ tasks, onClose, onStart, onAddTopThree }: Props) {
  const { t, language } = useI18n();
  const ranked = rankTasksForDay(tasks).slice(0, 5);
  const locale = language === 'vi' ? vi : enUS;
  const reason = (item: RankedDayTask) => {
    if (item.reason === 'overdue') return t('planDay.reason.overdue', { count: item.daysOverdue });
    if (item.reason === 'today') return t('planDay.reason.today');
    if (item.reason === 'tomorrow') return t('planDay.reason.tomorrow');
    if (item.reason === 'week' && item.task.dueDate) return t('planDay.reason.week', { day: format(parseISO(item.task.dueDate), 'EEEE', { locale }) });
    return t('planDay.reason.noDate');
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/35 px-4 py-8 backdrop-blur-sm" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="plan-day-title" onClick={(event) => event.stopPropagation()} className="mx-auto w-full max-w-2xl rounded-[1.75rem] border border-white/70 bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-600">{t('planDay.eyebrow')}</p><h2 id="plan-day-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{t('planDay.title')}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{t('planDay.description')}</p></div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="h-10 w-10 cursor-pointer rounded-full text-xl text-slate-400 hover:bg-slate-100">×</button>
        </div>
        <ol className="mt-6 space-y-3">
          {ranked.map((item, index) => <li key={item.task.id} className={`flex items-center gap-4 rounded-2xl border p-4 ${index === 0 ? 'border-sky-200 bg-sky-50/70' : 'border-slate-200'}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${index === 0 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{item.task.title}</p><p className="mt-1 text-xs text-slate-500">{reason(item)}</p></div>{index === 0 && <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-700 shadow-sm">{t('planDay.first')}</span>}</li>)}
        </ol>
        {ranked.length === 0 ? <p className="mt-8 rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">{t('planDay.empty')}</p> : <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => { onAddTopThree(ranked.slice(0, 3).map(({ task }) => task)); onClose(); }} className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">{t('planDay.addTopThree')}</button><button type="button" onClick={() => { onStart(ranked[0].task); onClose(); }} className="cursor-pointer rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-700">{t('planDay.start')}</button></div>}
      </section>
    </div>
  );
}
