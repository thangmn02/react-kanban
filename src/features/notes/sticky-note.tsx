import {NoteMediaProvider} from './note-media-provider';
import { connectedNoteMedia } from './connected-note-media';
import { useEffect, useRef, useState } from 'react';
import MiniEditor from './mini-editor';
import type { StickyNote } from './notes-store';
import { beginNoteShake, moveNoteShake, noteColors, noteMode, notePresentationPreferences, reachableBubble, type NoteShake } from './note-presentation';
import NoteAppearance from './note-appearance';
import NoteBubble from './note-bubble';
import { deviceNoteMedia, type NoteMedia } from './note-media';
import type { StorageScope } from '../../shared/storage/storageAdapter';

interface Props {
  note: StickyNote; onChange: (patch: Partial<StickyNote>) => void;
  tasks: { id: string; title: string }[]; boardId: string | null;
  onConvert: () => Promise<void>; onOpenTask: () => void;
  readOnly?: boolean; ownerLabel?: string; onDetails?: () => void; onConvertSelection?: (text: string) => void; conversionPending?: boolean;
  onHide?: () => void; onDetach?: () => void;
  media?: NoteMedia; assetScope?: StorageScope; connectedMedia?: { userId: string; ensureSaved: () => Promise<void> };
}
export default function StickyNoteCard(props: Props) {
  return <NoteMediaCard key={`${props.connectedMedia?.userId??props.assetScope?.userId}:${props.assetScope?.workspaceId}:${props.note.id}`} {...props}/>;
}
function NoteMediaCard(props:Props){
  const actor = props.connectedMedia?.userId, userId = props.assetScope?.userId, workspaceId = props.assetScope?.workspaceId, id = props.note.id;
  const [media] = useState(() => actor ? connectedNoteMedia(actor, id,props.connectedMedia!.ensureSaved) : userId !== undefined ? deviceNoteMedia({ userId, workspaceId: workspaceId ?? null }, id) : null);
  return <NoteMediaProvider media={props.media ?? media}><NoteCard {...props} /></NoteMediaProvider>;
}
function NoteCard({ note, onChange, tasks, boardId, onConvert, onOpenTask, readOnly = false, ownerLabel, onDetails, onConvertSelection, conversionPending = false, onHide, onDetach }: Props) {
  const [item, setItem] = useState(''), [busy, setBusy] = useState(false);
  const gesture = useRef<{ pointer: number; x: number; y: number; originalX: number; originalY: number; lastX: number; direction: number; turns: number; started: number; shake?: NoteShake } | null>(null);
  const wrapper = useRef<HTMLDivElement | null>(null), [area, setArea] = useState({ width: innerWidth, height: innerHeight - 160 });
  useEffect(() => {
    const measure = () => { const canvas = wrapper.current?.closest<HTMLElement>('[data-notes-canvas]'); if (canvas) setArea({ width: canvas.clientWidth, height: Math.max(60, Math.min(canvas.clientHeight, innerHeight - canvas.getBoundingClientRect().top - 96)) }); };
    const frame = requestAnimationFrame(measure), canvas = wrapper.current?.closest('[data-notes-canvas]');
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure); if (canvas) observer?.observe(canvas);
    window.addEventListener('resize', measure); return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  const mode = noteMode(note), presentation = notePresentationPreferences(note), color = noteColors[presentation.color], bubble = reachableBubble(note, area);
  const ghost = mode === 'PEEK' || mode === 'CLICK_THROUGH', collapsed = mode === 'COLLAPSED';
  const label = note.title || 'Untitled note';
  const button = 'min-h-8 rounded-md px-2 text-xs text-inherit opacity-80 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-blue-600';
  return <div ref={wrapper} hidden={presentation.hidden} data-note-mode={mode} className="pointer-events-none relative mb-4 w-full md:absolute md:mb-0 md:w-[var(--note-width)] md:translate-x-[var(--note-x)] md:translate-y-[var(--note-y)]" style={{ '--note-width': `${collapsed ? 60 : note.expanded ? Math.max(480, note.width) : note.width}px`, '--note-x': `${collapsed ? bubble.x : note.x}px`, '--note-y': `${collapsed ? bubble.y : note.y}px`, '--note-font-size': `${presentation.fontSize}px` } as React.CSSProperties}>
    <article aria-label={`Note: ${label}`} inert={ghost || collapsed} className={`flex w-full flex-col overflow-hidden rounded-2xl border shadow-[0_6px_22px_rgba(40,35,15,0.06)] transition-opacity duration-150 motion-reduce:transition-none ${ghost || collapsed ? 'pointer-events-none' : 'pointer-events-auto'}`} style={{ height: note.minimized ? 'auto' : note.height, display: collapsed ? 'none' : undefined, opacity: mode === 'PEEK' ? 0.08 : presentation.opacity, color: color.text, background: color.surface, borderColor: color.border }}>
      <header style={{ display: presentation.headerVisible ? undefined : 'none' }} className="flex shrink-0 items-center gap-1 border-b border-black/5 p-2">
        <button type="button" aria-label={`Move note: ${label}`} title="Drag; arrow keys move; shake horizontally to Peek" className={`${button} touch-none cursor-grab`}
          onKeyDown={event => { const step = event.shiftKey ? 40 : 10; const moves: Record<string, Partial<StickyNote>> = { ArrowLeft: { x: note.x - step }, ArrowRight: { x: note.x + step }, ArrowUp: { y: note.y - step }, ArrowDown: { y: note.y + step } }; if (moves[event.key]) { event.preventDefault(); onChange(moves[event.key]); } }}
          onPointerDown={event => { const canvas = event.currentTarget.closest('[data-notes-canvas]')?.getBoundingClientRect(); if (!canvas || innerWidth < 768) return; event.currentTarget.setPointerCapture(event.pointerId); gesture.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, originalX: note.x, originalY: note.y, lastX: event.clientX, direction: 0, turns: 0, started: performance.now(), shake: beginNoteShake(event.clientX,event.clientY,performance.now()) }; }}
          onPointerMove={event => { const start = gesture.current; if (!start || start.pointer !== event.pointerId) return; if (start.shake && moveNoteShake(start.shake,event.clientX,event.clientY,performance.now())) { gesture.current = null; onChange({ peek: true }); return; } const canvas = event.currentTarget.closest('[data-notes-canvas]') as HTMLElement | null; onChange({ x: Math.min(Math.max(0, (canvas?.clientWidth ?? 1000) - (note.expanded ? Math.max(480,note.width) : note.width)), Math.max(0, start.originalX + event.clientX - start.x)), y: Math.min(2000, Math.max(0, start.originalY + event.clientY - start.y)) }); }}
          onPointerUp={() => { gesture.current = null; }} onPointerCancel={() => { gesture.current = null; }} onLostPointerCapture={() => { gesture.current = null; }}>⠿</button>
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
        <button type="button" aria-label="Pin note" aria-pressed={note.pinned} className={button} onClick={() => onChange({ pinned: !note.pinned })}>{note.pinned ? 'Pinned' : 'Pin'}</button>
        <button type="button" aria-label="Minimize note" aria-expanded={!note.minimized} className={button} onClick={() => onChange({ minimized: !note.minimized })}>{note.minimized ? '+' : '−'}</button>
      </header>
      <div hidden={note.minimized} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {ownerLabel && <p className="text-xs opacity-80">Owner: {ownerLabel}{readOnly ? ' · Read only' : ''}</p>}
        <input aria-label="Note title" readOnly={readOnly} maxLength={160} value={note.title} placeholder="Untitled note" onChange={event => onChange({ title: event.target.value })} className="w-full bg-transparent text-base font-semibold text-inherit outline-none focus-visible:ring-2 focus-visible:ring-blue-500" />
        <MiniEditor html={note.html} compact={!note.expanded} readOnly={readOnly} onConvertSelection={onConvertSelection} conversionPending={conversionPending} onChange={html => onChange({ html })} />
        <button type="button" className={button} onClick={() => onChange({ expanded: !note.expanded })}>{note.expanded ? 'Compact preview' : 'Edit / expand'}</button>
        <ul className="space-y-2">{note.checklist.map(check => <li key={check.id}><label className="flex items-start gap-2 text-sm text-inherit"><input type="checkbox" disabled={readOnly} checked={check.isDone} onChange={event => onChange({ checklist: note.checklist.map(row => row.id === check.id ? { ...row, isDone: event.target.checked } : row) })} /><span className={check.isDone ? 'line-through opacity-60' : ''}>{check.text}</span></label></li>)}</ul>
        {!readOnly && <form className="flex gap-1" onSubmit={event => { event.preventDefault(); if (item.trim() && note.checklist.length < 100) { onChange({ checklist: [...note.checklist, { id: crypto.randomUUID(), text: item.trim(), isDone: false }] }); setItem(''); } }}><input aria-label="Checklist item" maxLength={500} placeholder="Add checklist item" value={item} onChange={event => setItem(event.target.value)} className="min-w-0 flex-1 rounded border border-amber-200 bg-white/50 px-2 py-1 text-sm" /><button className={button} type="submit">Add</button></form>}
        <label className="block text-xs opacity-80">Link to task<select disabled={readOnly} aria-label="Link to task" className="mt-1 w-full rounded border border-amber-200 bg-white/50 p-2 text-xs" value={note.taskBoardId === boardId ? note.taskId ?? '' : ''} onChange={event => onChange({ taskId: event.target.value || null, taskBoardId: event.target.value ? boardId : null })}><option value="">No linked task</option>{tasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
        {note.taskId && <button type="button" className={button} onClick={onOpenTask}>Open linked task</button>}
        {!readOnly && <button type="button" disabled={busy || conversionPending || !!note.convertedTaskId || !boardId || !note.title.trim()} className={`${button} border border-amber-200 disabled:opacity-50`} onClick={async () => { if (busy) return; setBusy(true); try { await onConvert(); } finally { setBusy(false); } }}>{note.convertedTaskId ? 'Converted to task' : busy ? 'Converting…' : 'Convert note to task'}</button>}
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-amber-200/60 px-2 py-1">
        <button type="button" className={button} onClick={() => onChange({ peek: true })}>Peek</button>
        <NoteAppearance note={note} onChange={onChange} onHide={onHide} onDetach={onDetach} />
        {onDetails && <button type="button" className={button} onClick={onDetails}>Sharing & comments</button>}
        {!note.minimized && <button type="button" aria-label="Resize note" title="Arrow keys resize" className={`${button} touch-none cursor-nwse-resize`}
          onKeyDown={event => { const dimensions: Record<string, Partial<StickyNote>> = { ArrowRight: { width: note.width + 20 }, ArrowLeft: { width: note.width - 20 }, ArrowDown: { height: note.height + 20 }, ArrowUp: { height: note.height - 20 } }; if (dimensions[event.key]) { event.preventDefault(); onChange(dimensions[event.key]); } }}
          onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); gesture.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, originalX: note.width, originalY: note.height, lastX: 0, direction: 0, turns: 0, started: 0 }; }}
          onPointerMove={event => { const start = gesture.current; if (start?.pointer === event.pointerId) onChange({ width: start.originalX + event.clientX - start.x, height: start.originalY + event.clientY - start.y }); }}
          onPointerUp={() => { gesture.current = null; }} onPointerCancel={() => { gesture.current = null; }} onLostPointerCapture={() => { gesture.current = null; }}>↘</button>}
      </footer>
    </article>
    {ghost && <button type="button" onClick={() => onChange({ peek: false, clickThrough: false })} className="pointer-events-auto absolute left-3 top-2 min-h-11 rounded-lg bg-white px-3 text-sm font-semibold text-blue-700 shadow ring-1 ring-blue-100">Restore note: {label}</button>}
    {collapsed && <NoteBubble note={note} onChange={onChange} area={area} />}
  </div>;
}
