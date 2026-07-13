import { useCallback, useState } from 'react';

import { notify } from '../../../components/organisms/toast/notify';
import type { useI18n } from '../../../i18n';
import type { TodayTaskSummary } from '../../../services/today.service';
import type { FocusSessionValue } from '../../focus/useFocusSessionController';
import {
  getYesterdayCarryoverSummary,
  writeDailyRitualSnapshot,
  type DailyCarryoverSummary,
} from '../dailyRitual';

interface Params {
  focus: FocusSessionValue;
  activeBoardId: string | null;
  firstListId?: string;
  openQuickPlanDialog: (listId?: string | null) => void;
  closeQuickPlanDialog: () => void;
  onOpenTask: (task: TodayTaskSummary) => void;
  onGoToBoard: () => void;
  canOpenPictureInPicture: boolean;
  onOpenPictureInPicture: () => void;
  t: ReturnType<typeof useI18n>['t'];
}

export function usePlanningController({
  focus,
  activeBoardId,
  firstListId,
  openQuickPlanDialog,
  closeQuickPlanDialog,
  onOpenTask,
  onGoToBoard,
  canOpenPictureInPicture,
  onOpenPictureInPicture,
  t,
}: Params) {
  const [carryoverSummary, setCarryoverSummary] = useState<DailyCarryoverSummary | null>(getYesterdayCarryoverSummary);
  const [isShutdownRitualOpen, setIsShutdownRitualOpen] = useState(false);

  const handleOpenQuickPlan = useCallback(() => {
    if (!activeBoardId || !firstListId) {
      notify.info(t('toast.createBoardBeforeQuickPlan'));
      return;
    }
    openQuickPlanDialog(firstListId);
    setCarryoverSummary(getYesterdayCarryoverSummary());
  }, [activeBoardId, firstListId, openQuickPlanDialog, t]);

  const handleCarryYesterday = useCallback((taskIds: string[]) => {
    const carriedCount = focus.carryOverFocusTasks(taskIds);
    setCarryoverSummary(null);
    if (carriedCount > 0) {
      notify.success(t('dailyRitual.carriedToast', { count: carriedCount, plural: carriedCount === 1 ? '' : 's' }));
    } else notify.info(t('dailyRitual.carryUnavailableToast'));
  }, [focus, t]);

  const handleFinishDailyRitual = useCallback(() => {
    const firstRunnableTask = focus.focusTasks.find((task) => !task.isDone) || null;
    writeDailyRitualSnapshot(focus.focusTasks, focus.dailyFocusStats.completedSessions, focus.dailyFocusStats.focusedMinutes);
    setCarryoverSummary(null);
    closeQuickPlanDialog();
    if (!firstRunnableTask) {
      notify.info(t('dailyRitual.chooseBeforeStartToast'));
      return;
    }
    if (!focus.startFocusSessionNow(firstRunnableTask.id, t('dailyRitual.title'))) return;
    notify.success(t('dailyRitual.startedToast', { task: firstRunnableTask.title }));
    if (canOpenPictureInPicture) onOpenPictureInPicture();
  }, [canOpenPictureInPicture, closeQuickPlanDialog, focus, onOpenPictureInPicture, t]);

  const handleGoToBoardFromPlan = useCallback(() => {
    closeQuickPlanDialog();
    onGoToBoard();
  }, [closeQuickPlanDialog, onGoToBoard]);

  const handleStartFocusFromPlan = useCallback((task: TodayTaskSummary) => {
    focus.handleStartFocusTaskFromToday(task);
    closeQuickPlanDialog();
  }, [closeQuickPlanDialog, focus]);

  const handleOpenTaskFromPlan = useCallback((task: TodayTaskSummary) => {
    closeQuickPlanDialog();
    onOpenTask(task);
  }, [closeQuickPlanDialog, onOpenTask]);

  const handleCompleteShutdownRitual = useCallback(() => {
    writeDailyRitualSnapshot(focus.focusTasks, focus.dailyFocusStats.completedSessions, focus.dailyFocusStats.focusedMinutes);
    setCarryoverSummary(null);
    setIsShutdownRitualOpen(false);
    notify.success(t('shutdown.completeToast'));
  }, [focus.dailyFocusStats.completedSessions, focus.dailyFocusStats.focusedMinutes, focus.focusTasks, t]);

  return {
    carryoverSummary,
    setCarryoverSummary,
    isShutdownRitualOpen,
    setIsShutdownRitualOpen,
    handleOpenQuickPlan,
    handleCarryYesterday,
    handleFinishDailyRitual,
    handleGoToBoardFromPlan,
    handleStartFocusFromPlan,
    handleOpenTaskFromPlan,
    handleCompleteShutdownRitual,
  };
}
