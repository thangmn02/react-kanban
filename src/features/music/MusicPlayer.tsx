import { useI18n } from '../../i18n';
import { getMusicInstallUrl } from './mediaBridge';
import type { BrowserMusicController } from './useBrowserMusic';
import BeatPattern from './BeatPattern';


export default function MusicPlayer({ music }: { music: BrowserMusicController }) {
  const { t } = useI18n();
  const { sessions, selected, setSelectedId, playing, busy, toggle, refresh, error, beat } = music;
  if (!sessions.length) return null;

  return <section className="floating-music glass" aria-label={t('focus.island.music')}>
    <div className="music-heading">
      <div className="track-copy">
        <p className="eyebrow">{t('focus.island.music')}</p>
        <h2 title={selected?.title}>{selected?.title || t('music.nothingPlaying')}</h2>
        {selected && <p className="muted track-artist">{[selected.artist, selected.source].filter(Boolean).join(' · ')}</p>}
      </div>
      <button type="button" className="round solid music-play" disabled={!selected || busy} onClick={() => void toggle()} aria-label={selected && !selected.paused ? t('music.pause') : t('music.play')}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{selected && !selected.paused ? <path d="M7 5h4v14H7zm6 0h4v14h-4z" /> : <path d="m8 5 11 7-11 7z" />}</svg>
      </button>
    </div>
    {sessions.length > 1 && <select className="music-sessions" aria-label={t('music.choose')} value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)}>{sessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {session.source}</option>)}</select>}
    <BeatPattern key={selected?.id} session={selected} beat={beat} />
    {import.meta.env.DEV && <details className="music-beat-help muted"><summary>Beat debug (dev)</summary>
      <pre aria-label="Beat sync debug" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({
        mode: beat.mode, reason: beat.reason, playing: selected?.playing, currentTime: selected?.currentTime,
        onsets: beat.onsets, 'sync.state': { mode: beat.mode, reason: beat.reason, captureId: beat.captureId },
      }, null, 2)}</pre>
    </details>}
    {beat.mode === 'capture' && selected?.playing === true && playing
      ? <p className="music-listening muted" role="status">{t('music.beatListening')}</p>
      : <details className="music-beat-help muted"><summary>{t('music.beatEnable')}</summary><p>{t('music.beatInstructions')}</p></details>}
    <p className="music-status muted" role="status">{error || t('music.connected')}</p>
    <button type="button" className="text-button" onClick={refresh}>{t('music.refresh')}</button>
    <p className="music-privacy muted">{t('music.privacy')}</p>
  </section>;
}

// Installation stays reachable without rendering an empty music panel.
export function MusicSetup({ music }: { music: BrowserMusicController }) {
  const { t, language } = useI18n();
  if (music.connected || music.checking) return null;
  return <div className="music-setup">
    {music.error && <p className="muted" role="status">{music.error}</p>}
    <div className="music-connect-actions">
      <a className="install-button solid" href={getMusicInstallUrl(language)} target="_blank" rel="noopener noreferrer">{t('music.addControls')}</a>
      <button type="button" className="text-button" onClick={music.refresh}>{t('music.checkAgain')}</button>
    </div>
  </div>;
}
