import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ViewContext } from './view-context';

export default function ViewContextBoundary({ children, ready }: { children: ReactNode; ready: boolean }) {
  const [cache] = useState(() => new Map<string, unknown>());
  const root = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    if (!ready) return;
    const saved = cache.get(`scroll:${pathname}`) as { x: number; y: number; panels: [string, number, number][] } | undefined;
    let restoring = true;
    let frame = 0;
    const giveUpAt = performance.now() + 1_000;
    // A page that is still loading is too short to scroll to the old place, so keep trying until it is tall enough.
    const restore = () => {
      window.scrollTo({ left: saved?.x ?? 0, top: saved?.y ?? 0, behavior: 'instant' });
      let reached = Math.abs(window.scrollY - (saved?.y ?? 0)) <= 1 && Math.abs(window.scrollX - (saved?.x ?? 0)) <= 1;
      saved?.panels.forEach(([key, left, top]) => {
        const panel = root.current?.querySelector<HTMLElement>(`[data-scroll-key="${key}"]`);
        if (panel) { panel.scrollLeft = left; panel.scrollTop = top; }
        reached = reached && !!panel && Math.abs(panel.scrollTop - top) <= 1 && Math.abs(panel.scrollLeft - left) <= 1;
      });
      if (reached || performance.now() > giveUpAt) restoring = false;
      else frame = requestAnimationFrame(restore);
    };
    frame = requestAnimationFrame(restore);
    // The person's own scrolling always wins.
    const takeOver = () => { cancelAnimationFrame(frame); restoring = false; };
    const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    inputs.forEach(type => window.addEventListener(type, takeOver, { capture: true, passive: true }));
    const save = () => {
      if (restoring) return;
      cache.set(`scroll:${pathname}`, { x: window.scrollX, y: window.scrollY,
        panels: [...(root.current?.querySelectorAll<HTMLElement>('[data-scroll-key]') ?? [])].map(el => [el.dataset.scrollKey, el.scrollLeft, el.scrollTop]) });
    };
    document.addEventListener('scroll', save, true);
    return () => {
      cancelAnimationFrame(frame);
      inputs.forEach(type => window.removeEventListener(type, takeOver, true));
      document.removeEventListener('scroll', save, true);
    };
  }, [cache, pathname, ready]);
  return <ViewContext.Provider value={{ cache: cache, pathname }}><div ref={root}>{children}</div></ViewContext.Provider>;
}
