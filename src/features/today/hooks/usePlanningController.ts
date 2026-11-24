import { useCallback, useMemo, useState } from 'react';

import { notify } from '../../../components/organisms/toast/notify';
import type { StorageScope } from '../../../shared/storage/storageAdapter';
import type { useI18n } from '../../../i18n';
import type { FocusSessionValue } from '../../focus/useFocusSessionController';
import {
  getYesterdayCarryoverSummary,
  writeDailyRitualSnapshot,
  type DailyCarryoverSummary,
} from '../dailyRitual';

interface Params {
  userId: string | null;
  workspaceId: string | null;
  focus: FocusSessionValue;
  /** Today is the one place to plan the day; every "Plan today" entry point opens it. */
  onOpenToday: () => void;
  t: ReturnType<typeof useI18n>['t'];
}

export function usePlanningController({
  userId,
  workspaceId,
  focus,
  onOpenToday,
  t,
}: Params) {
  const scope: StorageScope = useMemo(() => ({ userId, workspaceId }), [userId, workspaceId]);
  const [carryover, setCarryover] = useState(() => ({ scope, summary: getYesterdayCarryoverSummary(scope) }));
  // Another person or workspace has its own yesterday.
  if (carryover.scope !== scope) setCarryover({ scope, summary: getYesterdayCarryoverSummary(scope) });
  const carryoverSummary = carryover.scope === scope ? carryover.summary : null;
  const setCarryoverSummary = useCallback((summary: DailyCarryoverSummary | null) => setCarryover({ scope, summary }), [scope]);
  const [isShutdownRitualOpen, setIsShutdownRitualOpen] = useState(false);

  const handleOpenQuickPlan = useCallback(() => {
    setCarryoverSummary(getYesterdayCarryoverSummary(scope));
    onOpenToday();
  }, [onOpenToday, scope, setCarryoverSummary]);

  const handleCarryYesterday = useCallback((taskIds: string[]) => {
    const carriedCount = focus.carryOverFocusTasks(taskIds);
    setCarryoverSummary(null);
    if (carriedCount > 0) {
      notify.success(t('dailyRitual.carriedToast', { count: carriedCount, plural: carriedCount === 1 ? '' : 's' }));
    } else notify.info(t('dailyRitual.carryUnavailableToast'));
  }, [focus, setCarryoverSummary, t]);





  const handleCompleteShutdownRitual = useCallback(() => {
    writeDailyRitualSnapshot(scope, focus.focusTasks, focus.dailyFocusStats.completedSessions, focus.dailyFocusStats.focusedMinutes);
    setCarryoverSummary(null);
    setIsShutdownRitualOpen(false);
    notify.success(t('shutdown.completeToast'));
  }, [focus.dailyFocusStats.completedSessions, focus.dailyFocusStats.focusedMinutes, focus.focusTasks, scope, setCarryoverSummary, t]);

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
