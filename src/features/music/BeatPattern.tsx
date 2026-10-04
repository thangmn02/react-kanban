import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { BeatBand, BrowserMusicSession } from './mediaBridge';
import type { MusicBeatState } from './useMusicBeatSync';
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
  // Only percussion moves to the estimated grid. Bass accents and Melody
  // sustain remain driven by captured audio.
  const counts = beat.tempo?.locked ? { ...(beat.ticks || {}), bass: beat.onsets.bass, melody: beat.onsets.melody } : beat.onsets;
  const kickCount = counts.kick || 0;
  const clapCount = counts.clap || 0;
  const hatCount = counts.hat || 0;
  const bassCount = counts.bass || 0;
  const melodyCount = counts.melody || 0;
  const onsetTotal = beatBands.reduce((sum, band) => sum + (beat.onsets[band] || 0), 0);
  const tickTotal = beat.tempo?.locked ? kickCount + clapCount + hatCount : 0;
  const audioLive = capture && (!beat.rates || beatBands.some((band) => (beat.rates?.[band] || 0) > 0)
    || (beat.melody?.active === true && beat.melody.level > 0));
  const [pulse, setPulse] = useState<{ captureKey: string; counts: Partial<Record<BeatBand, number>>; active: Partial<Record<BeatBand, boolean>>; rawTotal: number; tickTotal: number; shapeHit: boolean }>({
    captureKey, counts, active: {}, rawTotal: onsetTotal, tickTotal, shapeHit: false,
  });
  useEffect(() => {
    const nextCounts = { kick: kickCount, clap: clapCount, hat: hatCount, bass: bassCount, melody: melodyCount };
    const timer = setTimeout(() => setPulse((previous) => ({ captureKey, counts: nextCounts, rawTotal: onsetTotal, tickTotal,
      shapeHit: audioLive && captureKey === previous.captureKey
        && (onsetTotal > previous.rawTotal || tickTotal > previous.tickTotal),
      active: Object.fromEntries(beatBands.map((band) => [band,
        capture && captureKey === previous.captureKey && nextCounts[band] > (previous.counts[band] || 0),
      ])) as Partial<Record<BeatBand, boolean>>,
    })), 0);
    return () => clearTimeout(timer);
  }, [capture, audioLive, captureKey, kickCount, clapCount, hatCount, bassCount, melodyCount, onsetTotal, tickTotal]);
  const newOnsets = pulse.captureKey === captureKey ? pulse.active : {};
  const melodyLive = capture && beat.melody?.active === true && beat.melody.level > 0;
  const breakdown = melodyLive && (['kick', 'clap', 'hat'] as const).every((band) => !(beat.rates?.[band] || 0));
  const [melodyMoment, setMelodyMoment] = useState<Moment | null>(null);
  useEffect(() => {
    // Hold one complete shape across a drumless phrase, not one short flash
    // per analyser update. The signal, never a beat timer, owns its lifetime.
    const timer = setTimeout(() => setMelodyMoment((previous) => breakdown
      ? previous?.captureKey === captureKey ? previous : { id: Date.now(), captureKey,
        shape: shapeNames[hashText(captureKey) % shapeNames.length], effect: 'wave' }
      : null), 0);
    return () => clearTimeout(timer);
  }, [breakdown, captureKey]);

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
    const next = { id: Date.now(), captureKey, shape, effect };
    // A real onset triggers each moment; the timers only end its visual state.
    momentTimers.current.forEach(clearTimeout);
    momentTimers.current = [setTimeout(() => setMoment(next), 0),
      setTimeout(() => setMoment((current) => current?.id === next.id ? null : current), momentDuration(effect, next.id))];
  }, [audioLive, captureKey, moment?.captureKey, onsetTotal, songSeconds]);
  useEffect(() => () => { momentTimers.current.forEach(clearTimeout); }, []);
  const heldMoment = breakdown && melodyMoment?.captureKey === captureKey ? melodyMoment : null;
  const liveMoment = heldMoment || (audioLive && moment?.captureKey === captureKey ? moment : null);

  return <div className={`music-pattern${capture ? ' live' : ''}${capture && colorMode === 'flow' ? ' flow' : ''}${liveMoment ? ' moment' : ''}${palette === 'ultraviolet' ? ' ultraviolet' : ''} ${orientation}`}
    data-pattern={pattern} data-reshuffle={epoch} data-moment={liveMoment?.shape || ''}
    data-moment-source={heldMoment ? 'melody' : liveMoment ? 'accent' : ''} data-moment-effect={liveMoment?.effect || ''} aria-hidden="true">
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
          const momentLit = liveMoment && isShapeCell(liveMoment.shape, row, step);
          const melodyHeld = (heldMoment && momentLit) || (band === 'melody' && melodyLive && !liveMoment && active);
          const cellStyle = { '--melody-level': beat.melody?.level || 0, '--pulse-delay': `${delay || 0}ms`, '--moment-delay': `${liveMoment ? momentDelay(liveMoment.effect, row, step, liveMoment.id) : 0}ms`, '--moment-duration': `${momentFlashMs}ms` } as CSSProperties;
          const shapeHit = momentLit && pulse.captureKey === captureKey && pulse.shapeHit;
          return <span key={`${step}:${onset ? `${captureKey}:${counts[band]}` : 0}:${momentLit ? liveMoment.id : 0}`}
            data-pattern-active={active} style={cellStyle}
            className={`beat-square${active ? ' active' : ''}${onset ? ' onset' : ''}${momentLit ? ' moment-lit' : ''}${melodyHeld ? ' melody-held' : ''}`}>
            {/* Captured accents or a confident audio tempo lock retrigger the held mask. */}
            {shapeHit && <span key={`${captureKey}:${pulse.rawTotal}:${pulse.tickTotal}`} className="shape-beat-flash"
              style={{ '--shape-hit-delay': `${momentDelay(liveMoment.effect, row, step, pulse.rawTotal) * .18}ms` } as CSSProperties} />}
          </span>;
        })}
      </div>;
    })}
  </div>;
}
