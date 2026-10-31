import { useLayoutEffect, useRef, type RefObject } from 'react';

const focusable = 'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"], [contenteditable="true"]';

// Open modals in opening order. A closing modal can stay in the DOM during its exit animation, so
// document order cannot identify the topmost one.
const openModals: RefObject<HTMLElement | null>[] = [];
const managed = new WeakSet<HTMLElement>();
// Bumped whenever a modal opens, so a closed modal's delayed focus restoration never acts on a newer one.
let generation = 0;

/** Contain keyboard focus in the topmost modal and return it to its opener. */
export function useDialogFocus(isOpen: boolean, root: RefObject<HTMLElement | null>, onClose: () => void, restoreSelector?: string, containFocus = true) {
  const close = useRef(onClose);
  useLayoutEffect(() => { close.current = onClose; }, [onClose]);
  // Layout effect: Escape and Tab must work from the first painted frame, not after passive effects flush.
  useLayoutEffect(() => {
    if (!isOpen) return;
    // The body is not a return target: fall back to restoreSelector when nothing was focused at open.
    const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    const modal = root.current;
    openModals.push(root);
    const opened = ++generation;
    if (modal) managed.add(modal);
    const frame = requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(focusable)?.focus());
    const keydown = (event: KeyboardEvent) => {
      const element = root.current;
      if (!element) return;
      managed.add(element);
      if (openModals.at(-1) !== root) return;
      // Dialogs outside this hook still take precedence when they are above this one.
      const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
      const later = dialogs.slice(dialogs.indexOf(element) + 1);
      if (later.some(dialog => !managed.has(dialog))) return;
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab' || !containFocus) return;
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
      const index = openModals.lastIndexOf(root);
      if (index >= 0) openModals.splice(index, 1);
      // The element may have mounted after this effect; mark it so its exit animation is never mistaken for a modal above.
      if (root.current) managed.add(root.current);
      requestAnimationFrame(() => {
        const restore = () => {
          if (generation !== opened) return true;
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
  }, [isOpen, root, restoreSelector, containFocus]);
}
