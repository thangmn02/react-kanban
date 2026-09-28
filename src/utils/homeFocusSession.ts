export function dismissedFocusStorageKey(userId: string, workspaceId?: string | null) {
  return `home-focus-dismissed:${userId}:${workspaceId ?? 'none'}`;
}

export function readDismissedFocusSession(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function isHomeFocusSessionActive(
  timerState?: { startedAt: number | null; activeTaskId: string | null } | null,
  userId?: string | null,
  workspaceId?: string | null
) {
  if (!timerState?.startedAt || !timerState.activeTaskId || !userId) return false;
  try {
    const dismissed = window.sessionStorage.getItem(dismissedFocusStorageKey(userId, workspaceId));
    return dismissed !== String(timerState.startedAt);
  } catch {
    return false;
  }
}
