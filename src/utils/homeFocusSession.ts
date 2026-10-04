import { buildStorageKey } from '../shared/storage/storageAdapter';

const changeEvent = 'kanban-home-focus-view-change';
const unavailableStorage = new Map<string, string | null>();

export function homeFocusViewStorageKey(userId?: string | null, workspaceId?: string | null) {
  return buildStorageKey({ userId: userId ?? null, workspaceId: workspaceId ?? null }, 'home_focus_view');
}

// A saved timer is not a request to enter full-screen Home focus. Only an
// explicit Home action writes this separate, user/workspace-scoped choice.
export function readHomeFocusTask(key: string): string | null {
  if (unavailableStorage.has(key)) return unavailableStorage.get(key) ?? null;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    return typeof value === 'string' && value.length > 0 && value.length <= 256 ? value : null;
  } catch {
    return null;
  }
}

export function writeHomeFocusTask(key: string, taskId: string | null) {
  try {
    window.localStorage.setItem(key, JSON.stringify(taskId));
    unavailableStorage.delete(key);
  } catch {
    // Keep Home and the overlays in sync even if browser storage is blocked.
    unavailableStorage.set(key, taskId);
  }
  window.dispatchEvent(new Event(changeEvent));
}

export function subscribeHomeFocusView(listener: () => void) {
  window.addEventListener(changeEvent, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(changeEvent, listener);
    window.removeEventListener('storage', listener);
  };
}
