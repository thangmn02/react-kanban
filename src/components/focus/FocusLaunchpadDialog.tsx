import { useCallback, useEffect, useId, useState } from 'react';

import type { FocusTask, PomodoroMode } from '../../types/focus.type';
import { formatPomodoroTime } from '../../utils/pomodoroTime';
import { useI18n } from '../../i18n';

interface FocusLaunchpadDialogProps {
  isOpen: boolean;
  task: FocusTask | null;
  mode: PomodoroMode;
  suggestedSeconds: number;
  onClose: () => void;
  onStart: (intention: string) => void;
}

function FocusLaunchpadDialog({
  isOpen,
  task,
  mode,
  suggestedSeconds,
  onClose,
  onStart,
}: FocusLaunchpadDialogProps) {
  const [intention, setIntention] = useState('');
  const titleId = useId();
  const intentionId = useId();
  const { t } = useI18n();
  const modeLabels: Record<PomodoroMode, string> = {
    focus: t('focus.mode.focus'),
    shortBreak: t('focus.mode.shortBreak'),
    longBreak: t('focus.mode.longBreak'),
  };

  const handleClose = useCallback(() => {
    setIntention('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, isOpen]);

  if (!isOpen || !task) {
    return null;
  }

  const handleStart = () => {
    setIntention('');
    onStart(intention.trim());
  };

  const handleStartWithoutIntention = () => {
    setIntention('');
    onStart('');
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div
        className="fixed inset-0 bg-slate-950/40"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div className="flex min-h-screen items-center justify-center px-4 py-6">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-700">
            {t('focus.launchpad.eyebrow')}
          </p>
          <h2 id={titleId} className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
            {t('focus.launchpad.title')}
          </h2>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold leading-6 text-slate-950">
              {task.title}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {task.boardTitle}{task.listTitle ? ` · ${task.listTitle}` : ''}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {t('focus.launchpad.session')}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {modeLabels[mode]}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {t('focus.launchpad.duration')}
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">
                {formatPomodoroTime(suggestedSeconds)}
              </p>
            </div>
          </div>

          <label htmlFor={intentionId} className="mt-5 block text-sm font-semibold text-slate-800">
            {t('focus.launchpad.doneWhen')}
          </label>
          <textarea
            id={intentionId}
            value={intention}
            onChange={(event) => setIntention(event.target.value)}
            rows={3}
            placeholder={t('focus.launchpad.placeholder')}
            className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          />

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleStartWithoutIntention}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
            >
              {t('focus.launchpad.skip')}
            </button>
            <button
              type="button"
              onClick={handleStart}
              className="cursor-pointer rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
              autoFocus
            >
              {t('focus.launchpad.start')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default FocusLaunchpadDialog;
