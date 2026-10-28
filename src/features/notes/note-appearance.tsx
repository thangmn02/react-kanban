import type { StickyNote } from './notes-store';
import { noteColors, notePresentationPreferences } from './note-presentation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function NoteAppearance({ note, onChange, onHide, onDetach }: { note: StickyNote; onChange: (patch: Partial<StickyNote>) => void; onHide?: () => void; onDetach?: () => void }) {
  const settings = notePresentationPreferences(note);
  const [open,setOpen]=useState(false),[position,setPosition]=useState({left:8,bottom:8}),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!open)return;const place=()=>{const rectangle=trigger.current?.getBoundingClientRect();if(rectangle)setPosition({left:Math.max(8,Math.min(innerWidth-248,rectangle.right-240)),bottom:Math.max(8,innerHeight-rectangle.top+4)});};place();const close=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))setOpen(false);};const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);trigger.current?.focus();}};window.addEventListener('resize',place);window.addEventListener('scroll',place,true);document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};},[open]);
  return <div className="relative text-slate-700">
    <button type="button" ref={trigger} aria-expanded={open} className="min-h-8 cursor-pointer rounded-md px-2 py-1 text-xs hover:bg-black/5" onClick={()=>setOpen(value=>!value)}>Appearance</button>
    {open&&createPortal(<div ref={panel} aria-label="Note appearance" style={{left:position.left,bottom:position.bottom,maxHeight:Math.max(100,innerHeight-position.bottom-8)}} className="fixed z-[90] w-60 space-y-3 overflow-auto rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl">
      <label className="block">Opacity · {Math.round(settings.opacity * 100)}%<input aria-label="Note opacity" type="range" min="30" max="100" value={Math.round(settings.opacity * 100)} onChange={event => onChange({ opacity: Number(event.target.value) / 100 })} className="mt-2 w-full" /></label>
      <label className="flex items-center justify-between gap-2">Color<select aria-label="Note color" value={settings.color} onChange={event => onChange({ color: event.target.value as StickyNote['color'] })} className="min-h-8 rounded border border-slate-200 bg-white px-2">{Object.entries(noteColors).map(([value, color]) => <option key={value} value={value}>{color.label}</option>)}</select></label>
      <label className="flex items-center justify-between gap-2">Font size<select aria-label="Note font size" value={settings.fontSize} onChange={event => onChange({ fontSize: Number(event.target.value) })} className="min-h-8 rounded border border-slate-200 bg-white px-2">{[12,14,16,18,20].map(size => <option key={size} value={size}>{size}px</option>)}</select></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={settings.floating} onChange={event => onChange({ floating: event.target.checked })} />Pin floating note inside Kora</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={settings.headerVisible} onChange={event => onChange({ headerVisible: event.target.checked })} />Show title header</label>
      <button type="button" className="min-h-8 w-full rounded border border-slate-200 px-2 text-left" onClick={() => {setOpen(false);onChange({ clickThrough: true, peek: false });}}>Ghost · click through</button>
      <button type="button" className="min-h-8 w-full rounded border border-slate-200 px-2 text-left" onClick={() => {setOpen(false);onChange({ collapsed: true, bubbleX: note.x, bubbleY: note.y, peek: false, clickThrough: false });}}>Collapse to bubble</button>
      {onHide && <button type="button" className="min-h-8 w-full rounded border border-slate-200 px-2 text-left" onClick={()=>{setOpen(false);onHide();}}>Hide note</button>}
      {onDetach && <button type="button" className="min-h-8 w-full rounded border border-slate-200 px-2 text-left" onClick={()=>{setOpen(false);onDetach();}}>Open external window</button>}
      <p className="leading-5 text-slate-500">Ghost passes clicks behind this note. Restore stays separate. Sharing controls access.</p>
    </div>,document.body)}
  </div>;
}
