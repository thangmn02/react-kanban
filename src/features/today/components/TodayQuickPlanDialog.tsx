import { useEffect, useState } from 'react';

import { Skeleton } from '../../../components/atoms/skeleton';
import ContentDialog from '../../../components/molecules/dialog/ContentDialog';
import { useI18n } from '../../../i18n';
import { fetchTodayPageData, type TodayPageData, type TodayTaskSummary } from '../../../services/today.service';
import type { AppUser, WorkspaceSummary } from '../../../types/auth.type';
import type { FocusTask } from '../../../types/focus.type';
import type { DailyCarryoverSummary } from '../dailyRitual';
import TodayTaskSelector from './TodayTaskSelector';

interface TodayQuickPlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  activeWorkspace: WorkspaceSummary | null;
  focusTasks: FocusTask[];
  carryoverSummary: DailyCarryoverSummary | null;
  onCarryYesterday: (taskIds: string[]) => void;
  onDismissCarryover: () => void;
  onToggleTodayFocus: (task: TodayTaskSummary) => void;
  onOpenTask: (task: TodayTaskSummary) => void;
  onStartFocus: (task: TodayTaskSummary) => void;
  /** Footer fallback action when no unfinished task is selected. */
  onGoToBoard: () => void;
  onFinishRitual: () => void;
}

export default function TodayQuickPlanDialog({
  isOpen,
  onClose,
  currentUser,
  activeWorkspace,
  focusTasks,
  carryoverSummary,
  onCarryYesterday,
  onDismissCarryover,
  onToggleTodayFocus,
  onOpenTask,
  onStartFocus,
  onGoToBoard,
  onFinishRitual,
}: TodayQuickPlanDialogProps) {
  const { t } = useI18n();
  const [todayData, setTodayData] = useState<TodayPageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    // Fetching a fresh Today payload is the dialog's external synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);

    fetchTodayPageData({
      currentUser,
      workspaceId: activeWorkspace?.id || null,
    })
      .then((data) => {
        if (!isMounted) return;
        setTodayData(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : t('dailyRitual.loadingError'));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentUser, activeWorkspace, t]);

  if (!isOpen) return null;

  const hasUnfinishedTask = focusTasks.some((task) => !task.isDone);

  const modalFooter = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={onClose}
        className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
      >
        {t('dailyRitual.skipForNow')}
      </button>
      <button
        type="button"
        onClick={hasUnfinishedTask ? onFinishRitual : onGoToBoard}
        className="cursor-pointer rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 active:scale-[0.98]"
      >
        {hasUnfinishedTask ? t('today.startFocus') : t('dailyRitual.goToBoard')}
      </button>
    </div>
  );

  return (
    <ContentDialog
      title={
        <header className="mb-5 flex flex-col gap-1">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-600">
            {t('dailyRitual.eyebrow')}
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            {t('dailyRitual.title')}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {t('dailyRitual.subtitle')}
          </p>
        </header>
      }
      onClose={onClose}
      onSubmit={onFinishRitual}
      textButtonClose=""
      textButtonSubmit=""
      className="w-full max-w-6xl rounded-[1.5rem] p-4 sm:p-6"
      modalFooter={modalFooter}
    >
      {isLoading || !todayData ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <Skeleton className="h-[520px] w-full rounded-2xl" />
          <Skeleton className="h-[520px] w-full rounded-2xl" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-12 text-center text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : (
        <TodayTaskSelector
          todayData={todayData}
          focusTasks={focusTasks}
          carryoverSummary={carryoverSummary}
          onCarryYesterday={onCarryYesterday}
          onDismissCarryover={onDismissCarryover}
          onToggleTodayFocus={onToggleTodayFocus}
          onOpenTask={onOpenTask}
          onStartFocus={onStartFocus}
        />
      )}
    </ContentDialog>
  );
}
