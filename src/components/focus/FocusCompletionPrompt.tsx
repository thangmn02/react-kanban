import { useEffect, useId, useState } from 'react';

import type { FocusTask, PomodoroSessionSnapshot } from '../../types/focus.type';
import { useI18n } from '../../i18n';

interface FocusCompletionPromptProps {
  task: FocusTask | null;
  session: PomodoroSessionSnapshot | null;
  /** The task's saved Next step; the prompt lets the person update it while the work is fresh. */
  nextStep: string;
  onSaveNextStep: (text: string) => void;
  onMarkDone: () => void;
  onKeepWorking: () => void;
  onClose: () => void;
}

function FocusCompletionPrompt({
  task,
  session,
  nextStep,
  onSaveNextStep,
  onMarkDone,
  onKeepWorking,
  onClose,
}: FocusCompletionPromptProps) {
  const titleId = useId();
  const nextStepId = useId();
  const { t } = useI18n();
  const [draft, setDraft] = useState(nextStep);
  useEffect(() => { setDraft(nextStep); }, [nextStep, task?.id]);
  // Leaving without finishing keeps the answer to "where do I start next time?".
  const keep = (then: () => void) => () => { onSaveNextStep(draft); then(); };

  useEffect(() => {
    if (!task || !session) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onSaveNextStep(draft);
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [draft, onClose, onSaveNextStep, session, task]);

  if (!task || !session) {
    return null;
  }

  const focusedMinutes = Math.max(1, Math.round(session.durationSeconds / 60));

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-950/35"
        onClick={keep(onClose)}
        aria-hidden="true"
      />

      <div className="flex min-h-screen items-center justify-center px-4 py-6">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        >
          <h2 id={titleId} className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
            {t('focus.complete.title')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {t('focus.complete.summary', {
              count: focusedMinutes,
              plural: focusedMinutes === 1 ? '' : 's',
              task: task.title,
            })}
          </p>

          <label htmlFor={nextStepId} className="mt-5 block text-sm font-medium text-slate-700">{t('focus.nextStart.question')}</label>
          <input
            id={nextStepId}
            type="text"
            value={draft}
            maxLength={500}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('focus.nextStart.placeholder')}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
          />

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={keep(onClose)}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
            >
              {t('common.close')}
            </button>
            <button
              type="button"
              onClick={keep(onKeepWorking)}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
            >
              {t('focus.complete.keepWorking')}
            </button>
            <button
              type="button"
              onClick={onMarkDone}
              className="cursor-pointer rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
              autoFocus
            >
              {t('common.markDone')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default FocusCompletionPrompt;
