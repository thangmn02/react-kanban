import { useI18n } from '../../i18n';
import { getMusicInstallUrl } from './mediaBridge';
import type { BrowserMusicController } from './useBrowserMusic';
import { patternAt } from './beatVisuals';
import type { BeatColorMode, BeatPalette } from './beatVisuals';
import BeatPattern from './BeatPattern';
import { openNativeMusicSetup } from '../native/nativeMusic';
import { isNativeWidget } from '../native/runtime';

export interface MusicVisualOptions {
  colorMode?: BeatColorMode;
  palette?: BeatPalette;
  orientation?: 'horizontal' | 'vertical';
}

export function MusicTrack({ music }: { music: BrowserMusicController }) {
  const { t } = useI18n();
  const { sessions, selected, setSelectedId, busy, toggle } = music;
  if (!sessions.length) return null;
  return <>
    <div className="music-heading">
      <div className="track-copy">
        <p className="eyebrow">{t('focus.island.music')}</p>
        <h2 title={selected?.title}>{selected?.title || t('music.nothingPlaying')}</h2>
        {selected && <p className="muted track-artist">{[selected.artist, selected.source].filter(Boolean).join(' · ')}</p>}
      </div>
      <button type="button" className="round solid music-play" disabled={!selected || selected.canControl === false || busy} onClick={() => void toggle()} aria-label={selected && !selected.paused ? t('music.pause') : t('music.play')}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{selected && !selected.paused ? <path d="M7 5h4v14H7zm6 0h4v14h-4z" /> : <path d="m8 5 11 7-11 7z" />}</svg>
      </button>
    </div>
    {sessions.length > 1 && <select className="music-sessions" aria-label={t('music.choose')} value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)}>{sessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {session.source}</option>)}</select>}
  </>;
}

export function MusicGrid({ music, colorMode = 'random', palette = 'bloom', orientation = 'horizontal' }: { music: BrowserMusicController } & MusicVisualOptions) {
  const showDebug = import.meta.env.DEV && new URLSearchParams(window.location.search).has('musicDebug');
  return <>
    <BeatPattern key={music.selected?.id} session={music.selected} beat={music.beat} colorMode={colorMode} palette={palette} orientation={orientation} />
    {showDebug && <details className="music-debug" open><summary>Beat debug</summary><pre aria-label="Beat sync debug">{JSON.stringify({
      source: music.source, mode: music.beat.mode, reason: music.beat.reason, onsets: music.beat.onsets, rates: music.beat.rates,
      tempo: music.beat.tempo, ticks: music.beat.ticks, pattern: patternAt(music.selected?.currentTime || 0), captureId: music.beat.captureId,
      melody: music.beat.melody,
    }, null, 2)}</pre></details>}
  </>;
}

export function MusicFeedback({ music }: { music: BrowserMusicController }) {
  const { t } = useI18n();
  const { selected, playing, busy, openMusicTab, error, beat } = music;
  const needsAccess = playing && beat.mode !== 'capture' && beat.reason === 'capture-permission';
  const outdatedCapturePolicy = beat.mode === 'clock' && (beat.reason === 'drm-protected' || selected?.syncState?.reason === 'drm-protected');
  const silentPlayback = playing && beat.mode === 'clock' && beat.reason === 'silent';
  return <>
    {needsAccess && <div className="music-access" role="status">
      <p className="music-access-title">{t('music.beatAccessTitle')}</p>
      <p className="muted">{t('music.beatAccessHelp')}</p>
      <button type="button" className="solid" disabled={busy} onClick={() => void openMusicTab()}>{t('music.enableBeats')}</button>
    </div>}
    {silentPlayback && <p className="music-status muted" role="status">{t('music.silentCapture')}</p>}
    {outdatedCapturePolicy && <p className="music-status muted" role="status">{t('music.captureUpdate')}</p>}
    {error && <p className="music-status muted" role="status">{error}</p>}
  </>;
}

export default function MusicPlayer({ music, colorMode = 'random', palette = 'bloom', orientation = 'horizontal' }: { music: BrowserMusicController } & MusicVisualOptions) {
  const { t } = useI18n();
  if (!music.sessions.length) return null;
  return <section className={`floating-music glass${palette === 'ultraviolet' ? ' ultraviolet' : ''}`} aria-label={t('focus.island.music')}>
    <MusicTrack music={music} />
    <MusicGrid music={music} colorMode={colorMode} palette={palette} orientation={orientation} />
    <MusicFeedback music={music} />
  </section>;
}

export function MusicSetup({ music }: { music: BrowserMusicController }) {
  const { t, language } = useI18n();
  if (music.connected || music.checking) return null;
  return <div className="music-setup">
    {music.error && <p className="muted" role="status">{music.error}</p>}
    <div className="music-connect-actions">
      {isNativeWidget()
        ? <button className="install-button solid" type="button" onClick={() => void openNativeMusicSetup().catch(() => {})}>{t('music.addControls')}</button>
        : <a className="install-button solid" href={getMusicInstallUrl(language)} target="_blank" rel="noopener noreferrer">{t('music.addControls')}</a>}
      <button type="button" className="text-button" onClick={music.refresh}>{t('music.checkAgain')}</button>
    </div>
  </div>;
}
