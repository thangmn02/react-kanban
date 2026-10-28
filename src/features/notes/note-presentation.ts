import type { StickyNote } from './notes-store';

export type NoteMode = 'NORMAL' | 'TRANSLUCENT' | 'PEEK' | 'CLICK_THROUGH' | 'COLLAPSED';
export const noteColors = {
  paper: { label: 'Paper', surface: '#fffbea', text: '#253047', border: '#e8dfba' },
  mint: { label: 'Mint', surface: '#edf8f0', text: '#203f33', border: '#bfdcc8' },
  sky: { label: 'Sky', surface: '#eef5fc', text: '#243d58', border: '#c5d8ec' },
  rose: { label: 'Rose', surface: '#fff1f3', text: '#543039', border: '#edcbd1' },
  slate: { label: 'Dark', surface: '#253047', text: '#f1f5f9', border: '#475569' },
} as const;
const bound = (value: number | undefined, min: number, max: number, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export function notePresentationPreferences(note: Partial<StickyNote>) {
  return {
    opacity: bound(note.opacity, 0.3, 1, 1),
    color: note.color && Object.hasOwn(noteColors, note.color) ? note.color : 'paper' as const,
    fontSize: bound(note.fontSize, 12, 20, 14),
    floating: note.floating === true, hidden: note.hidden === true, collapsed: note.collapsed === true,
    clickThrough: note.clickThrough === true, headerVisible: note.headerVisible !== false,
    bubbleX: bound(note.bubbleX ?? note.x, 0, 3000, 0), bubbleY: bound(note.bubbleY ?? note.y, 0, 2000, 0),
  };
}
export function noteMode(note: Partial<StickyNote>): NoteMode {
  if (note.collapsed) return 'COLLAPSED';
  if (note.peek) return 'PEEK';
  if (note.clickThrough) return 'CLICK_THROUGH';
  return notePresentationPreferences(note).opacity < 1 ? 'TRANSLUCENT' : 'NORMAL';
}
/** Restore a bubble without changing the note's expanded geometry. */
export function reachableBubble(note: Partial<StickyNote>, area: { width: number; height: number }) {
  const presentation = notePresentationPreferences(note);
  return { x: Math.max(0, Math.min(presentation.bubbleX, area.width - 60)), y: Math.max(0, Math.min(presentation.bubbleY, area.height - 60)) };
}

export interface NoteShake { started: number; lastX: number; lastY: number; direction: number; turns: number; travel: number }
export const beginNoteShake = (x: number, y: number, at: number): NoteShake => ({ started: at, lastX: x, lastY: y, direction: 0, turns: 0, travel: 0 });
/** Pointer-driven only. Small jitter, vertical scrolling and slow dragging never count. */
export function moveNoteShake(gesture: NoteShake, x: number, y: number, at: number) {
  if (at - gesture.started > 1200 || Math.abs(y - gesture.lastY) > 48) {
    Object.assign(gesture, beginNoteShake(x, y, at)); return false;
  }
  const delta = x - gesture.lastX;
  if (Math.abs(delta) < 16) return false;
  const direction = Math.sign(delta);
  if (gesture.direction && direction !== gesture.direction) gesture.turns++;
  gesture.travel += Math.abs(delta); gesture.direction = direction; gesture.lastX = x;
  return gesture.turns >= 4 && gesture.travel >= 130;
}
