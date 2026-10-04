import { useCallback, useSyncExternalStore } from 'react';
import { homeFocusViewStorageKey, readHomeFocusTask, subscribeHomeFocusView, writeHomeFocusTask } from '../utils/homeFocusSession';

export function useHomeFocusView(userId?: string | null, workspaceId?: string | null) {
  const key = homeFocusViewStorageKey(userId, workspaceId);
  const focusViewId = useSyncExternalStore(
    subscribeHomeFocusView,
    () => userId ? readHomeFocusTask(key) : null,
    () => null,
  );
  const setFocusViewId = useCallback((taskId: string | null) => {
    if (userId) writeHomeFocusTask(key, taskId);
  }, [key, userId]);
  return { focusViewId, setFocusViewId };
}
