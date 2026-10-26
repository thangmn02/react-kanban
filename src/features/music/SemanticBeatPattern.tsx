import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { BeatTrace } from '../../../extensions/kanban-music/beat-telemetry.js';
import { beatTelemetry } from '../../../extensions/kanban-music/beat-telemetry.js';
import { flashAttributes, recordCellFlash, semanticRows } from './beat-row-diagnostics';
import type { MusicBeatState } from './useMusicBeatSync';
import type { BrowserMusicSession } from './mediaBridge';
import {usePresentationAttacks} from './use-presentation-attacks';
import {ProjectedBeatFlash} from './projected-beat-flash';

const telemetry = beatTelemetry.at('beat-renderer');
export default function SemanticBeatPattern({ session, beat, orientation = 'horizontal', melodyEnabled = true, independentRows = false, melodyEvents, active=true, reduced=false }: { session?: BrowserMusicSession; beat: MusicBeatState; orientation?: 'horizontal' | 'vertical'; melodyEnabled?: boolean; independentRows?:boolean; melodyEvents?:readonly {id:string;duration:number}[]; active?:boolean; reduced?:boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const owner = active && session?.playing && !session.paused && !session.buffering && !session.seeking && beat.mode === 'capture' && beat.sessionId === session.id
    && (beat.sourceGeneration===undefined||session.generation===undefined||beat.sourceGeneration===session.generation)
    ? `${session.id}:${beat.captureId}:${beat.sourceGeneration??session.generation??''}:${beat.synchronizationEpoch||''}` : '';
  const projected=beat.visualAttacks!==undefined;
  const leadTrace=beat.telemetry?.['onset:melodic'];
  const attacks=usePresentationAttacks(beat.visualAttacks,owner,'semantic-only',undefined,melodyEnabled,leadTrace,
    (melodyEvents?.find(e=>e.id===leadTrace?.eventId)?.duration||beat.durations?.melody||.15)*1000);
  const gate = useRef({ owner: '', seen: new Set<string>(), committed: new Set<string>() });
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  const [flashes, setFlashes] = useState<{ owner: string; traces: BeatTrace[] }>({ owner: '', traces: [] });
  useEffect(() => {
    if (gate.current.owner !== owner) {
      timers.current.forEach(clearTimeout); timers.current.clear();
      gate.current = { owner, seen: new Set(Object.values(beat.telemetry || {}).map(t => t.id)), committed: new Set<string>() };
    }
    const traces = owner && !projected ? Object.values(beat.telemetry || {}).filter(t => t.source === 'onset'
      && (t.eventSource === 'cache' || t.eventSource === 'local') && t.type !== 'generic'
      && Number.isFinite(t.targetPlaybackTime) && (melodyEnabled || t.type !== 'melodic')
      && !gate.current.seen.has(t.id)) : [];
    traces.forEach(t => gate.current.seen.add(t.id));
    // Only the latest five origins are relevant; bound the lifetime identity set.
    if (gate.current.seen.size > 1024) gate.current.seen = new Set(Object.values(beat.telemetry || {}).map(t => t.id));
    if (!traces.length) return;
    const timer = setTimeout(() => { timers.current.delete(timer);
      if (gate.current.owner !== owner) return;
      // Every semantic row owns its expiry; another row cannot truncate it.
      setFlashes(previous => ({ owner, traces: [...(previous.owner === owner ? previous.traces.filter(t =>
        (independentRows||['kick','snare','hat'].includes(t.type))&&!traces.some(next => next.type === t.type)) : []), ...traces] }));
      for(const trace of traces.filter(t=>independentRows||['kick','snare','hat'].includes(t.type))) {
        const duration=independentRows&&trace.type==='melodic'?Math.max(150,Math.min(450,(melodyEvents?.find(e=>e.id===trace.eventId)?.duration||.15)*1000)):150;
        const expiry = setTimeout(() => {
          timers.current.delete(expiry);
          if (gate.current.owner === owner) setFlashes(current => current.owner === owner
            ? { owner, traces: current.traces.filter(t => t.id!==trace.id) } : current);
        }, duration);
        timers.current.add(expiry);
      }
    }, 0);
    timers.current.add(timer);
  }, [owner, beat.telemetry, melodyEnabled, independentRows, melodyEvents,projected]);
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
  return <div ref={root} className={`music-pattern semantic-only ${orientation}`} style={{ '--beat-rows': rows.length } as CSSProperties} data-semantic-only="true" data-melody-enabled={melodyEnabled} data-motion-reduced={reduced} aria-hidden="true">
    {rows.map((type, row) => {
      const trace = !projected && (type !== 'melody' || melodyEnabled) && flashes.owner === owner && owner ? flashes.traces.find(t => (t.type === 'melodic' ? 'melody' : t.type) === type) : undefined;
      // Deterministic position makes per-row routing visible without filler.
      const cell = trace ? [...trace.id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 8 : -1;
      return <div className="beat-channel" data-track={type} data-channel={type} key={type}>
        <span className="channel-icon">{row + 1}</span>
        {Array.from({ length: 8 }, (_, index) => <span key={`${index}:${index === cell ? trace?.id : ''}`}
          className={`beat-square${index === cell ? ' onset' : ''}`} {...flashAttributes(index === cell ? trace : undefined, row, index)}
          style={independentRows&&type==='melody'?{'--melody-trail':`${Math.max(150,Math.min(450,(melodyEvents?.find(e=>e.id===trace?.eventId)?.duration||.15)*1000))}ms`} as CSSProperties:undefined}
          onAnimationStart={event => { if (event.target !== event.currentTarget || !trace || index !== cell) return;
            recordCellFlash(event.currentTarget, 'animation'); telemetry.record('EVENT_RENDERED', trace, { row: row + 1, cell: index + 1, semantic: true }); }} >
          {attacks.filter(a=>(a.band==='clap'?'snare':a.band)===type&&[...a.key].reduce((sum,c)=>sum+c.charCodeAt(0),0)%8===index)
            .map(attack=><ProjectedBeatFlash key={attack.key} attack={attack} row={row} cell={index} semanticOnly reduced={reduced}/>)}
        </span>)}
      </div>;
    })}
  </div>;
}
