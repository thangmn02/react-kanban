import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { clampToArea, cornerToward, isCorner, nearestCorner, type Area, type Corner } from '../../utils/window-position';

const storageKey = 'focus-island-position-v2', oldKey = 'focus-island-position-v1';
const MARGIN = 16, DEFAULT_CORNER: Corner = 'bottom-left';
// A position saved by an older version only means something in a window about as large as the one it was saved in.
const MIGRATE_WIDTH = 800;
const inDock = () => document.documentElement.dataset.nativeSurface === 'dock';

/** The main content: right of the rail and sidebar, below the app header, inside the window. */
function contentArea(): Area {
  const content = document.querySelector('[data-content-area]')?.getBoundingClientRect();
  const header = document.querySelector('[data-app-header]')?.getBoundingClientRect();
  const width = document.documentElement.clientWidth;
  const usable = content && content.width > 0;
  return { left: usable ? Math.max(0, content.left) : 0, right: usable ? Math.min(width, content.right) : width,
    top: header && header.height > 0 ? Math.max(0, header.bottom) : 0, bottom: window.innerHeight };
}

/** Anchors with CSS edges, so the box keeps its margin when its own size changes. */
function place(element: HTMLElement, corner: Corner) {
  const area = contentArea(), [vertical, horizontal] = corner.split('-');
  element.dataset.corner = corner;
  element.style.left = horizontal === 'left' ? `${area.left + MARGIN}px` : 'auto';
  element.style.right = horizontal === 'right' ? `${document.documentElement.clientWidth - area.right + MARGIN}px` : 'auto';
  element.style.top = vertical === 'top' ? `${area.top + MARGIN}px` : 'auto';
  element.style.bottom = vertical === 'bottom' ? `${MARGIN}px` : 'auto';
}

function save(corner: Corner) {
  // The pill only rests in a corner with a fixed margin, so the corner is the whole position.
  try { localStorage.setItem(storageKey, JSON.stringify({ corner })); localStorage.removeItem(oldKey); } catch { /* Position is optional. */ }
}

/** `null` means nothing usable yet; an older position is kept until the window is large enough to read it. */
function readSaved(element: HTMLElement): Corner | null {
  try {
    const corner = (JSON.parse(localStorage.getItem(storageKey) || 'null') as { corner?: unknown } | null)?.corner;
    if (isCorner(corner)) return corner;
  } catch { /* Ignore invalid or unavailable storage. */ }
  try {
    const raw = localStorage.getItem(oldKey);
    if (raw === null || window.innerWidth < MIGRATE_WIDTH) return null;
    localStorage.removeItem(oldKey);
    const old = JSON.parse(raw) as { x?: unknown; y?: unknown } | null;
    if (!old || !Number.isFinite(old.x) || !Number.isFinite(old.y)) return null;
    const corner = nearestCorner({ x: old.x as number, y: old.y as number }, element.getBoundingClientRect(), contentArea());
    save(corner);
    return corner;
  } catch { return null; }
}

/** `route` re-measures when the view changes, because each view brings its own header. */
export function useIslandPosition(enabled: boolean, route = '') {
  const ref = useRef<HTMLDivElement>(null);
  const corner = useRef<Corner>(DEFAULT_CORNER);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);

  function settle(next: Corner, remember: boolean) {
    corner.current = next;
    if (ref.current) place(ref.current, next);
    if (remember) save(next);
  }

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = () => {
      // The Dock and Tasks share one window: while it is Dock-sized nothing is measured. A resize never saves.
      if (drag.current || inDock()) return;
      corner.current = readSaved(element) ?? corner.current;
      place(element, corner.current);
    };
    const observer = new ResizeObserver(fit);
    const watch = () => { for (const target of document.querySelectorAll('[data-content-area], [data-app-header]')) observer.observe(target); fit(); };
    watch();
    // A view that loads late brings its header after this runs, often without changing the content's size.
    window.addEventListener('kora:header-ready', watch);
    const surface = new MutationObserver(fit);
    surface.observe(document.documentElement, { attributes: true, attributeFilter: ['data-native-surface'] });
    window.addEventListener('resize', fit);
    return () => { observer.disconnect(); surface.disconnect(); window.removeEventListener('resize', fit); window.removeEventListener('kora:header-ready', watch); };
  }, [enabled, route]);

  return {
    ref,
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0 || (event.target as HTMLElement).closest('button:not([data-drag-handle])')) return;
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const previous = drag.current, element = ref.current;
      if (!previous || previous.id !== event.pointerId || !element) return;
      const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
      if (!previous.moved && Math.hypot(dx, dy) < 4) return;
      const bounds = element.getBoundingClientRect();
      const next = clampToArea({ x: bounds.x + dx, y: bounds.y + dy }, bounds, contentArea());
      Object.assign(element.style, { left: `${next.x}px`, top: `${next.y}px`, right: 'auto', bottom: 'auto' });
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: true };
    },
    onPointerUp() {
      const moved = drag.current?.moved, bounds = ref.current?.getBoundingClientRect();
      drag.current = null;
      if (moved && bounds) settle(nearestCorner(bounds, bounds, contentArea()), true);
    },
    onPointerCancel() { drag.current = null; settle(corner.current, false); },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      const next = cornerToward(corner.current, event.key);
      if (!next) return;
      event.preventDefault();
      settle(next, true);
    },
  };
}
