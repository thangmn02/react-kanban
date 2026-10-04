import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

const storageKey = 'focus-island-position-v1';
type Position = { x: number; y: number };

export function useIslandPosition(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  function move(position: Position) {
    const element = ref.current;
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    const x = Math.max(12, Math.min(position.x, document.documentElement.clientWidth - bounds.width - 12));
    const y = Math.max(80, Math.min(position.y, window.innerHeight - bounds.height - 12));
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
  }

  function save() {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ x: bounds.x, y: bounds.y })); } catch { /* Position is optional. */ }
  }

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    try {
      const stored: Position = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) move(stored);
    } catch { /* Ignore invalid or unavailable storage. */ }
    const fit = () => {
      if (!element.style.left) return;
      const bounds = element.getBoundingClientRect();
      move({ x: bounds.x, y: bounds.y });
    };
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    window.addEventListener('resize', fit);
    return () => { observer.disconnect(); window.removeEventListener('resize', fit); };
  }, [enabled]);

  return {
    ref,
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0 || (event.target as HTMLElement).closest('button:not([data-drag-handle])')) return;
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const previous = drag.current;
      const bounds = ref.current?.getBoundingClientRect();
      if (!previous || previous.id !== event.pointerId || !bounds) return;
      move({ x: bounds.x + event.clientX - previous.x, y: bounds.y + event.clientY - previous.y });
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    },
    onPointerUp() { drag.current = null; save(); },
    onPointerCancel() { drag.current = null; },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      const bounds = ref.current?.getBoundingClientRect();
      if (!bounds) return;
      const offsets: Record<string, Position> = { ArrowLeft: { x: -20, y: 0 }, ArrowRight: { x: 20, y: 0 }, ArrowUp: { x: 0, y: -20 }, ArrowDown: { x: 0, y: 20 } };
      const offset = offsets[event.key];
      if (!offset) return;
      event.preventDefault();
      move({ x: bounds.x + offset.x, y: bounds.y + offset.y });
      save();
    },
  };
}
