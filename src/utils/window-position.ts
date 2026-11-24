/** Saved positions must survive a window that changed size: keep a corner, or clamp when rendering. Never save pixels measured in a smaller window. */
export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export interface Area { left: number; top: number; right: number; bottom: number }
export interface Size { width: number; height: number }
export interface Point { x: number; y: number }

/** The closest reachable point: the whole box inside the area, or its top-left corner when the area is smaller. */
export function clampToArea(point: Point, size: Size, area: Area): Point {
  return { x: Math.max(area.left, Math.min(point.x, area.right - size.width)), y: Math.max(area.top, Math.min(point.y, area.bottom - size.height)) };
}

export function nearestCorner(point: Point, size: Size, area: Area): Corner {
  const right = point.x + size.width / 2 > (area.left + area.right) / 2, bottom = point.y + size.height / 2 > (area.top + area.bottom) / 2;
  return `${bottom ? 'bottom' : 'top'}-${right ? 'right' : 'left'}`;
}

/** The corner reached from `corner` with an arrow key. */
export function cornerToward(corner: Corner, key: string): Corner | null {
  const [vertical, horizontal] = corner.split('-');
  switch (key) {
    case 'ArrowLeft': return `${vertical}-left` as Corner;
    case 'ArrowRight': return `${vertical}-right` as Corner;
    case 'ArrowUp': return `top-${horizontal}` as Corner;
    case 'ArrowDown': return `bottom-${horizontal}` as Corner;
    default: return null;
  }
}

export function isCorner(value: unknown): value is Corner {
  return ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(value as string);
}
