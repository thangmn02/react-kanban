import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { useNoteMedia } from './note-media-context';

export default function NoteImageView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const media = useNoteMedia(), [url, setUrl] = useState(''), [error, setError] = useState('');
  const drag = useRef<{ x: number; width: number } | null>(null);
  useEffect(() => {
    let alive = true, currentUrl = '', generation = 0;
    const load = async () => {
      const attempt = ++generation; URL.revokeObjectURL(currentUrl); currentUrl = ''; setUrl('');
      try { if (!media) throw Error('Image access is unavailable.'); const blob = await media.download(String(node.attrs.imageId)); if (!alive || generation !== attempt) return; currentUrl = URL.createObjectURL(blob); setUrl(currentUrl); setError(''); }
      catch (reason) { if (alive && generation === attempt) setError(reason instanceof Error ? reason.message : 'Image unavailable.'); }
    };
    void load(); const unsubscribe = media?.subscribe(() => { void load(); });
    return () => { alive = false; generation++; unsubscribe?.(); URL.revokeObjectURL(currentUrl); };
  }, [media, node.attrs.imageId]);
  return <NodeViewWrapper className={`relative my-2 max-w-full rounded ${selected ? 'ring-2 ring-blue-400' : ''}`} style={{ width: `${Number(node.attrs.width) || 280}px` }}>
    {url ? <img src={url} alt={String(node.attrs.alt || 'Note attachment')} className="block h-auto w-full rounded" draggable={false} /> : <span role="status" className="block rounded border border-dashed border-current p-3 text-xs">{error || 'Loading private image…'}</span>}
    {editor.isEditable && <button type="button" aria-label="Resize note image" title="Drag or use arrow keys to resize image" className="absolute bottom-0 right-0 h-7 w-7 touch-none rounded bg-white text-slate-800 shadow"
      onKeyDown={event => { if (['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); updateAttributes({ width: Math.max(80, Math.min(840, Number(node.attrs.width || 280) + (event.key === 'ArrowLeft' ? -20 : 20))) }); } }}
      onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, width: Number(node.attrs.width) || 280 }; }}
      onPointerMove={event => { if (drag.current) updateAttributes({ width: Math.max(80, Math.min(840, drag.current.width + event.clientX - drag.current.x)) }); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>↘</button>}
  </NodeViewWrapper>;
}
