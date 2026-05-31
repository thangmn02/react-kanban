import { useCallback, useEffect, useState } from 'react';

import type { ITaskActivity } from '../types/task.type';
import type { FocusSessionSummary } from '../types/focus.type';
import { fetchActivitiesForTask } from '../services/activity.service';
import { fetchFocusSessionsForTask } from '../services/focusSession.service';

interface UseTaskActivityDataArgs {
  isOpen: boolean;
  isEditMode: boolean;
  taskId?: string;
  workspaceId: string | null;
  onIdleReset?: () => void;
}

interface UseTaskActivityDataResult {
  activities: ITaskActivity[];
  focusSessions: FocusSessionSummary[];
  isLoadingActivities: boolean;
  isLoadingFocusSessions: boolean;
  resetActivityData: () => void;
}

export function useTaskActivityData({
  isOpen,
  isEditMode,
  taskId,
  workspaceId,
  onIdleReset,
}: UseTaskActivityDataArgs): UseTaskActivityDataResult {
  const [activities, setActivities] = useState<ITaskActivity[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSessionSummary[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isLoadingFocusSessions, setIsLoadingFocusSessions] = useState(false);

  const resetActivityData = useCallback(() => {
    setActivities([]);
    setFocusSessions([]);
    setIsLoadingActivities(false);
    setIsLoadingFocusSessions(false);
  }, []);

  const loadActivities = useCallback(async (currentTaskId: string) => {
    setIsLoadingActivities(true);

    try {
      const nextActivities = await fetchActivitiesForTask(currentTaskId);
      setActivities(nextActivities);
    } catch (error) {
      console.error('Failed to load activities:', error);
      setActivities([]);
    } finally {
      setIsLoadingActivities(false);
    }
  }, []);

  const loadFocusSessions = useCallback(async (currentTaskId: string) => {
    setIsLoadingFocusSessions(true);

    try {
      const nextFocusSessions = await fetchFocusSessionsForTask(workspaceId, currentTaskId);
      setFocusSessions(nextFocusSessions);
    } catch (error) {
      console.error('Failed to load focus sessions:', error);
      setFocusSessions([]);
    } finally {
      setIsLoadingFocusSessions(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (isOpen && isEditMode && taskId) {
      void loadActivities(taskId);
      void loadFocusSessions(taskId);
    } else {
      resetActivityData();
      onIdleReset?.();
    }
  }, [isEditMode, isOpen, loadActivities, loadFocusSessions, onIdleReset, resetActivityData, taskId]);

  return {
    activities,
    focusSessions,
    isLoadingActivities,
    isLoadingFocusSessions,
    resetActivityData,
  };
}
