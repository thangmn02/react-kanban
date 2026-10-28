import { useRef } from 'react';
import type { StickyNote } from './notes-store';
import { noteColors, notePresentationPreferences } from './note-presentation';

export default function NoteBubble({ note, onChange, area }: { note: StickyNote; onChange: (patch: Partial<StickyNote>) => void; area: { width: number; height: number } }) {
  const drag = useRef<{ pointer: number; x: number; y: number; startX: number; startY: number } | null>(null), moved = useRef(false);
  const presentation = notePresentationPreferences(note), color = noteColors[presentation.color], title = note.title || 'Untitled note';
  const restore = () => onChange({ collapsed: false, peek: false, clickThrough: false });
  return <button type="button" aria-label={'Restore bubble: ' + title} title={title + ' · drag to move; click to restore'} className="pointer-events-auto flex h-14 w-14 touch-none items-center justify-center rounded-full border-2 text-xl shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" style={{ background: color.surface, color: color.text, borderColor: color.border }}
    onPointerDown={event => { moved.current = false; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, startX: presentation.bubbleX, startY: presentation.bubbleY }; }}
    onPointerMove={event => { const start = drag.current; if (start?.pointer !== event.pointerId) return; const x = event.clientX - start.x, y = event.clientY - start.y; if (Math.hypot(x,y) > 4) moved.current = true; if (moved.current) onChange({ bubbleX: Math.max(0, Math.min(area.width - 60, start.startX + x)), bubbleY: Math.max(0, Math.min(area.height - 60, start.startY + y)) }); }}
    onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; moved.current = true; }}
    onKeyDown={event => { const step = event.shiftKey ? 40 : 10; const moves: Record<string, Partial<StickyNote>> = { ArrowLeft: { bubbleX: Math.max(0, presentation.bubbleX-step) }, ArrowRight: { bubbleX: Math.min(Math.max(0,area.width-60), presentation.bubbleX+step) }, ArrowUp: { bubbleY: Math.max(0,presentation.bubbleY-step) }, ArrowDown: { bubbleY: Math.min(Math.max(0,area.height-60),presentation.bubbleY+step) } }; if (moves[event.key]) { event.preventDefault(); onChange(moves[event.key]); } }}
    onClick={() => { if (moved.current) { moved.current = false; return; } restore(); }}>▤</button>;
}
