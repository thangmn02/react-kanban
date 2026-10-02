import type { BeatBand, BrowserMusicSession } from './mediaBridge';
import type { MusicBeatState } from './useMusicBeatSync';

const channels: { name: string; band: BeatBand; color: string; steps: boolean[] }[] = [
  { name: 'drum', band: 'kick', color: '#c26d43', steps: [true, false, false, false, true, false, false, false] },
  { name: 'snare', band: 'snare', color: '#5f9e9b', steps: [false, false, true, false, false, false, true, false] },
  { name: 'hat', band: 'hat', color: '#bd9847', steps: [true, false, true, false, true, false, true, false] },
  { name: 'bass', band: 'bass', color: '#8a76c2', steps: [false, true, false, false, false, true, false, false] },
];

export default function BeatPattern({ session, beat }: { session?: BrowserMusicSession; beat: MusicBeatState }) {
  const playing = session?.playing === true && !session.paused;
  const capture = playing && beat.mode === 'capture' && beat.sessionId === session?.id;
  // Only real onset events restart these animations. A song clock is metadata,
  // never a substitute beat source when capture is unavailable.
  return <div className="music-pattern" aria-hidden="true">
    {channels.map((channel, row) => <div key={channel.name} data-channel={channel.name} style={{ color: channel.color }}>
      <svg className="channel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        {row < 2 ? <><circle cx="12" cy="12" r="7" /><path d={row ? 'M5 12h14' : 'M10 12h4'} /></> : row === 2 ? <><ellipse cx="12" cy="8" rx="8" ry="3" /><path d="M12 11v8m-4 0h8" /></> : <path d="M3 12c3-8 6-8 9 0s6 8 9 0" />}
      </svg>
      {channel.steps.map((active, step) => <span
        key={`${step}:${active && capture ? `${beat.captureId || 'legacy'}:${beat.onsets[channel.band] || 0}` : 0}`}
        data-pattern-active={active}
        className={`beat-square${active && capture && beat.onsets[channel.band] ? ' onset' : ''}`} />)}
    </div>)}
  </div>;
}
