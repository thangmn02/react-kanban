import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { BeatTrace } from '../../../extensions/kanban-music/beat-telemetry.js';
import { beatTelemetry } from '../../../extensions/kanban-music/beat-telemetry.js';
import { flashAttributes, recordCellFlash, semanticRows } from './beat-row-diagnostics';
import type { MusicBeatState } from './useMusicBeatSync';
import type { BrowserMusicSession } from './mediaBridge';

const telemetry = beatTelemetry.at('beat-renderer');
export default function SemanticBeatPattern({ session, beat, orientation = 'horizontal', melodyEnabled = true }: { session?: BrowserMusicSession; beat: MusicBeatState; orientation?: 'horizontal' | 'vertical'; melodyEnabled?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const owner = session?.playing && !session.paused && beat.mode === 'capture' && beat.sessionId === session.id
    ? `${session.id}:${beat.captureId}` : '';
  const gate = useRef({ owner: '', seen: new Set<string>(), committed: new Set<string>() });
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  const [flashes, setFlashes] = useState<{ owner: string; traces: BeatTrace[] }>({ owner: '', traces: [] });
  useEffect(() => {
    if (gate.current.owner !== owner) {
      timers.current.forEach(clearTimeout); timers.current.clear();
      gate.current = { owner, seen: new Set(Object.values(beat.telemetry || {}).map(t => t.id)), committed: new Set<string>() };
    }
    const traces = owner ? Object.values(beat.telemetry || {}).filter(t => t.source === 'onset'
      && (t.eventSource === 'cache' || t.eventSource === 'local') && t.type !== 'generic'
      && Number.isFinite(t.targetPlaybackTime) && (melodyEnabled || t.type !== 'melodic')
      && !gate.current.seen.has(t.id)) : [];
    traces.forEach(t => gate.current.seen.add(t.id));
    // Only the latest five origins are relevant; bound the lifetime identity set.
    if (gate.current.seen.size > 1024) gate.current.seen = new Set(Object.values(beat.telemetry || {}).map(t => t.id));
    if (!traces.length) return;
    const timer = setTimeout(() => { timers.current.delete(timer);
      if (gate.current.owner !== owner) return;
      // A different row's next batch must not truncate a drum's animation.
      // Bass and Melody retain their existing latest-batch presentation.
      setFlashes(previous => ({ owner, traces: [...(previous.owner === owner ? previous.traces.filter(t =>
        ['kick', 'snare', 'hat'].includes(t.type) && !traces.some(next => next.type === t.type)) : []), ...traces] }));
      const ids = new Set(traces.filter(t => ['kick', 'snare', 'hat'].includes(t.type)).map(t => t.id));
      if (ids.size) {
        const expiry = setTimeout(() => {
          timers.current.delete(expiry);
          if (gate.current.owner === owner) setFlashes(current => current.owner === owner
            ? { owner, traces: current.traces.filter(t => !ids.has(t.id)) } : current);
        }, 150);
        timers.current.add(expiry);
      }
    }, 0);
    timers.current.add(timer);
  }, [owner, beat.telemetry, melodyEnabled]);
  useEffect(() => {
    for (const element of root.current?.querySelectorAll<HTMLElement>('[data-beat-trace]') || []) {
      const trace = flashes.traces.find(t => t.id === element.dataset.beatTrace);
      if (trace && !gate.current.committed.has(trace.id)) {
        gate.current.committed.add(trace.id);
        recordCellFlash(element, 'commit');
        telemetry.record('EVENT_COMMITTED', trace, { row: Number(element.dataset.beatRow), cell: Number(element.dataset.beatCell), semantic: true });
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) recordCellFlash(element, 'animation');
      }
    }
    if (gate.current.committed.size > 1024) gate.current.committed = new Set(flashes.traces.map(t => t.id));
  }, [flashes, owner]);
  const rows = melodyEnabled ? semanticRows : semanticRows.filter(type => type !== 'melody');
  return <div ref={root} className={`music-pattern semantic-only ${orientation}`} style={{ '--beat-rows': rows.length } as CSSProperties} data-semantic-only="true" data-melody-enabled={melodyEnabled} aria-hidden="true">
    {rows.map((type, row) => {
      const trace = (type !== 'melody' || melodyEnabled) && flashes.owner === owner && owner ? flashes.traces.find(t => (t.type === 'melodic' ? 'melody' : t.type) === type) : undefined;
      // Deterministic position makes per-row routing visible without filler.
      const cell = trace ? [...trace.id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 8 : -1;
      return <div className="beat-channel" data-track={type} data-channel={type} key={type}>
        <span className="channel-icon">{row + 1}</span>
        {Array.from({ length: 8 }, (_, index) => <span key={`${index}:${index === cell ? trace?.id : ''}`}
          className={`beat-square${index === cell ? ' onset' : ''}`} {...flashAttributes(index === cell ? trace : undefined, row, index)}
          onAnimationStart={event => { if (event.target !== event.currentTarget || !trace || index !== cell) return;
            recordCellFlash(event.currentTarget, 'animation'); telemetry.record('EVENT_RENDERED', trace, { row: row + 1, cell: index + 1, semantic: true }); }} />)}
      </div>;
    })}
  </div>;
}
