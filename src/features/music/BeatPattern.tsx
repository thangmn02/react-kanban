import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { BeatBand, BrowserMusicSession } from './mediaBridge';
import type { MusicBeatState } from './useMusicBeatSync';
import SemanticBeatPattern from './SemanticBeatPattern';
import {SemanticMotionPattern} from './semantic-motion-pattern';
import type {MotionProfile} from './semantic-motion';
import { flashAttributes, getSemanticMode, recordCellFlash, subscribeSemanticMode } from './beat-row-diagnostics';
import { beatTelemetry, type BeatTrace } from '../../../extensions/kanban-music/beat-telemetry.js';
import {usePresentationAttacks} from './use-presentation-attacks';
import {ProjectedBeatFlash} from './projected-beat-flash';
import {BeatHeartbeat} from './beat-heartbeat';
import {useMotionReduction} from './use-motion-reduction';
import {beatPresentationDiagnostics} from './beat-presentation-diagnostics';
const telemetry = beatTelemetry.at('beat-renderer');
import {
  activeSteps, beatBands, productBeatBands, channelColors, effectNames, isShapeCell, momentDelay,
  nextDifferent, patternAt, pulseDelay, reshuffleEpoch, shapeNames, hashText, trackNames, momentFlashMs, momentDuration,
  type BeatColorMode, type BeatPalette, type BeatPatternName, type MomentEffect, type MomentShape,
} from './beatVisuals';

interface Moment {
  id: number;
  captureKey: string;
  shape: MomentShape;
  effect: MomentEffect;
  telemetry?: BeatTrace;
  parentId?: string;
}

interface RowVisual {
  count: number;
  pattern: BeatPatternName;
  epoch: number;
  trace?: BeatTrace;
}

interface SemanticFlash {
  count: number;
  trace?: BeatTrace;
  step: number;
  expiresAt: number;
  active: boolean;
}

interface BeatPatternProps {
  session?: BrowserMusicSession;
  beat: MusicBeatState;
  colorMode?: BeatColorMode;
  palette?: BeatPalette;
  orientation?: 'horizontal' | 'vertical';
  semanticOnly?: boolean;
  /** Private diagnostics can explicitly restore the retained fifth row. */
  melodyEnabled?: boolean;
  independentRows?:boolean;
  melodyEvents?:readonly {id:string;duration:number}[];
  motionProfile?:MotionProfile|'legacy';
  motionReduced?:boolean;
  motionActive?:boolean;
  lateLivePreview?:boolean;
}

export default function BeatPattern({ session, beat, colorMode = 'random', palette = 'bloom', orientation = 'horizontal', semanticOnly: requestedMode, melodyEnabled = false, independentRows = false, melodyEvents,motionProfile='legacy',motionReduced=false,motionActive=true,lateLivePreview=false }: BeatPatternProps) {
  const configuredMode = useSyncExternalStore(subscribeSemanticMode, getSemanticMode);
  const semanticOnly = requestedMode ?? configuredMode;
  const systemReduced=useMotionReduction();
  const reduced=motionReduced||systemReduced;
  if(motionProfile!=='legacy')return <SemanticMotionPattern session={session} beat={beat} profile={motionProfile} orientation={orientation}
    melodyEnabled={melodyEnabled} semanticOnly={semanticOnly} melodyEvents={melodyEvents} active={motionActive} reduced={reduced} lateLivePreview={lateLivePreview}/>;
  return semanticOnly ? <SemanticBeatPattern session={session} beat={beat} orientation={orientation} melodyEnabled={melodyEnabled} independentRows={independentRows} melodyEvents={melodyEvents} active={motionActive} reduced={reduced}/>
    : <NormalBeatPattern session={session} beat={beat} colorMode={colorMode} palette={palette} orientation={orientation} melodyEnabled={melodyEnabled} independentRows={independentRows} melodyEvents={melodyEvents} motionActive={motionActive} motionReduced={reduced}/>;
}

