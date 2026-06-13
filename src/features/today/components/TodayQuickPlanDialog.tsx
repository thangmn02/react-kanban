import { useEffect, useState } from 'react';
import { fetchTodayPageData, type TodayPageData, type TodayTaskSummary } from '../../../services/today.service';
import type { AppUser, WorkspaceSummary } from '../../../types/auth.type';
import type { FocusTask } from '../../../types/focus.type';
import TodayTaskSelector from './TodayTaskSelector';
import { Skeleton } from '../../../components/atoms/skeleton';
import { useI18n } from '../../../i18n';
import ContentDialog from '../../../components/molecules/dialog/ContentDialog';

interface TodayQuickPlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  activeWorkspace: WorkspaceSummary | null;
  focusTasks: FocusTask[];
  onToggleTodayFocus: (task: TodayTaskSummary) => void;
  onOpenTask: (task: TodayTaskSummary) => void;
  onStartFocus: (task: TodayTaskSummary) => void;
  onQuickCreateTask: () => void;
}

export default function TodayQuickPlanDialog({
  isOpen,
  onClose,
  currentUser,
  activeWorkspace,
  focusTasks,
  onToggleTodayFocus,
  onOpenTask,
  onStartFocus,
  onQuickCreateTask,
}: TodayQuickPlanDialogProps) {
  const { t } = useI18n();
  const [todayData, setTodayData] = useState<TodayPageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        setError(err instanceof Error ? err.message : t('today.loadError'));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentUser, activeWorkspace, t]);

  if (!isOpen) return null;

  return (
    <ContentDialog
      title={
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Lập kế hoạch nhanh</h3>
        </div>
      }
      onClose={onClose}
      onSubmit={onClose}
      textButtonClose=""
      textButtonSubmit="Hoàn tất"
      className="max-w-5xl w-full p-6 sm:p-10"
      modalFooter={
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Hoàn tất
          </button>
        </div>
      }
    >
      <div className="flex-1 overflow-y-auto">
        {isLoading || !todayData ? (
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
            <div className="flex flex-col gap-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500">{error}</div>
        ) : (
          <TodayTaskSelector
            todayData={todayData}
            focusTasks={focusTasks}
            onToggleTodayFocus={onToggleTodayFocus}
            onOpenTask={onOpenTask}
            onStartFocus={onStartFocus}
            onQuickCreateTask={onQuickCreateTask}
          />
        )}
      </div>
    </ContentDialog>
  );
}
