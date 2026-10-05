import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FloatingFocus, { type FloatingFocusProps } from '../components/focus/FloatingFocus';
import floatingFocusStyles from '../components/focus/floatingFocus.css?inline';
import { useI18n } from '../i18n';

// Copy readable rules; external sheets fall back to a link instead of breaking
// PiP on a cross-origin SecurityError. Relative assets keep the opener's base.
export function copyPictureInPictureStyles(source: Document, target: Document) {
  const base = target.createElement('base');
  base.href = source.baseURI;
  target.head.appendChild(base);
  for (const sheet of Array.from(source.styleSheets)) {
    try {
      const style = target.createElement('style');
      style.textContent = Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n');
      style.media = sheet.media?.mediaText || '';
      target.head.appendChild(style);
    } catch {
      if (!sheet.href) continue;
      const link = target.createElement('link');
      link.rel = 'stylesheet'; link.href = sheet.href;
      link.media = sheet.media?.mediaText || '';
      target.head.appendChild(link);
    }
  }
  const style = target.createElement('style');
  style.textContent = floatingFocusStyles;
  target.head.appendChild(style);
}

export function useDocumentPictureInPicture(props: FloatingFocusProps) {
  const { t } = useI18n();
  const pipWindowRef = useRef<Window | null>(null);
  const openingRef = useRef(false);
  const mountedRef = useRef(true);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [activated, setActivated] = useState(false);
  const [widgetError, setWidgetError] = useState('');
  // Keep the portal target stable. Moving its host between documents preserves
  // React state, music subscriptions, and the FLIP elements rather than remounting.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const isSupported = typeof window !== 'undefined' && Boolean(window.documentPictureInPicture);
  const hasRunnableTimer = props.focusTasks.length > 0 || Boolean(props.timerState.activeTaskId);

  const returnToTab = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    document.body.appendChild(host);
    host.hidden = false;
    host.style.cssText = 'position:fixed;right:16px;bottom:16px;width:min(520px,calc(100vw - 32px));height:min(680px,calc(100dvh - 32px));z-index:1000;border-radius:22px;';
    pipWindowRef.current = null;
    if (mountedRef.current) setPipWindow(null);
  }, []);

  const openPictureInPicture = useCallback(async () => {
    if (!window.documentPictureInPicture) throw new Error('Floating timer is not supported in this browser.');
    if (!hasRunnableTimer) throw new Error('Pin a focus task before opening the floating timer.');
    if (pipWindowRef.current && !pipWindowRef.current.closed) { pipWindowRef.current.focus(); return; }
    if (openingRef.current) return;
    openingRef.current = true;
    try {
      const nextWindow = await window.documentPictureInPicture.requestWindow({ width: 520, height: 680 });
      if (!mountedRef.current) { nextWindow.close(); return; }
      setWidgetError('');
      let host = hostRef.current;
      if (!host) {
        host = document.createElement('div');
        host.id = 'floating-focus-widget';
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = floatingFocusStyles;
        const root = document.createElement('div');
        root.id = 'floating-focus-root';
        shadow.append(style, root);
        hostRef.current = host;
        setTarget(root);
      }
      copyPictureInPictureStyles(document, nextWindow.document);
      nextWindow.document.title = 'Floating Focus';
      host.hidden = false;
      host.style.cssText = 'display:block;width:100%;height:100dvh;';
      nextWindow.document.body.appendChild(host);
      pipWindowRef.current = nextWindow;
      setActivated(true);
      setPipWindow(nextWindow);
      nextWindow.addEventListener('pagehide', () => {
        if (pipWindowRef.current === nextWindow) {
          if (mountedRef.current) returnToTab();
        }
      }, { once: true });
    } finally { openingRef.current = false; }
  }, [hasRunnableTimer, returnToTab]);

  const closePictureInPicture = useCallback(() => {
    const current = pipWindowRef.current;
    if (current) returnToTab();
    current?.close();
  }, [returnToTab]);

  const dismiss = useCallback(() => {
    closePictureInPicture();
    hostRef.current?.setAttribute('hidden', '');
    setActivated(false);
  }, [closePictureInPicture]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pipWindowRef.current?.close();
      pipWindowRef.current = null;
      hostRef.current?.remove();
    };
  }, []);

  return {
    isPictureInPictureSupported: isSupported,
    isPictureInPictureOpen: Boolean(pipWindow),
    openPictureInPicture,
    closePictureInPicture,
    floatingFocusPortal: activated && target ? createPortal(<FloatingFocus
      {...props} isWidget={Boolean(pipWindow)} canPopOut={isSupported} widgetError={widgetError}
      onPopOut={() => { void openPictureInPicture().catch(() => { if (mountedRef.current) setWidgetError(t('dock.widgetFailed')); }); }}
      onReturnToTab={closePictureInPicture} onDismiss={dismiss}
    />, target) : null,
  };
}
