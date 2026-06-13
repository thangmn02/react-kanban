import { useEffect, useId } from 'react';

import { useI18n } from '../../../i18n';
import type { DailyFocusStats, FocusTask } from '../../../types/focus.type';

interface ShutdownRitualDialogProps {
  isOpen: boolean;
  focusTasks: FocusTask[];
  dailyFocusStats: DailyFocusStats;
  onClose: () => void;
  onComplete: () => void;
}

export default function ShutdownRitualDialog({
  isOpen,
  focusTasks,
  dailyFocusStats,
  onClose,
  onComplete,
}: ShutdownRitualDialogProps) {
  const titleId = useId();
  const { t } = useI18n();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const completedTasks = focusTasks.filter((task) => task.isDone);
  const unfinishedTasks = focusTasks.filter((task) => !task.isDone);

  return (
    <div className="fixed inset-0 z-[65] overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/45" onClick={onClose} aria-hidden="true" />

      <div className="flex min-h-screen items-center justify-center px-4 py-6">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
            {t('shutdown.eyebrow')}
          </p>
          <h2 id={titleId} className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            {t('shutdown.title')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {t('shutdown.description')}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-2xl font-semibold tracking-[-0.05em] text-slate-950">{completedTasks.length}/{focusTasks.length}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('shutdown.completedTasks')}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-2xl font-semibold tracking-[-0.05em] text-slate-950">{dailyFocusStats.completedSessions}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('shutdown.focusSessions')}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-2xl font-semibold tracking-[-0.05em] text-slate-950">{dailyFocusStats.focusedMinutes}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('shutdown.focusMinutes')}</p>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">
              {unfinishedTasks.length > 0
                ? t('shutdown.unfinishedTitle')
                : t('shutdown.emptyTitle')}
            </p>
            {unfinishedTasks.length > 0 && (
              <ul className="mt-3 space-y-2">
                {unfinishedTasks.map((task) => (
                  <li key={task.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                    {task.title}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
            >
              {t('shutdown.review')}
            </button>
            <button
              type="button"
              onClick={onComplete}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-sky-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
              autoFocus
            >
              {t('shutdown.complete')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
