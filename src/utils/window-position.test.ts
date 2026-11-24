import { expect, it } from 'vitest';
import { clampToArea, cornerToward, nearestCorner } from './window-position';

const area = { left: 300, top: 64, right: 1280, bottom: 800 }, size = { width: 400, height: 60 };
it('snaps to the nearest corner of the content area, not of the window', () => {
  expect(nearestCorner({ x: 310, y: 70 }, size, area)).toBe('top-left');
  expect(nearestCorner({ x: 900, y: 70 }, size, area)).toBe('top-right');
  expect(nearestCorner({ x: 310, y: 700 }, size, area)).toBe('bottom-left');
  expect(nearestCorner({ x: 900, y: 700 }, size, area)).toBe('bottom-right');
  // The centre of the window lies in the left half of the content.
  expect(nearestCorner({ x: 440, y: 700 }, size, area)).toBe('bottom-left');
});
it('moves between corners with the arrow keys and ignores other keys', () => {
  expect(cornerToward('bottom-left', 'ArrowUp')).toBe('top-left');
  expect(cornerToward('top-left', 'ArrowRight')).toBe('top-right');
  expect(cornerToward('top-right', 'a')).toBeNull();
});
it('keeps a box reachable, and starts at the edge when the area is too small for it', () => {
  expect(clampToArea({ x: 2000, y: 2000 }, size, area)).toEqual({ x: 880, y: 740 });
  expect(clampToArea({ x: 2000, y: 2000 }, size, { left: 8, top: 8, right: 300, bottom: 40 })).toEqual({ x: 8, y: 8 });
});
