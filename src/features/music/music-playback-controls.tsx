import { useEffect, useState, type CSSProperties } from 'react';
import { useI18n } from '../../i18n';
import type { BrowserMusicController } from './useBrowserMusic';

const mediaTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export default function MusicPlaybackControls({ music }: { music: BrowserMusicController }) {
  const { t } = useI18n();
  const { selected, busy, toggle, control } = music;
  const [now, setNow] = useState(Date.now);
  const [draft, setDraft] = useState<{ id: string; kind: 'seek' | 'volume'; value: number }>();
  useEffect(() => {
    if (!music.playing) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [music.playing]);
  if (!selected) return null;
  const duration = selected.duration || 0;
  const elapsed = music.playing && selected.sampledAt ? Math.max(0, (now - selected.sampledAt) / 1000) * (selected.playbackRate || 1) : 0;
  const current = Math.min(duration || Infinity, (selected.currentTime || 0) + elapsed);
  const activeDraft = draft?.id === selected.id ? draft : undefined;
  const seek = activeDraft?.kind === 'seek' ? activeDraft.value : current;
  const volume = activeDraft?.kind === 'volume' ? activeDraft.value : selected.muted ? 0 : selected.volume ?? 0;
  const disabled = selected.canControl === false || busy;
  const commit = (kind: 'seek' | 'volume') => {
    if (activeDraft?.kind !== kind || disabled) return;
    setDraft(undefined); void control(kind === 'seek' ? 'media.seek' : 'media.volume', activeDraft.value);
  };
  return <>
    <div className="music-timeline">
      <input type="range" min="0" max={duration || 1} step="0.1" value={Math.min(seek, duration || 1)}
        aria-label={t('music.seek')} aria-valuetext={`${mediaTime(seek)} / ${duration ? mediaTime(duration) : t('music.live')}`}
        disabled={disabled || !duration || selected.canSeek !== true}
        onChange={event => setDraft({ id: selected.id, kind: 'seek', value: event.target.valueAsNumber })}
        onPointerUp={() => commit('seek')} onKeyUp={() => commit('seek')} onBlur={() => commit('seek')}
        style={{ '--music-progress': `${duration ? Math.min(100, seek / duration * 100) : 0}%` } as CSSProperties} />
      <div className="music-times"><span>{mediaTime(seek)}</span><span>{duration ? mediaTime(duration) : t('music.live')}</span></div>
    </div>
    <div className="music-controls">
      <button className="music-skip" type="button" aria-label={t('music.previous')} disabled={disabled || selected.canPrevious !== true} onClick={() => void control('media.previous')}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 5h3v14H5zm14 0L9 12l10 7z" /></svg>
      </button>
      <button type="button" className="round music-play" disabled={disabled} onClick={() => void toggle()} aria-label={t(selected.paused ? 'music.play' : 'music.pause')}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{selected.paused ? <path d="m8 5 11 7-11 7z" /> : <path d="M7 5h4v14H7zm6 0h4v14h-4z" />}</svg>
      </button>
      <button className="music-skip" type="button" aria-label={t('music.next')} disabled={disabled || selected.canNext !== true} onClick={() => void control('media.next')}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 5h3v14h-3zM5 5l10 7-10 7z" /></svg>
      </button>
    </div>
    <div className="music-volume">
      <button type="button" className="music-mute" aria-label={t(volume ? 'music.mute' : 'music.unmute')}
        disabled={disabled || selected.volume === undefined} onClick={() => void control('media.volume', volume ? 0 : selected.volume || .5)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" />{volume === 0 ? <path d="m17 9 5 6m0-6-5 6" /> : <><path d="M17 8q5 4 0 8" />{volume > .5 && <path d="M20 5q7 7 0 14" />}</>}
        </svg>
      </button>
      <input type="range" min="0" max="1" step="0.01" value={volume} aria-label={t('music.volume')} aria-valuetext={`${Math.round(volume * 100)}%`}
        disabled={disabled || selected.volume === undefined}
        onChange={event => setDraft({ id: selected.id, kind: 'volume', value: event.target.valueAsNumber })}
        onPointerUp={() => commit('volume')} onKeyUp={() => commit('volume')} onBlur={() => commit('volume')}
        style={{ '--music-progress': `${volume * 100}%` } as CSSProperties} />
    </div>
  </>;
}
