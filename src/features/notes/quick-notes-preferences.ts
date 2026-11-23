import { useSyncExternalStore } from 'react';
import { isTauri } from '@tauri-apps/api/core';

/** Per-device choice: Quick Notes open as floating native note windows (desktop) or as the in-app card. */
const KEY = 'kora:quick-notes-floating:v1';
const CHANGED = 'kora:quick-notes-preferences-changed';
export const MAX_FLOATING_NOTES = 5;

export function floatingQuickNotes(): boolean {
  if (!isTauri()) return false;
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setFloatingQuickNotes(value: boolean) {
  try { localStorage.setItem(KEY, value ? 'on' : 'off'); } catch { /* The default (on) stays in effect. */ }
  window.dispatchEvent(new Event(CHANGED));
}
const subscribe = (listener: () => void) => {
  const storage = (event: StorageEvent) => { if (event.key === KEY) listener(); };
  window.addEventListener(CHANGED, listener); window.addEventListener('storage', storage);
  return () => { window.removeEventListener(CHANGED, listener); window.removeEventListener('storage', storage); };
};
export const useFloatingQuickNotes = () => useSyncExternalStore(subscribe, floatingQuickNotes, () => false);
