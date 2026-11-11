import { useId, useState, type ReactNode } from 'react';
import type { OwnDeadline, WaitingOn } from '../../features/today/task-followups';
import type { TodayTaskSummary } from '../../services/today.service';
import { getPriorityBadgeClass } from '../../utils/taskMetadata';
import DueDateBadge from '../atoms/DueDateBadge';
import { useI18n } from '../../i18n';
import { stripTaskHtml } from '../../utils/taskCollections';

interface TodayTaskCardProps {
  task: TodayTaskSummary;
  isFocusTask: boolean;
  onOpenTask: (task: TodayTaskSummary) => void;
  onStartFocus: (task: TodayTaskSummary) => void;
  onToggleTodayFocus: (task: TodayTaskSummary) => void;
  onCompleteTask?: (task: TodayTaskSummary) => void;
  isCompleting?: boolean;
  /** Extra context shown inside the card, e.g. why a task is suggested. */
  reasons?: ReactNode;
  /** Overdue tasks only: move the date to tomorrow, or drop it. */
  onReschedule?: (task: TodayTaskSummary, to: 'tomorrow' | 'none') => void;
  isRescheduling?: boolean;
  waiting?: WaitingOn;
  /** True once the follow-up day has arrived. */
  followUpDue?: boolean;
  onWait?: (task: TodayTaskSummary, who: string, followUpOn: string) => void;
  onStopWaiting?: (task: TodayTaskSummary) => void;
  /** A personal deadline ahead of the real due date. */
  ownDeadline?: OwnDeadline;
  ownDeadlineDue?: boolean;
  /** An empty day clears it. */
  onSetOwnDeadline?: (task: TodayTaskSummary, on: string) => void;
}

