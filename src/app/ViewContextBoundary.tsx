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
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ left: saved?.x ?? 0, top: saved?.y ?? 0, behavior: 'instant' });
      saved?.panels.forEach(([key, left, top]) => {
        const panel = root.current?.querySelector<HTMLElement>(`[data-scroll-key="${key}"]`);
        if (panel) { panel.scrollLeft = left; panel.scrollTop = top; }
      });
      restoring = false;
    });
    const save = () => {
      if (restoring) return;
      cache.set(`scroll:${pathname}`, { x: window.scrollX, y: window.scrollY,
        panels: [...(root.current?.querySelectorAll<HTMLElement>('[data-scroll-key]') ?? [])].map(el => [el.dataset.scrollKey, el.scrollLeft, el.scrollTop]) });
    };
    document.addEventListener('scroll', save, true);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('scroll', save, true); };
  }, [cache, pathname, ready]);
  return <ViewContext.Provider value={{ cache: cache, pathname }}><div ref={root}>{children}</div></ViewContext.Provider>;
}
