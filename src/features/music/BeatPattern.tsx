import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { BeatBand, BrowserMusicSession } from './mediaBridge';
import type { MusicBeatState } from './useMusicBeatSync';
import { beatTelemetry, type BeatTrace } from '../../../extensions/kanban-music/beat-telemetry.js';
const telemetry = beatTelemetry.at('beat-renderer');
import {
  activeSteps, beatBands, channelColors, effectNames, isShapeCell, momentDelay,
  nextDifferent, patternAt, pulseDelay, reshuffleEpoch, shapeNames, hashText, trackNames, momentFlashMs, momentDuration,
  type BeatColorMode, type BeatPalette, type MomentEffect, type MomentShape,
} from './beatVisuals';

interface Moment {
  id: number;
  captureKey: string;
  shape: MomentShape;
  effect: MomentEffect;
  telemetry?: BeatTrace;
  parentId?: string;
}

interface BeatPatternProps {
  session?: BrowserMusicSession;
  beat: MusicBeatState;
  colorMode?: BeatColorMode;
  palette?: BeatPalette;
  orientation?: 'horizontal' | 'vertical';
}

export default function BeatPattern({ session, beat, colorMode = 'random', palette = 'bloom', orientation = 'horizontal' }: BeatPatternProps) {
  const root = useRef<HTMLDivElement>(null);
  const committed = useRef(new Set<string>());
  const diagnostics = useRef({ traces: beat.telemetry, captureId: beat.captureId });
  // Metadata must not retrigger or cancel the existing visual timers.
  useEffect(() => { diagnostics.current = { traces: beat.telemetry, captureId: beat.captureId }; }, [beat.telemetry, beat.captureId]);
  const capture = session?.playing === true && !session.paused && beat.mode === 'capture' && beat.sessionId === session.id;
  const captureKey = capture ? `${session.id}:${beat.captureId || 'legacy'}:${beat.tempo?.locked ? 'tempo' : 'accent'}` : '';
  const melodyCaptureKey = capture ? `${session.id}:${beat.captureId || 'legacy'}` : '';
  const songSeconds = session?.currentTime || 0;
  const epoch = reshuffleEpoch(songSeconds, beat.tempo?.locked ? beat.tempo.bpm : null);
  const pattern = patternAt(songSeconds);
  // Semantic rows always reflect detected onsets. Structural tempo can still
  // retrigger an intentional decorative shape without claiming an instrument.
  const counts = beat.onsets;
  const kickCount = counts.kick || 0;
  const clapCount = counts.clap || 0;
  const hatCount = counts.hat || 0;
  const bassCount = counts.bass || 0;
  const melodyCount = counts.melody || 0;
  const onsetTotal = beatBands.reduce((sum, band) => sum + (beat.onsets[band] || 0), 0);
  const tickTotal = beat.tempo?.locked ? beat.tickCount || 0 : 0;
  const degraded = capture && beat.eventPath === 'degraded';
  const audioLive = capture && (!beat.rates || beatBands.some((band) => (beat.rates?.[band] || 0) > 0)
    || (beat.melody?.active === true && beat.melody.level > 0) || degraded && tickTotal > 0);
  const [pulse, setPulse] = useState<{ captureKey: string; counts: Partial<Record<BeatBand, number>>; active: Partial<Record<BeatBand, boolean>>; rawTotal: number; tickTotal: number; shapeHit: boolean; telemetry?: Record<string, BeatTrace> }>({
    captureKey, counts, active: {}, rawTotal: onsetTotal, tickTotal, shapeHit: false,
  });
  useEffect(() => {
    const nextCounts = { kick: kickCount, clap: clapCount, hat: hatCount, bass: bassCount, melody: melodyCount };
    const traces = diagnostics.current.traces;
    const decoration = degraded ? telemetry.events('random', ['generic'], { captureId: beat.captureId })?.[0] : undefined;
    if (decoration) telemetry.record('EVENT_QUEUED', decoration, { semantic: false, parentId: traces?.['tempo:generic']?.id });
    const timer = setTimeout(() => setPulse((previous) => ({ captureKey, counts: nextCounts, rawTotal: onsetTotal, tickTotal,
      ...(traces || decoration ? { telemetry: { ...traces, ...(decoration ? { 'random:generic': decoration } : {}) } } : {}),
      shapeHit: audioLive && captureKey === previous.captureKey
        && (onsetTotal > previous.rawTotal || tickTotal > previous.tickTotal),
      active: Object.fromEntries(beatBands.map((band) => [band,
        capture && captureKey === previous.captureKey && nextCounts[band] > (previous.counts[band] || 0),
      ])) as Partial<Record<BeatBand, boolean>>,
    })), 0);
    return () => clearTimeout(timer);
  }, [capture, audioLive, captureKey, kickCount, clapCount, hatCount, bassCount, melodyCount, onsetTotal, tickTotal, degraded, beat.captureId]);
  const newOnsets = pulse.captureKey === captureKey ? pulse.active : {};
  const melodyLive = capture && beat.melody?.active === true && beat.melody.level > 0;
  const melodyNote = beat.melody?.note || 0;
  const melodyGate = useRef({ captureKey: '', active: false, note: 0, sequence: 0 });
  const [melodyFlash, setMelodyFlash] = useState<{ captureKey: string; id: number; telemetry?: BeatTrace } | null>(null);
  useEffect(() => {
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
  }, [melodyCaptureKey, melodyLive, melodyNote]);
  useEffect(() => {
    if (!melodyFlash) return;
    const end = setTimeout(() => setMelodyFlash(null), 150);
    return () => clearTimeout(end);
  }, [melodyFlash]);
  const melodyHit = capture && melodyFlash?.captureKey === melodyCaptureKey && melodyLive;

  const [moment, setMoment] = useState<Moment | null>(null);
  const momentGate = useRef<{ captureKey: string; previousTotal: number; nextAt: number; lastShape?: MomentShape; lastEffect?: MomentEffect }>({
    captureKey: '', previousTotal: 0, nextAt: 0,
  });
  const momentTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const gate = momentGate.current;
    if (!audioLive) {
      gate.captureKey = '';
      momentTimers.current.forEach(clearTimeout);
      momentTimers.current = [];
      momentTimers.current.push(setTimeout(() => setMoment(null), 0));
      return;
    }
    if (gate.captureKey !== captureKey) {
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
    const parent = Object.values(diagnostics.current.traces || {}).filter((t) => t.source === 'onset').sort((a, b) => b.detectedAt - a.detectedAt)[0];
    const decoration = telemetry.events('random', ['generic'], { captureId: diagnostics.current.captureId })?.[0];
    telemetry.record('EVENT_QUEUED', decoration, { semantic: false, parentId: parent?.id });
    const next = { id: Date.now(), captureKey, shape, effect, ...(decoration ? { telemetry: decoration, parentId: parent?.id } : {}) };
    // A real onset triggers each moment; the timers only end its visual state.
    momentTimers.current.forEach(clearTimeout);
    momentTimers.current = [setTimeout(() => setMoment(next), 0),
      setTimeout(() => setMoment((current) => current?.id === next.id ? null : current), momentDuration(effect, next.id))];
  }, [audioLive, captureKey, moment?.captureKey, onsetTotal, songSeconds]);
  useEffect(() => () => { momentTimers.current.forEach(clearTimeout); }, []);
  const liveMoment = audioLive && moment?.captureKey === captureKey ? moment : null;
  // A DOM commit and a CSS animation start are separate observations. The
  // latter includes the existing decorative CSS delay, not physical scan-out.
  useEffect(() => {
    if (!beatTelemetry.enabled || !root.current) return;
    const available = Object.values(pulse.telemetry || {}).filter((t) => t.type !== 'generic' && t.type !== 'melodic');
    if (degraded && pulse.telemetry?.['random:generic']) available.push(pulse.telemetry['random:generic']);
    if (melodyFlash?.telemetry) available.push(melodyFlash.telemetry);
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
      telemetry.record('EVENT_COMMITTED', trace, { parentId: liveMoment?.parentId });
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) telemetry.record('EVENT_RENDERED', trace);
    }
  }, [beat.telemetry, beat.tempo?.locked, pulse, melodyFlash, liveMoment, degraded]);

  const rendered = (trace?: BeatTrace, delayMs = 0, parentId?: string) => {
    if (trace) telemetry.record('EVENT_RENDERED', trace, { delayMs, parentId });
  };

  return <div ref={root} className={`music-pattern${capture ? ' live' : ''}${capture && !degraded && colorMode === 'flow' ? ' flow' : ''}${liveMoment ? ' moment' : ''}${palette === 'ultraviolet' ? ' ultraviolet' : ''} ${orientation}`}
    data-pattern={pattern} data-event-path={beat.eventPath || 'local'} data-reshuffle={epoch} data-moment={liveMoment?.shape || ''}
    data-moment-source={liveMoment ? 'accent' : ''} data-moment-effect={liveMoment?.effect || ''} aria-hidden="true">
    {/* Generic timing belongs to the frame, never to an instrument row. */}
    {degraded && pulse.captureKey === captureKey && pulse.shapeHit && <span
      key={'decoration:' + captureKey + ':' + pulse.tickTotal} className="decorative-tempo-pulse"
      data-beat-trace={pulse.telemetry?.['random:generic']?.id}
      data-event-type="generic" data-event-source="random"
      data-semantic="false" data-presentation="decorative-global" data-detector-origin="tempo-fallback"
      data-parent-id={pulse.telemetry?.['tempo:generic']?.id}
      data-target-playback-time={pulse.telemetry?.['tempo:generic']?.targetPlaybackTime}
      onAnimationStart={() => rendered(pulse.telemetry?.['random:generic'], 0, pulse.telemetry?.['tempo:generic']?.id)} />}
    {beatBands.map((band, row) => {
      const steps = activeSteps(session?.id || 'empty', epoch, row);
      const colors = channelColors(colorMode, palette, session?.id || 'empty', epoch, row);
      const rowStyle = { '--c': colors.hit, '--ci': colors.idle, '--hue-delay': `${row * -2.25}s` } as CSSProperties;
      const pulseSeed = hashText(`${captureKey}:${band}:${counts[band] || 0}`);
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
          const delay = pulseDelay(pattern, step, pulseSeed);
          const onset = capture && band !== 'melody' && !liveMoment && active && newOnsets[band] && delay !== null;
          const momentLit = band !== 'melody' && liveMoment && isShapeCell(liveMoment.shape, row, step);
          const cellStyle = { '--melody-level': beat.melody?.level || 0, '--pulse-delay': `${delay || 0}ms`, '--moment-delay': `${liveMoment ? momentDelay(liveMoment.effect, row, step, liveMoment.id) : 0}ms`, '--moment-duration': `${momentFlashMs}ms` } as CSSProperties;
          const shapeHit = momentLit && pulse.captureKey === captureKey && pulse.shapeHit;
          const type = band === 'clap' ? 'snare' : band === 'melody' ? 'melodic' : band;
          const origin = band === 'melody' ? melodyFlash?.telemetry : pulse.telemetry?.[`onset:${type}`];
          const cellTrace = onset ? origin : momentLit ? liveMoment.telemetry : undefined;
          return <span key={`${step}:${onset ? `${captureKey}:${counts[band]}` : 0}:${momentLit ? liveMoment.id : 0}`}
            data-beat-trace={cellTrace?.id}
            onAnimationStart={(event) => { if (event.target === event.currentTarget && event.animationName !== 'hue-cycle') rendered(cellTrace, onset ? delay || 0 : liveMoment ? momentDelay(liveMoment.effect, row, step, liveMoment.id) : 0, liveMoment?.parentId); }}
            data-pattern-active={active} style={cellStyle}
            className={`beat-square${active && (!degraded || onset || melodyHit) && (band !== 'melody' || melodyHit) ? ' active' : ''}${onset ? ' onset' : ''}${momentLit ? ' moment-lit' : ''}`}>
            {/* Captured accents or a confident audio tempo lock retrigger the held mask. */}
            {shapeHit && <span key={`${captureKey}:${pulse.rawTotal}:${pulse.tickTotal}`} className="shape-beat-flash"
              data-beat-trace={liveMoment.telemetry?.id}
              onAnimationStart={() => rendered(liveMoment.telemetry, momentDelay(liveMoment.effect, row, step, pulse.rawTotal) * .18, liveMoment.parentId)}
              style={{ '--shape-hit-delay': `${momentDelay(liveMoment.effect, row, step, pulse.rawTotal) * .18}ms` } as CSSProperties} />}
            {band === 'melody' && melodyHit && active && <span
              key={`melody:${melodyFlash.id}`} className="melody-beat-flash"
              data-beat-trace={origin?.id}
              onAnimationStart={() => rendered(origin)}
              style={{ '--melody-flash-level': melodyLive ? beat.melody?.level : 1 } as CSSProperties} />}
          </span>;
        })}
      </div>;
    })}
  </div>;
}
