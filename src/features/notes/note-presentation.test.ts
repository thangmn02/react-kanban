import { expect, it } from 'vitest';
import { newNote } from './notes-store';
import { beginNoteShake, moveNoteShake, noteMode, notePresentationPreferences, reachableBubble } from './note-presentation';

it('keeps ghost/bubble/collection pin separate from content and restores reachable bubble bounds', () => {
  const note = { ...newNote(), title: 'Keep me', html: '<p>Document</p>', pinned: true, floating: false, collapsed: true, bubbleX: 3000, bubbleY: 1800 };
  expect(noteMode(note)).toBe('COLLAPSED'); expect(reachableBubble(note, { width: 800, height: 500 })).toEqual({ x: 740, y: 440 });
  expect(note).toMatchObject({ pinned: true, floating: false, title: 'Keep me', html: '<p>Document</p>', width: 310, height: 360 });
  expect(noteMode({ ...note, collapsed: false, clickThrough: true })).toBe('CLICK_THROUGH');
  expect(noteMode({ ...note, collapsed: false, clickThrough: true, peek: true })).toBe('PEEK');
  expect(noteMode({ opacity: 0.5 })).toBe('TRANSLUCENT'); expect(noteMode({})).toBe('NORMAL');
});
it('clamps presentation without treating opacity as authorization', () => {
  expect(notePresentationPreferences({ opacity: 0, fontSize: 100 })).toMatchObject({ opacity: 0.3, fontSize: 20, hidden: false });
  expect(notePresentationPreferences({ opacity: Number.NaN, color: 'invalid' as 'paper' })).toMatchObject({ opacity: 1, color: 'paper' });
});
it('recognizes deliberate oscillation but ignores slow drag, jitter and vertical motion', () => {
  const deliberate = beginNoteShake(0, 0, 0);
  expect([65, 10, 70, 15, 75].map((x, index) => moveNoteShake(deliberate, x, 2, 100 + index * 80)).at(-1)).toBe(true);
  const jitter = beginNoteShake(0, 0, 0); expect([3, -3, 4, -4, 5].some((x, index) => moveNoteShake(jitter, x, 0, index * 50))).toBe(false);
  const scroll = beginNoteShake(0, 0, 0); expect([60, -30, 60, -30, 60].some((x, index) => moveNoteShake(scroll, x, (index + 1) * 60, index * 50))).toBe(false);
  const slow = beginNoteShake(0, 0, 0); expect([60, -30, 60, -30, 60].some((x, index) => moveNoteShake(slow, x, 0, (index + 1) * 800))).toBe(false);
});
