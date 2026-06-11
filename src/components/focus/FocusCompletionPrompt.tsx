import { useEffect, useId } from 'react';

import type { FocusTask, PomodoroSessionSnapshot } from '../../types/focus.type';
import { useI18n } from '../../i18n';

interface FocusCompletionPromptProps {
  task: FocusTask | null;
  session: PomodoroSessionSnapshot | null;
  intention: string;
  onMarkDone: () => void;
  onKeepWorking: () => void;
  onClose: () => void;
}

function FocusCompletionPrompt({
  task,
  session,
  intention,
  onMarkDone,
  onKeepWorking,
  onClose,
}: FocusCompletionPromptProps) {
  const titleId = useId();
  const { t } = useI18n();

  useEffect(() => {
    if (!task || !session) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, session, task]);

  if (!task || !session) {
    return null;
  }

  const focusedMinutes = Math.max(1, Math.round(session.durationSeconds / 60));

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-950/35"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="flex min-h-screen items-center justify-center px-4 py-6">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700">
            {t('focus.complete.eyebrow')}
          </p>
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

          {intention && (
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                {t('focus.complete.doneWhen')}
              </p>
              <p className="mt-1 text-sm leading-6 text-emerald-900">
                {intention}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
            >
              {t('common.close')}
            </button>
            <button
              type="button"
              onClick={onKeepWorking}
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
