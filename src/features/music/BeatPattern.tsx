import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { BeatBand, BrowserMusicSession } from './mediaBridge';
import type { MusicBeatState } from './useMusicBeatSync';
import {
  activeSteps, beatBands, channelColors, effectNames, isShapeCell, momentDelay,
  nextDifferent, patternAt, pulseDelay, reshuffleEpoch, shapeNames, hashText,
  type BeatColorMode, type BeatPalette, type MomentEffect, type MomentShape,
} from './beatVisuals';

interface Moment {
  id: number;
  captureKey: string;
  shape: MomentShape;
  effect: MomentEffect;
}

interface BeatPatternProps {
  session?: BrowserMusicSession;
  beat: MusicBeatState;
  colorMode?: BeatColorMode;
  palette?: BeatPalette;
  orientation?: 'horizontal' | 'vertical';
}

export default function BeatPattern({ session, beat, colorMode = 'random', palette = 'bloom', orientation = 'horizontal' }: BeatPatternProps) {
  const capture = session?.playing === true && !session.paused && beat.mode === 'capture' && beat.sessionId === session.id;
  const captureKey = capture ? `${session.id}:${beat.captureId || 'legacy'}:${beat.tempo?.locked ? 'tempo' : 'accent'}` : '';
  const songSeconds = session?.currentTime || 0;
  const epoch = reshuffleEpoch(songSeconds, beat.tempo?.locked ? beat.tempo.bpm : null);
  const pattern = patternAt(songSeconds);
  const counts = beat.tempo?.locked ? beat.ticks || {} : beat.onsets;
  const kickCount = counts.kick || 0;
  const snareCount = counts.snare || 0;
  const hatCount = counts.hat || 0;
  const bassCount = counts.bass || 0;
  const [pulse, setPulse] = useState<{ captureKey: string; counts: Partial<Record<BeatBand, number>>; active: Partial<Record<BeatBand, boolean>> }>({
    captureKey, counts, active: {},
  });
  useEffect(() => {
    const nextCounts = { kick: kickCount, snare: snareCount, hat: hatCount, bass: bassCount };
    const timer = setTimeout(() => setPulse((previous) => ({ captureKey, counts: nextCounts,
      active: Object.fromEntries(beatBands.map((band) => [band,
        capture && captureKey === previous.captureKey && nextCounts[band] > (previous.counts[band] || 0),
      ])) as Partial<Record<BeatBand, boolean>>,
    })), 0);
    return () => clearTimeout(timer);
  }, [capture, captureKey, kickCount, snareCount, hatCount, bassCount]);
  const newOnsets = pulse.captureKey === captureKey ? pulse.active : {};

  const [moment, setMoment] = useState<Moment | null>(null);
  const momentGate = useRef<{ captureKey: string; previousTotal: number; nextAt: number; lastShape?: MomentShape; lastEffect?: MomentEffect }>({
    captureKey: '', previousTotal: 0, nextAt: 0,
  });
  const momentTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onsetTotal = beatBands.reduce((sum, band) => sum + (beat.onsets[band] || 0), 0);
  useEffect(() => {
    const gate = momentGate.current;
    if (!capture) {
      gate.captureKey = '';
      momentTimers.current.forEach(clearTimeout);
      momentTimers.current = [];
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
    const next = { id: Date.now(), captureKey, shape, effect };
    // A real onset triggers each moment; the timers only end its visual state.
    momentTimers.current.push(setTimeout(() => setMoment(next), 0));
    momentTimers.current.push(setTimeout(() => setMoment((current) => current?.id === next.id ? null : current), 1100));
  }, [capture, captureKey, moment?.captureKey, onsetTotal, songSeconds]);
  useEffect(() => () => { momentTimers.current.forEach(clearTimeout); }, []);
  const liveMoment = capture && moment?.captureKey === captureKey ? moment : null;

  return <div className={`music-pattern${capture ? ' live' : ''}${capture && colorMode === 'flow' ? ' flow' : ''}${liveMoment ? ' moment' : ''}${palette === 'ultraviolet' ? ' ultraviolet' : ''} ${orientation}`}
    data-pattern={pattern} data-reshuffle={epoch} data-moment={liveMoment?.shape || ''} aria-hidden="true">
    {beatBands.map((band, row) => {
      const steps = activeSteps(session?.id || 'empty', epoch, row);
      const colors = channelColors(colorMode, palette, session?.id || 'empty', epoch, row);
      const rowStyle = { '--c': colors.hit, '--ci': colors.idle, '--hue-delay': `${row * -2.25}s` } as CSSProperties;
      const pulseSeed = hashText(`${captureKey}:${band}:${counts[band] || 0}`);
      return <div key={band} className="beat-channel" data-channel={band === 'kick' ? 'drum' : band} style={rowStyle}>
        <svg className="channel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          {row < 2 ? <><circle cx="12" cy="12" r="7" /><path d={row ? 'M5 12h14' : 'M10 12h4'} /></> : row === 2 ? <><ellipse cx="12" cy="8" rx="8" ry="3" /><path d="M12 11v8m-4 0h8" /></> : <path d="M3 12c3-8 6-8 9 0s6 8 9 0" />}
        </svg>
        {steps.map((active, step) => {
          const delay = pulseDelay(pattern, step, pulseSeed);
          const onset = capture && !liveMoment && active && newOnsets[band] && delay !== null;
          const momentLit = liveMoment && isShapeCell(liveMoment.shape, row, step);
          const cellStyle = { '--pulse-delay': `${delay || 0}ms`, '--moment-delay': `${liveMoment ? momentDelay(liveMoment.effect, row, step, liveMoment.id) : 0}ms` } as CSSProperties;
          return <span key={`${step}:${onset ? `${captureKey}:${counts[band]}` : 0}:${momentLit ? liveMoment.id : 0}`}
            data-pattern-active={active} style={cellStyle}
            className={`beat-square${active ? ' active' : ''}${onset ? ' onset' : ''}${momentLit ? ' moment-lit' : ''}`} />;
        })}
      </div>;
    })}
  </div>;
}
