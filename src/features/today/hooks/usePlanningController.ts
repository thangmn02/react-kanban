import { useCallback, useState } from 'react';

import { notify } from '../../../components/organisms/toast/notify';
import type { useI18n } from '../../../i18n';
import type { FocusSessionValue } from '../../focus/useFocusSessionController';
import {
  getYesterdayCarryoverSummary,
  writeDailyRitualSnapshot,
  type DailyCarryoverSummary,
} from '../dailyRitual';

interface Params {
  focus: FocusSessionValue;
  /** Today is the one place to plan the day; every "Plan today" entry point opens it. */
  onOpenToday: () => void;
  t: ReturnType<typeof useI18n>['t'];
}

export function usePlanningController({
  focus,
  onOpenToday,
  t,
}: Params) {
  const [carryoverSummary, setCarryoverSummary] = useState<DailyCarryoverSummary | null>(getYesterdayCarryoverSummary);
  const [isShutdownRitualOpen, setIsShutdownRitualOpen] = useState(false);

  const handleOpenQuickPlan = useCallback(() => {
    setCarryoverSummary(getYesterdayCarryoverSummary());
    onOpenToday();
  }, [onOpenToday]);

  const handleCarryYesterday = useCallback((taskIds: string[]) => {
    const carriedCount = focus.carryOverFocusTasks(taskIds);
    setCarryoverSummary(null);
    if (carriedCount > 0) {
      notify.success(t('dailyRitual.carriedToast', { count: carriedCount, plural: carriedCount === 1 ? '' : 's' }));
    } else notify.info(t('dailyRitual.carryUnavailableToast'));
  }, [focus, t]);





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
    handleCompleteShutdownRitual,
  };
}