function NormalBeatPattern({ session, beat, colorMode = 'random', palette = 'bloom', orientation = 'horizontal', melodyEnabled = false, independentRows = false, melodyEvents, motionActive=true, motionReduced=false }: BeatPatternProps) {
  const bands = melodyEnabled ? beatBands : productBeatBands;
  const rowCount = melodyEnabled ? 5 : 4;
  const root = useRef<HTMLDivElement>(null);
  const committed = useRef(new Set<string>());
  const [visible,setVisible]=useState(()=>!document.hidden);
  useEffect(()=>{const update=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  const capture = motionActive && visible && session?.playing === true && !session.paused && !session.buffering && !session.seeking && beat.mode === 'capture' && beat.sessionId === session.id
    && (beat.sourceGeneration===undefined||session.generation===undefined||beat.sourceGeneration===session.generation);
  const generation=beat.sourceGeneration??session?.generation??'';
  const captureKey = capture ? `${session.id}:${beat.captureId || 'legacy'}:${generation}:${beat.synchronizationEpoch||''}:${beat.tempo?.locked ? 'tempo' : 'accent'}` : '';
  const privateSemanticFlashes = independentRows || session?.syncState?.capability?.privateCandidate === true;
  const melodyCaptureKey = capture ? `${session.id}:${beat.captureId || 'legacy'}:${generation}:${beat.synchronizationEpoch||''}` : '';
  const projected=beat.visualAttacks!==undefined;
  const songSeconds = session?.currentTime || 0;
  const epoch = reshuffleEpoch(songSeconds, beat.tempo?.locked ? beat.tempo.bpm : null);
  const pattern = patternAt(songSeconds);
  const diagnostics = useRef({ traces: beat.telemetry, captureId: beat.captureId, pattern, epoch });
  // Metadata and visual pattern changes must not retrigger the existing pulses.
  useEffect(() => { diagnostics.current = { traces: beat.telemetry, captureId: beat.captureId, pattern, epoch }; }, [beat.telemetry, beat.captureId, pattern, epoch]);
  // Semantic rows always reflect detected onsets. Structural tempo can still
  // retrigger an intentional decorative shape without claiming an instrument.
  const counts = beat.onsets;
  const kickCount = counts.kick || 0;
  const clapCount = counts.clap || 0;
  const hatCount = counts.hat || 0;
  const bassCount = counts.bass || 0;
  const melodyCount = melodyEnabled ? counts.melody || 0 : 0;
  const onsetTotal = bands.reduce((sum, band) => sum + (beat.onsets[band] || 0), 0);
  const tickTotal = beat.tempo?.locked ? beat.tickCount || 0 : 0;
  const degraded = capture && beat.eventPath === 'degraded';
  const audioLive = capture && (!beat.rates || bands.some((band) => (beat.rates?.[band] || 0) > 0)
    || (melodyEnabled && beat.melody?.active === true && beat.melody.level > 0) || degraded && tickTotal > 0);
  const [pulse, setPulse] = useState<{ captureKey: string; semanticOwner?: string; counts: Partial<Record<BeatBand, number>>; active: Partial<Record<BeatBand, boolean>>; expires?: Partial<Record<BeatBand, number>>; visuals?: Partial<Record<BeatBand, RowVisual>>; semanticFlashes?: Partial<Record<BeatBand, SemanticFlash>>; rawTotal: number; tickTotal: number; shapeHit: boolean; parent?: BeatTrace; telemetry?: Record<string, BeatTrace> }>({
    captureKey, semanticOwner: melodyCaptureKey, counts, active: {}, rawTotal: onsetTotal, tickTotal, shapeHit: false,
  });
  useEffect(() => {
    const nextCounts = { kick: kickCount, clap: clapCount, hat: hatCount, bass: bassCount, melody: melodyCount };
    const traces = diagnostics.current.traces;
    const parent = traces?.['tempo:generic'];
    const generated = degraded ? telemetry.events('random', ['generic'], { captureId: beat.captureId })?.[0] : undefined;
    const decoration = generated ? { ...generated, origin: 'visual-decoration' as const, targetPlaybackTime: parent?.targetPlaybackTime } : undefined;
    if (decoration) telemetry.record('EVENT_QUEUED', decoration, { semantic: false, parentId: traces?.['tempo:generic']?.id });
    const timer = setTimeout(() => setPulse((previous) => {
      const now = Date.now();
      const active: Partial<Record<BeatBand, boolean>> = {};
      const expires: Partial<Record<BeatBand, number>> = {};
      const visuals: Partial<Record<BeatBand, RowVisual>> = {};
      const semanticFlashes = privateSemanticFlashes && melodyCaptureKey === previous.semanticOwner ? { ...previous.semanticFlashes } : {};
      for (const band of bands) {
        const hit = capture && captureKey === previous.captureKey && nextCounts[band] > (previous.counts[band] || 0);
        const percussion = band !== 'melody';
        if (percussion && capture && captureKey === previous.captureKey) {
          // Another row must not remove this row before its CSS animation runs.
          // Keep the existing duration and decorative delays, with one bounded expiry per row.
          const visualPattern = diagnostics.current.pattern;
          const continuing = (previous.expires?.[band] || 0) > now;
          const expiry = hit && !continuing ? now + (visualPattern === 'wave' || visualPattern === 'ripple' ? 980 : 220) : previous.expires?.[band] || 0;
          active[band] = expiry > now;
          if (active[band]) {
            expires[band] = expiry;
            // Coalesce decorative retriggers while the selected geometry finishes.
            // New musical events still receive a separate immediate semantic flash.
            visuals[band] = continuing && previous.visuals?.[band] ? previous.visuals[band] : {
              count: nextCounts[band], pattern: visualPattern, epoch: diagnostics.current.epoch,
              trace: traces?.[`onset:${band === 'clap' ? 'snare' : band}`],
            };
          }
        } else active[band] = hit;
        const semanticHit = capture && melodyCaptureKey === previous.semanticOwner && nextCounts[band] > (previous.counts[band] || 0);
        if (!projected && privateSemanticFlashes && semanticHit && ['kick', 'clap', 'hat'].includes(band)) {
          semanticFlashes[band] = { count: nextCounts[band], trace: traces?.[`onset:${band === 'clap' ? 'snare' : band}`],
            step: activeSteps(session?.id || 'empty', visuals[band]?.epoch ?? diagnostics.current.epoch, bands.indexOf(band)).findIndex(Boolean),
            expiresAt: now + 150, active: true };
        }
        // The measured Bass hold can outlive its decorative animation. Keep
        // its cell allocation until another Bass attack or owner reset.
        if (band === 'bass' && !visuals.bass && capture && captureKey === previous.captureKey) visuals.bass = previous.visuals?.bass;
      }
      return { captureKey, semanticOwner: melodyCaptureKey, counts: nextCounts, rawTotal: onsetTotal, tickTotal, active, expires, visuals, semanticFlashes,
        parent: tickTotal > previous.tickTotal ? traces?.['tempo:generic'] : bands
          .filter(band => nextCounts[band] > (previous.counts[band] || 0))
          .map(band => traces?.[`onset:${band === 'clap' ? 'snare' : band === 'melody' ? 'melodic' : band}`]).find(Boolean),
        ...(traces || decoration ? { telemetry: { ...traces, ...(decoration ? { 'random:generic': decoration } : {}) } } : {}),
        shapeHit: audioLive && captureKey === previous.captureKey
          && (onsetTotal > previous.rawTotal || tickTotal > previous.tickTotal),
      }; }), 0);
    return () => clearTimeout(timer);
  }, [capture, audioLive, captureKey, melodyCaptureKey, kickCount, clapCount, hatCount, bassCount, melodyCount, onsetTotal, tickTotal, degraded, beat.captureId, bands, privateSemanticFlashes, session?.id,projected]);
  useEffect(() => {
    const deadlines = [...Object.values(pulse.expires || {}), ...Object.values(pulse.semanticFlashes || {}).filter(flash => flash.active).map(flash => flash.expiresAt)];
    if (!deadlines.length || pulse.captureKey !== captureKey) return;
    const timer = setTimeout(() => setPulse(previous => {
      const active = { ...previous.active }, expires = { ...previous.expires };
      const semanticFlashes = { ...previous.semanticFlashes };
      for (const [band, flash] of Object.entries(semanticFlashes)) {
        if (flash.active && flash.expiresAt <= Date.now()) semanticFlashes[band as BeatBand] = { ...flash, active: false };
      }
      for (const band of ['kick', 'clap', 'hat', 'bass'] as const) {
        if (expires[band] !== undefined && expires[band]! <= Date.now()) {
          active[band] = false;
          delete expires[band];
        }
      }
      return { ...previous, active, expires, semanticFlashes };
    }), Math.max(0, Math.min(...deadlines) - Date.now()));
    return () => clearTimeout(timer);
  }, [pulse.expires, pulse.semanticFlashes, pulse.captureKey, captureKey]);
  const newOnsets = pulse.captureKey === captureKey ? pulse.active : {};
  const melodyLive = melodyEnabled && capture && beat.melody?.active === true && beat.melody.level > 0;
  const melodyNote = beat.melody?.note || 0;
  const melodyGate = useRef({ captureKey: '', active: false, note: 0, sequence: 0 });
  const [melodyFlash, setMelodyFlash] = useState<{ captureKey: string; id: number; telemetry?: BeatTrace } | null>(null);
  useEffect(() => {
    if(projected)return;
    const previous = { ...melodyGate.current };
    const gate = melodyGate.current;
    Object.assign(gate, { captureKey: melodyCaptureKey, active: melodyLive, note: melodyNote });
    if (!melodyCaptureKey || previous.captureKey !== melodyCaptureKey) {
      const reset = setTimeout(() => setMelodyFlash(null), 0);
      return () => clearTimeout(reset);
    }
    if (!(melodyLive && melodyNote > previous.note)) return;
    const id = ++gate.sequence;
    const trace = diagnostics.current.traces?.['onset:melodic'];
    // A new instrumental note triggers a short flash. Sustain and levels do not.
    const start = setTimeout(() => setMelodyFlash({ captureKey: melodyCaptureKey, id,
      ...(trace ? { telemetry: trace } : {}) }), 0);
    return () => clearTimeout(start);
  }, [melodyCaptureKey, melodyLive, melodyNote,projected]);
  useEffect(() => {
    if (!melodyFlash) return;
    const end = setTimeout(() => setMelodyFlash(null), 150);
    return () => clearTimeout(end);
  }, [melodyFlash]);
  const melodyHit = capture && melodyFlash?.captureKey === melodyCaptureKey && melodyLive;

  const bassGate = useRef({ captureKey: '', count: 0 });
  const [bassFlash, setBassFlash] = useState<{ captureKey: string; count: number; duration: number } | null>(null);
  const bassDuration = Math.max(150, Math.min(2, beat.durations?.bass || 0) * 1000);
  useEffect(() => {
    if(projected)return;
    const previous = { ...bassGate.current };
    Object.assign(bassGate.current, { captureKey: melodyCaptureKey, count: bassCount });
    const next = melodyCaptureKey && previous.captureKey === melodyCaptureKey && bassCount > previous.count
      ? { captureKey: melodyCaptureKey, count: bassCount, duration: bassDuration } : null;
    if (!next && previous.captureKey === melodyCaptureKey) return;
    const start = setTimeout(() => setBassFlash(next), 0);
    return () => clearTimeout(start);
  }, [melodyCaptureKey, bassCount, bassDuration,projected]);
  useEffect(() => {
    if (!bassFlash) return;
    const end = setTimeout(() => setBassFlash(null), bassFlash.duration);
    return () => clearTimeout(end);
  }, [bassFlash]);
  const bassHeld = audioLive && bassFlash?.captureKey === melodyCaptureKey;

  const [presentation,setPresentation]=useState<{state:'NORMAL'|'EXCLUSIVE_ACTIVE'|'EXCLUSIVE_EXIT';moment:Moment|null}>({state:'NORMAL',moment:null});
  const moment=presentation.moment;
  const momentGate = useRef<{ captureKey: string; previousTotal: number; nextAt: number; lastShape?: MomentShape; lastEffect?: MomentEffect }>({
    captureKey: '', previousTotal: 0, nextAt: 0,
  });
  const momentTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useLayoutEffect(() => {
    const gate = momentGate.current;
    if (!audioLive) {
      gate.captureKey = '';
      momentTimers.current.forEach(clearTimeout);
      momentTimers.current = [];
      momentTimers.current.push(setTimeout(() => setPresentation({state:'NORMAL',moment:null}), 0));
      return;
    }
    if (gate.captureKey !== captureKey) {
      momentTimers.current.forEach(clearTimeout);
      momentTimers.current = [];
      if(moment)setPresentation({state:'NORMAL',moment:null});
      gate.captureKey = captureKey;
      gate.previousTotal = onsetTotal;
      gate.nextAt = songSeconds + 35 + Math.random() * 10;
      gate.lastShape = undefined;
      gate.lastEffect = undefined;
      return;
    }
    if (onsetTotal <= gate.previousTotal) return;
    gate.previousTotal = onsetTotal;
    if (songSeconds < gate.nextAt || moment?.captureKey === captureKey) return;
    const shape = nextDifferent(shapeNames, gate.lastShape, Math.random());
    const effect = nextDifferent(effectNames, gate.lastEffect, Math.random());
    gate.lastShape = shape;
    gate.lastEffect = effect;
    gate.nextAt = songSeconds + 35 + Math.random() * 10;
    const parent = Object.values(diagnostics.current.traces || {}).filter((t) => t.source === 'onset')
      .sort((a, b) => (b.targetPlaybackTime ?? b.detectedAt) - (a.targetPlaybackTime ?? a.detectedAt))[0];
    const generated = telemetry.events('random', ['generic'], { captureId: diagnostics.current.captureId })?.[0];
    const decoration = generated ? { ...generated, origin: 'visual-decoration' as const, targetPlaybackTime: parent?.targetPlaybackTime } : undefined;
    telemetry.record('EVENT_QUEUED', decoration, { semantic: false, parentId: parent?.id });
    const next = { id: Date.now(), captureKey, shape, effect, ...(decoration ? { telemetry: decoration, parentId: parent?.id } : {}) };
    // A real onset triggers each moment; the timers only end its visual state.
    momentTimers.current.forEach(clearTimeout);
    setPresentation({state:'EXCLUSIVE_ACTIVE',moment:next});
    momentTimers.current = [
      setTimeout(() => {
        setPresentation(current=>current.moment?.id===next.id?{state:'EXCLUSIVE_EXIT',moment:next}:current);
        setPulse(current=>({...current,active:{},expires:{},semanticFlashes:{},visuals:{}}));setBassFlash(null);setMelodyFlash(null);
      }, momentDuration(effect, next.id, rowCount)),
      setTimeout(()=>setPresentation(current=>current.moment?.id===next.id?{state:'NORMAL',moment:null}:current),momentDuration(effect,next.id,rowCount)+120)];
  }, [audioLive, captureKey, moment, onsetTotal, songSeconds, rowCount]);
  useEffect(() => () => { momentTimers.current.forEach(clearTimeout); }, []);
  const liveMoment = audioLive && presentation.state==='EXCLUSIVE_ACTIVE' && moment?.captureKey === captureKey ? moment : null;
  const presentationState=capture&&audioLive&&moment?.captureKey===captureKey?presentation.state:'NORMAL';
  const exclusive=presentationState!=='NORMAL';
  const leadTrace=beat.telemetry?.['onset:melodic'];
  const leadDuration=(melodyEvents?.find(e=>e.id===leadTrace?.eventId)?.duration||beat.durations?.melody||.15)*1000;
  const attacks=usePresentationAttacks(beat.visualAttacks,melodyCaptureKey,'normal',exclusive?'pattern-exclusive':undefined,melodyEnabled,leadTrace,leadDuration);
  const suppressedTraces=useRef(new Set<string>());
  useEffect(()=>{
    if(projected||!exclusive)return;
    for(const trace of Object.values(beat.telemetry||{}))if(trace.source==='onset'&&!suppressedTraces.current.has(trace.id)){
      suppressedTraces.current.add(trace.id);
      beatPresentationDiagnostics.record({key:trace.id,band:trace.type,stage:'gate',reason:'pattern-exclusive',owner:melodyCaptureKey,profile:'normal',deadlineMs:trace.targetTime});
    }
    if(suppressedTraces.current.size>1024)suppressedTraces.current=new Set(Object.values(beat.telemetry||{}).map(t=>t.id));
  },[projected,exclusive,beat.telemetry,melodyCaptureKey]);
  // A DOM commit and a CSS animation start are separate observations. The
  // latter includes the existing decorative CSS delay, not physical scan-out.
  useEffect(() => {
    if (!beatTelemetry.enabled || !root.current) return;
    for (const cell of root.current.querySelectorAll<HTMLElement>('[data-beat-trace]')) recordCellFlash(cell, 'commit');
    const available = projected||exclusive ? [] : Object.values(pulse.telemetry || {}).filter((t) => t.type !== 'generic' && t.type !== 'melodic');
    if(!projected&&!exclusive)for (const visual of Object.values(pulse.visuals || {})) if (visual?.trace && !available.some(t => t.id === visual.trace!.id)) available.push(visual.trace);
    if (degraded && pulse.telemetry?.['random:generic']) available.push(pulse.telemetry['random:generic']);
    if (!projected&&!exclusive&&melodyFlash?.telemetry) available.push(melodyFlash.telemetry);
    if (liveMoment?.telemetry) available.push(liveMoment.telemetry);
    const current = new Set(available.map((trace) => trace.id));
    for (const id of committed.current) if (!current.has(id)) committed.current.delete(id);
    for (const trace of available) {
      if (committed.current.has(trace.id)) continue;
      committed.current.add(trace.id);
      const cells = [...root.current.querySelectorAll<HTMLElement>('[data-beat-trace]')].filter((cell) => cell.dataset.beatTrace === trace.id);
      if (!cells.length) {
        telemetry.record('EVENT_DROPPED', trace, { reason: 'renderer-mask' });
        continue;
      }
      telemetry.record('EVENT_COMMITTED', trace, { semantic: trace.source === 'onset', parentId: liveMoment?.parentId });
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) telemetry.record('EVENT_RENDERED', trace);
    }
  }, [beat.telemetry, beat.tempo?.locked, pulse, melodyFlash, liveMoment, degraded,projected,exclusive]);

  const rendered = (trace?: BeatTrace, delayMs = 0, parentId?: string) => {
    if (trace) telemetry.record('EVENT_RENDERED', trace, { semantic: trace.source === 'onset', delayMs, parentId });
  };

  return <div ref={root} className={`music-pattern${capture ? ' live' : ''}${capture && !degraded && colorMode === 'flow' ? ' flow' : ''}${liveMoment ? ' moment' : ''}${palette === 'ultraviolet' ? ' ultraviolet' : ''} ${orientation}`}
    style={{ '--beat-rows': rowCount } as CSSProperties}
    data-pattern={pattern} data-event-path={beat.eventPath || 'local'} data-reshuffle={epoch} data-moment={liveMoment?.shape || ''}
    data-presentation-state={presentationState} data-pattern-owner={exclusive?`${moment?.captureKey}:${moment?.id}`:undefined} data-motion-reduced={motionReduced}
    data-moment-source={liveMoment ? 'accent' : ''} data-moment-effect={liveMoment?.effect || ''} aria-hidden="true">
    {/* Generic timing belongs to the frame, never to an instrument row. */}
    <BeatHeartbeat owner={capture&&!exclusive?melodyCaptureKey:''} beat={beat} reduced={motionReduced}/>
    {degraded && !exclusive && pulse.captureKey === captureKey && pulse.shapeHit && <span
      key={`decoration:${captureKey}:${pulse.tickTotal}`} className="decorative-tempo-pulse"
      {...flashAttributes(pulse.telemetry?.['random:generic'])}
      data-semantic="false" data-presentation="decorative-global" data-detector-origin="tempo-fallback"
      data-parent-id={pulse.telemetry?.['tempo:generic']?.id}
      onAnimationStart={event => { if (event.target !== event.currentTarget) return;
        recordCellFlash(event.currentTarget, 'animation'); rendered(pulse.telemetry?.['random:generic'], 0, pulse.telemetry?.['tempo:generic']?.id); }} />}
    {bands.map((band, row) => {
      const visual = capture && pulse.captureKey === captureKey && (pulse.active[band] || band === 'bass' && bassHeld) ? pulse.visuals?.[band] : undefined;
      const steps = activeSteps(session?.id || 'empty', visual?.epoch ?? epoch, row);
      const colors = channelColors(colorMode, palette, session?.id || 'empty', visual?.epoch ?? epoch, row, rowCount);
      const rowStyle = { '--c': colors.hit, '--ci': colors.idle, '--hue-delay': `${row * -2.25}s` } as CSSProperties;
      const percussion = band === 'kick' || band === 'clap' || band === 'hat';
      const semanticFlash = privateSemanticFlashes && percussion && pulse.semanticOwner === melodyCaptureKey ? pulse.semanticFlashes?.[band] : undefined;
      const visualCount = visual?.count ?? (percussion ? pulse.counts[band] || 0 : counts[band] || 0);
      const eventCount = pulse.counts[band] || 0;
      const rowPattern = visual?.pattern ?? pattern;
      const retrigger = visual && eventCount !== visual.count;
      const pulseSeed = hashText(`${captureKey}:${band}:${visualCount}`);
      // Preserve decorative delays/masks but guarantee one immediate semantic
      // cell. A visual shape must never consume a detector's scheduled attack.
      const semanticStep = steps.findIndex(Boolean);
      return <div key={band} className="beat-channel" data-channel={band === 'kick' ? 'drum' : band} data-track={trackNames[band]} style={rowStyle}>
        <svg className="channel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <title>{trackNames[band]}</title>
          {band === 'kick' ? <><circle cx="12" cy="12" r="7" /><path d="M10 12h4" /></>
            : band === 'clap' ? <><path d="m6 14 5 5 7-7M7 12l5 5M11 5v3m5-2-2 3m6 1-3 1" /></>
              : band === 'hat' ? <><ellipse cx="12" cy="8" rx="8" ry="3" /><path d="M12 11v8m-4 0h8" /></>
                : band === 'bass' ? <path d="M3 12c3-8 6-8 9 0s6 8 9 0" />
                  : <path d="M3 16h4V8h5v8h5V8h4" />}
        </svg>
        {steps.map((active, step) => {
          const delay = pulseDelay(rowPattern, step, pulseSeed);
          const semanticHit = capture && band !== 'melody' && !exclusive && active && newOnsets[band];
          const semanticMomentHit = capture && band !== 'melody' && liveMoment && step === semanticStep && newOnsets[band];
          const semanticDelay = step === semanticStep ? 0 : delay;
          const onset = semanticHit && semanticDelay !== null;
          const momentLit = band !== 'melody' && liveMoment && isShapeCell(liveMoment.shape, row, step, rowCount);
          const pulseDelayMs = semanticHit ? semanticDelay || 0 : delay || 0;
          const momentDelayMs = liveMoment ? momentDelay(liveMoment.effect, row, step, liveMoment.id) : 0;
          const renderDelayMs = onset ? pulseDelayMs : momentDelayMs;
          const cellStyle = { '--melody-level': beat.melody?.level || 0, '--pulse-delay': `${pulseDelayMs}ms`, '--moment-delay': `${momentDelayMs}ms`, '--moment-duration': `${momentFlashMs}ms` } as CSSProperties;
          const shapeHit = momentLit && pulse.captureKey === captureKey && pulse.shapeHit;
          const type = band === 'clap' ? 'snare' : band === 'melody' ? 'melodic' : band;
          const origin = band === 'melody' ? melodyFlash?.telemetry : pulse.telemetry?.[`onset:${type}`];
          const cellTrace = onset && !projected ? visual?.trace ?? origin : momentLit ? liveMoment.telemetry : undefined;
          const shapeParent = pulse.parent;
          // A semantic cell keeps its parent across decorative expiry and shape changes.
          // Its child key alone restarts the existing attack animation for a new event.
          return <span key={projected?`${step}:${melodyCaptureKey}:projected`:semanticFlash?.step === step ? `${step}:${melodyCaptureKey}:semantic` : band === 'bass' ? `${step}:${captureKey}:${pulse.visuals?.bass?.count || 0}` : `${step}:${onset ? `${captureKey}:${visualCount}` : 0}:${momentLit ? liveMoment.id : 0}`}
            {...flashAttributes(cellTrace, row, step)}
            data-presentation={onset ? projected?'decorative-cell':'semantic-hit' : momentLit ? 'decorative-shape' : undefined}
            {...(projected?{'data-semantic':false}:{})}
            data-detector-origin={momentLit && !onset ? 'decorative-shape' : flashAttributes(cellTrace, row, step)['data-detector-origin']}
            data-parent-id={momentLit && !onset ? liveMoment.parentId : undefined}
            onAnimationStart={(event) => { if (event.target === event.currentTarget && event.animationName !== 'hue-cycle') { recordCellFlash(event.currentTarget, 'animation'); rendered(cellTrace, renderDelayMs, liveMoment?.parentId); } }}
            data-pattern-active={active} style={cellStyle}
            data-visual-pattern={rowPattern}
            className={`beat-square${active && (!degraded || onset || melodyHit) && (band !== 'melody' || melodyHit) ? ' active' : ''}${onset ? ' onset' : ''}${momentLit ? ' moment-lit' : ''}`}>
            {/* Captured accents or a confident audio tempo lock retrigger the held mask. */}
            {shapeHit && <span key={`${captureKey}:${pulse.rawTotal}:${pulse.tickTotal}`} className="shape-beat-flash"
              {...flashAttributes(liveMoment.telemetry, row, step)}
              data-event-id={`${liveMoment.telemetry?.id}:${pulse.rawTotal}:${pulse.tickTotal}`}
              data-target-playback-time={shapeParent?.targetPlaybackTime}
              data-parent-id={shapeParent?.id}
              data-detector-origin="decorative-shape-pulse"
              data-presentation="decorative-shape"
              onAnimationStart={(event) => { recordCellFlash(event.currentTarget, 'animation'); rendered(liveMoment.telemetry, momentDelay(liveMoment.effect, row, step, pulse.rawTotal) * .18, liveMoment.parentId); }}
              style={{ '--shape-hit-delay': `${momentDelay(liveMoment.effect, row, step, pulse.rawTotal) * .18}ms` } as CSSProperties} />}
            {!projected && !exclusive && (privateSemanticFlashes && percussion ? semanticFlash?.active && step === semanticFlash.step : percussion && newOnsets[band] && step === semanticStep || semanticMomentHit || retrigger && step === semanticStep || bassHeld && band === 'bass' && step === semanticStep) && <span key={`onset:${band}:${semanticFlash?.count ?? eventCount}`} className="semantic-beat-flash"
              style={band === 'bass' ? { '--semantic-flash-duration': `${bassFlash?.duration || 150}ms` } as CSSProperties : undefined}
              {...flashAttributes(semanticFlash?.trace ?? origin, row, step)} onAnimationStart={(event) => { recordCellFlash(event.currentTarget, 'animation'); rendered(semanticFlash?.trace ?? origin); }} />}
            {!projected && !exclusive && band === 'melody' && melodyHit && active && <span
              key={`melody:${melodyFlash.id}`} className="melody-beat-flash"
              {...flashAttributes(origin, row, step)}
              onAnimationStart={(event) => { recordCellFlash(event.currentTarget, 'animation'); rendered(origin); }}
              style={{ '--melody-flash-level': melodyLive ? beat.melody?.level : 1 } as CSSProperties} />}
            {attacks.filter(a=>a.band===band&&activeSteps(session!.id,reshuffleEpoch(a.trace?.targetPlaybackTime||0),row).findIndex(Boolean)===step)
              .map(attack=><ProjectedBeatFlash key={attack.key} attack={attack} row={row} cell={step} reduced={motionReduced}/>)}
          </span>;
        })}
      </div>;
    })}
  </div>;
}
