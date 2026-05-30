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
}

export function useGlobalKeyboardShortcuts({
  enabled,
  onOpenCommandPalette,
  onQuickAddTask,
}: UseGlobalKeyboardShortcutsParams) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const isCommandKey = event.metaKey || event.ctrlKey;

      if (isCommandKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenCommandPalette();
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        onQuickAddTask();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onOpenCommandPalette, onQuickAddTask]);
}
