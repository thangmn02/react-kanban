import { useEffect, useRef, type RefObject } from 'react';

const focusable = 'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"], [contenteditable="true"]';

/** Contain keyboard focus in the topmost modal and return it to its opener. */
export function useDialogFocus(isOpen: boolean, root: RefObject<HTMLElement | null>, onClose: () => void, restoreSelector?: string) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = root.current;
    const frame = requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(focusable)?.focus());
    const keydown = (event: KeyboardEvent) => {
      const element = root.current;
      if (!element) return;
      const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')];
      if (dialogs.at(-1) !== element) return;
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = [...element.querySelectorAll<HTMLElement>(focusable)].filter(item => item.getClientRects().length > 0);
      const first = items[0], last = items.at(-1);
      if (!first || !last) { event.preventDefault(); element.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keydown);
      requestAnimationFrame(() => {
        const restore = () => {
          const target = opener?.isConnected && opener.getClientRects().length ? opener
            : restoreSelector ? document.querySelector<HTMLElement>(restoreSelector) : null;
          if (!target || !target.getClientRects().length) return false;
          if (document.activeElement === document.body || !document.activeElement?.isConnected || modal?.contains(document.activeElement)) target.focus({ preventScroll: true });
          return true;
        };
        restore();
        if (restoreSelector) {
          // A lazy route may replace an opener that was still connected on close.
          const observer = new MutationObserver(restore);
          window.setTimeout(() => observer.disconnect(), 2000);
          observer.observe(document.body, { childList: true, subtree: true });
        }
      });
    };
  }, [isOpen, root, restoreSelector]);
}
