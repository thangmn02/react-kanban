import { useEffect, useRef, useState } from 'react';
import type { FocusTask, PomodoroMode } from '../../types/focus.type';
import type { FocusSessionValue } from '../../features/focus/useFocusSessionController';
import { useI18n } from '../../i18n';
import { formatPomodoroTime } from '../../utils/pomodoroTime';
import DueDateBadge from '../atoms/DueDateBadge';

export interface HomeFocusControls {
  session: Pick<FocusSessionValue, 'timerState' | 'remainingSeconds' | 'focusTasks' | 'dailyFocusStats' | 'activeFocusIntention' | 'setFocusIntention' | 'handleStartFocusTimer' | 'pauseTimer' | 'resetTimer' | 'setMode' | 'setIsFocusDockCollapsed'>;
  onMarkDone: (task: FocusTask) => Promise<boolean>;
}

const button = 'min-h-11 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-50';
const primaryAction = `${button} bg-blue-600 text-white hover:bg-blue-700 hover:text-white`;
const quietText = 'cursor-pointer text-[13px] font-medium text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600';

export default function HomeFocusView({ task, session, onMarkDone, onExit }: HomeFocusControls & { task: FocusTask; onExit: () => void }) {
  const { t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  const cancelIntentionCommitRef = useRef(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { heading.current?.focus(); }, [task.id]);
  const { setIsFocusDockCollapsed } = session;
  useEffect(() => { setIsFocusDockCollapsed(true); }, [setIsFocusDockCollapsed, session.timerState.isRunning]);
  const intention = session.activeFocusIntention?.taskId === task.id ? session.activeFocusIntention.text : '';
  const [editingIntention, setEditingIntention] = useState(false);
  const [draftIntention, setDraftIntention] = useState('');
  useEffect(() => {
    cancelIntentionCommitRef.current = false;
    setEditingIntention(false);
    setDraftIntention('');
  }, [task.id]);
  const commitIntention = () => {
    if (cancelIntentionCommitRef.current) {
      cancelIntentionCommitRef.current = false;
      return;
    }
    const trimmedDraft = draftIntention.trim();
    session.setFocusIntention(task.id, trimmedDraft);
    setDraftIntention(trimmedDraft);
    setEditingIntention(false);
  };
  const complete = async () => {
    setSaving(true);
    try {
      if (await onMarkDone(task)) {
        session.pauseTimer();
        onExit();
      }
    } finally { setSaving(false); }
  };

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-[720px] px-5 pb-40 pt-12 sm:px-8 sm:pt-20" aria-busy={saving}>
      <p className="flex items-center gap-2 text-sm text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />{t('briefing.focusingOn')}</p>
      <h1 ref={heading} tabIndex={-1} className="mt-3 break-words text-4xl font-semibold leading-tight tracking-tight text-slate-950 outline-none">{task.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500"><span>{task.boardTitle}</span>{task.listTitle && <span>{task.listTitle}</span>}<DueDateBadge dueDate={task.dueDate} /></div>
      <div className="mt-8 flex flex-wrap items-center gap-3" role="group" aria-label={t('focus.timer.pomodoro')}>
        {(['focus', 'shortBreak', 'longBreak'] as PomodoroMode[]).map((mode) => <button key={mode} type="button" disabled={saving} aria-pressed={session.timerState.mode === mode} className={`${button} ${session.timerState.mode === mode ? 'bg-blue-50 text-blue-700' : ''}`} onClick={() => session.setMode(mode)}>{t(`focus.mode.${mode}`)}</button>)}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <span role="timer" aria-label={t('focus.timer.pomodoro')} className="text-5xl font-semibold tabular-nums tracking-tight text-slate-800">{formatPomodoroTime(session.remainingSeconds)}</span>
        <button type="button" disabled={saving} className={primaryAction} onClick={() => session.timerState.isRunning ? session.pauseTimer() : session.handleStartFocusTimer(task.id)}>{t(session.timerState.isRunning ? 'focus.timer.pause' : session.timerState.startedAt ? 'briefing.resume' : 'focus.timer.start')}</button>
        <button type="button" disabled={saving} className={button} onClick={session.resetTimer}>{t('focus.timer.reset')}</button>
      </div>
      <div className="mt-7 border-l-2 border-slate-200 pl-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{t('briefing.nextStep')}</h2>
        {intention && !editingIntention ? (
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-600">{intention}</p>
            <button type="button" disabled={saving} className={quietText} onClick={() => { setDraftIntention(intention); setEditingIntention(true); }}>{t('common.edit')}</button>
          </div>
        ) : (
          <input
            type="text"
            value={draftIntention}
            disabled={saving}
            autoFocus={editingIntention}
            onChange={(event) => setDraftIntention(event.target.value)}
            onBlur={commitIntention}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                cancelIntentionCommitRef.current = true;
                setDraftIntention('');
                setEditingIntention(false);
                event.currentTarget.blur();
              }
            }}
            placeholder={t('briefing.nextStepPlaceholder')}
            aria-label={t('briefing.nextStep')}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[15px] text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
          />
        )}
      </div>
      <p className="mt-6 text-sm text-slate-500">{t('briefing.focusMinutesToday', { count: session.dailyFocusStats.focusedMinutes })}</p>
      <div className="mt-8 flex flex-wrap gap-2">
        <button type="button" disabled={saving || task.isDone} className={primaryAction} onClick={() => void complete()}>{t('common.markDone')}</button>
        <button type="button" disabled={saving} className={button} onClick={onExit}>{t('briefing.exitFocus')}</button>
      </div>
    </main>
  );
}
