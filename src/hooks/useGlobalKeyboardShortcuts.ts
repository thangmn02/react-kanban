import { useEffect } from 'react';

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input'
    || tagName === 'textarea'
    || tagName === 'select'
    || target.isContentEditable;
}

interface UseGlobalKeyboardShortcutsParams {
  enabled: boolean;
  onOpenCommandPalette: () => void;
  onQuickAddTask: () => void;
  onFocusSearch: () => void;
}

export function useGlobalKeyboardShortcuts({
  enabled,
  onOpenCommandPalette,
  onQuickAddTask,
  onFocusSearch,
}: UseGlobalKeyboardShortcutsParams) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const isCommandKey = event.metaKey || event.ctrlKey;

      if (isCommandKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenCommandPalette();
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (!isCommandKey && !event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        onQuickAddTask();
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        onFocusSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onFocusSearch, onOpenCommandPalette, onQuickAddTask]);
}