const dayFromNow = (days: number) => {
  const date = new Date(); date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function TodayTaskCard({
  task,
  isFocusTask,
  onOpenTask,
  onStartFocus,
  onToggleTodayFocus,
  onCompleteTask,
  isCompleting = false,
  reasons,
  onReschedule,
  isRescheduling = false,
  waiting,
  followUpDue = false,
  onWait,
  onStopWaiting,
  ownDeadline,
  ownDeadlineDue = false,
  onSetOwnDeadline,
}: TodayTaskCardProps) {
  const priorityClassName = getPriorityBadgeClass(task.priority || undefined);
  const { t } = useI18n();
  const formId = useId();
  const [waitOpen, setWaitOpen] = useState(false), [who, setWho] = useState(''), [followUpOn, setFollowUpOn] = useState(() => dayFromNow(3));
  const [aimOpen, setAimOpen] = useState(false), [aimOn, setAimOn] = useState(ownDeadline?.on ?? '');
  const realDue = task.dueDate ? task.dueDate.slice(0, 10) : '';
  // The latest useful personal deadline is the day before the real one.
  const dayBeforeDue = (() => { if (!realDue) return ''; const date = new Date(`${realDue}T12:00:00`); date.setDate(date.getDate() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; })();
  const canAim = Boolean(!task.isDone && onSetOwnDeadline && realDue && dayBeforeDue >= dayFromNow(0));
  const quiet = 'min-h-11 cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-50';
  const preview = stripTaskHtml(task.description);

  return (
    <article aria-busy={isCompleting} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card transition-colors hover:border-slate-300">
      <button
        type="button"
        onClick={() => onOpenTask(task)}
        aria-label={task.title}
        className="block w-full cursor-pointer text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold tracking-[-0.01em] text-slate-950">
              {task.title}
            </h3>
            <p className="mt-1 truncate text-xs text-slate-500">
              {task.boardTitle} - {task.listTitle}
            </p>
          </div>
          {task.assigneeAvatar && (
            <img
              src={task.assigneeAvatar}
              alt=""
              className="h-8 w-8 rounded-full border-2 border-white object-cover shadow-sm"
            />
          )}
        </div>

        {preview && (
          <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
            {preview}
          </p>
        )}
      </button>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {task.isDone ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase text-emerald-700"
            aria-label={t('today.taskCompleted')}
          >
            <svg className="h-3.5 w-3.5 shrink-0" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {t('today.taskCompleted')}
          </span>
        ) : (
          <>
            {task.priority && priorityClassName ? (
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${priorityClassName}`}>
                {task.priority}
              </span>
            ) : (
              <span className="rounded-full border border-dashed border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-400">
                {t('common.noPriority')}
              </span>
            )}
            <DueDateBadge dueDate={task.dueDate || undefined} />
          </>
        )}
        {reasons}
        {ownDeadline && !task.isDone && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ownDeadlineDue ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
          {ownDeadlineDue ? t('today.own.due') : t('today.own.badge', { date: ownDeadline.on })}
        </span>}
        {waiting && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${followUpDue ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
          {followUpDue ? t('today.waiting.followUpNow', { who: waiting.who || t('today.waiting.someone') }) : t('today.waiting.until', { who: waiting.who || t('today.waiting.someone'), date: waiting.followUpOn })}
        </span>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!task.isDone && (
          <button
            type="button"
            onClick={() => onStartFocus(task)}
            className="cursor-pointer rounded-2xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 active:scale-[0.98]"
            aria-label={`${t('task.startFocus')}: ${task.title}`}
          >
            {t('today.startFocus')}
          </button>
        )}
        {!task.isDone && onCompleteTask && <button type="button" disabled={isCompleting} onClick={() => onCompleteTask(task)}
          aria-label={`${t('common.markDone')}: ${task.title}`}
          className="min-h-11 cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-50">
          {t(isCompleting ? 'ux.completing' : 'common.markDone')}
        </button>}
        <button
          type="button"
          onClick={() => onToggleTodayFocus(task)}
          className={`cursor-pointer rounded-2xl border px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 active:scale-[0.98] ${
            isFocusTask
              ? 'border-sky-200 bg-sky-50 text-sky-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
          aria-pressed={isFocusTask}
          aria-label={`${isFocusTask ? t('today.removeFromToday') : t('today.planToday')}: ${task.title}`}
        >
          {isFocusTask ? t('today.removeFromToday') : t('today.planToday')}
        </button>
        {!task.isDone && onReschedule && <>
          <button type="button" disabled={isRescheduling} className={quiet} aria-label={`${t('today.overdue.tomorrow')}: ${task.title}`} onClick={() => onReschedule(task, 'tomorrow')}>{t('today.overdue.tomorrow')}</button>
          <button type="button" disabled={isRescheduling} className={quiet} aria-label={`${t('today.overdue.noDate')}: ${task.title}`} onClick={() => onReschedule(task, 'none')}>{t('today.overdue.noDate')}</button>
        </>}
        {!task.isDone && waiting && onStopWaiting && <button type="button" className={quiet} aria-label={`${t('today.waiting.stop')}: ${task.title}`} onClick={() => onStopWaiting(task)}>{t('today.waiting.stop')}</button>}
        {!task.isDone && !waiting && onWait && <button type="button" className={quiet} aria-expanded={waitOpen} aria-controls={formId} aria-label={`${t('today.waiting.action')}: ${task.title}`} onClick={() => setWaitOpen(open => !open)}>{t('today.waiting.action')}</button>}
      </div>
      {(canAim || ownDeadline && onSetOwnDeadline && !task.isDone) && <div className="mt-2 flex flex-wrap items-center gap-2">
        {canAim && <button type="button" className={quiet} aria-expanded={aimOpen} aria-controls={`${formId}-aim`} aria-label={`${t('today.own.action')}: ${task.title}`} onClick={() => setAimOpen(open => !open)}>{t('today.own.action')}</button>}
        {ownDeadline && onSetOwnDeadline && <button type="button" className={quiet} aria-label={`${t('today.own.clear')}: ${task.title}`} onClick={() => { onSetOwnDeadline(task, ''); setAimOn(''); setAimOpen(false); }}>{t('today.own.clear')}</button>}
      </div>}
      {canAim && aimOpen && <form id={`${formId}-aim`} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3"
        onSubmit={event => { event.preventDefault(); if (!aimOn || aimOn > dayBeforeDue) return; onSetOwnDeadline!(task, aimOn); setAimOpen(false); }}>
        <label className="text-xs font-semibold text-slate-600">{t('today.own.label')}
          <input autoFocus type="date" required value={aimOn} min={dayFromNow(0)} max={dayBeforeDue} onChange={event => setAimOn(event.target.value)} className="mt-1 block min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900" />
        </label>
        <button type="submit" className="min-h-11 cursor-pointer rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{t('common.save')}</button>
      </form>}
      {!task.isDone && !waiting && onWait && waitOpen && <form id={formId} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3"
        onSubmit={event => { event.preventDefault(); if (!followUpOn) return; onWait(task, who, followUpOn); setWaitOpen(false); }}>
        <label className="min-w-40 flex-1 text-xs font-semibold text-slate-600">{t('today.waiting.who')}
          <input autoFocus value={who} maxLength={80} onChange={event => setWho(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900" />
        </label>
        <label className="text-xs font-semibold text-slate-600">{t('today.waiting.followUpOn')}
          <input type="date" required value={followUpOn} min={dayFromNow(0)} onChange={event => setFollowUpOn(event.target.value)} className="mt-1 block min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900" />
        </label>
        <button type="submit" className="min-h-11 cursor-pointer rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{t('common.save')}</button>
      </form>}
    </article>
  );
}
