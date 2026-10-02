import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FloatingFocus, { type FloatingFocusProps } from '../components/focus/FloatingFocus';
import floatingFocusStyles from '../components/focus/floatingFocus.css?inline';

export function useDocumentPictureInPicture(props: FloatingFocusProps) {
  const pipWindowRef = useRef<Window | null>(null);
  const openingRef = useRef(false);
  const mountedRef = useRef(true);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const isSupported = typeof window !== 'undefined' && Boolean(window.documentPictureInPicture);
  const hasRunnableTimer = props.focusTasks.length > 0 || Boolean(props.timerState.activeTaskId);

  const openPictureInPicture = useCallback(async () => {
    if (!window.documentPictureInPicture) throw new Error('Floating timer is not supported in this browser.');
    if (!hasRunnableTimer) throw new Error('Pin a focus task before opening the floating timer.');
    if (pipWindowRef.current && !pipWindowRef.current.closed) { pipWindowRef.current.focus(); return; }
    if (openingRef.current) return;
    openingRef.current = true;
    try {
      const nextWindow = await window.documentPictureInPicture.requestWindow({ width: 520, height: 560 });
      if (!mountedRef.current) { nextWindow.close(); return; }
      const style = nextWindow.document.createElement('style');
      style.textContent = floatingFocusStyles;
      nextWindow.document.head.appendChild(style);
      nextWindow.document.title = 'Floating Focus';
      const root = nextWindow.document.createElement('div');
      root.id = 'floating-focus-root';
      nextWindow.document.body.replaceChildren(root);
      pipWindowRef.current = nextWindow;
      setPipWindow(nextWindow);
      nextWindow.addEventListener('pagehide', () => {
        if (pipWindowRef.current === nextWindow) {
          pipWindowRef.current = null;
          if (mountedRef.current) setPipWindow(null);
        }
      }, { once: true });
    } finally { openingRef.current = false; }
  }, [hasRunnableTimer]);

  const closePictureInPicture = useCallback(() => {
    const current = pipWindowRef.current;
    pipWindowRef.current = null;
    current?.close();
    setPipWindow(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pipWindowRef.current?.close();
      pipWindowRef.current = null;
    };
  }, []);

  const target = pipWindow?.document.getElementById('floating-focus-root');
  return {
    isPictureInPictureSupported: isSupported,
    isPictureInPictureOpen: Boolean(pipWindow),
    openPictureInPicture,
    closePictureInPicture,
    floatingFocusPortal: target ? createPortal(createElement(FloatingFocus, props), target) : null,
  };
}
