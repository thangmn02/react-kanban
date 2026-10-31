import { useI18n } from '../../i18n';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {useMotionReduction} from './use-motion-reduction';
import type {MotionProfile,MotionReduction} from './semantic-motion';
import {motionPreviewAllowed} from './semantic-motion';
import { getMusicInstallUrl } from './mediaBridge';
import ExperimentalBeatControl from './experimental-beat-control';
import SourceAudioDelayControl from './source-audio-delay-control';
import MusicPlaybackControls from './music-playback-controls';
import type { BrowserMusicController } from './useBrowserMusic';
import { patternAt } from './beatVisuals';
import type { BeatColorMode, BeatPalette } from './beatVisuals';
import BeatPattern from './BeatPattern';
import { useCompanionSetup } from '../native/use-companion-setup';
import { isNativeWidget, nativeCompanionPreviewEnabled } from '../native/runtime';
import { beatRowDiagnostics, fourRowBaseline } from './beat-row-diagnostics';
import { beatTelemetry } from '../../../extensions/kanban-music/beat-telemetry.js';
import { leadPulseEnabled, leadAvailabilityText } from './lead-feature';
import HybridBetaControl from './hybrid-beta-control';
import {localHybridEnabled} from './use-local-hybrid-music';
import LivePipelineTraceControl from './live-pipeline-trace-control';
const PrivateMelodyDemo=import.meta.env.DEV ? lazy(()=>import('./diagnostics/MelodyDetectorDemo')) : null;

export interface MusicVisualOptions {
  colorMode?: BeatColorMode;
  palette?: BeatPalette;
  orientation?: 'horizontal' | 'vertical';
  motionProfile?:MotionProfile;
  motionReduction?:MotionReduction;
  visualActive?:boolean;
}

export function MusicNowPlaying({ music }: { music: BrowserMusicController }) {
  const { t } = useI18n();
  if (!music.selected || !music.playing) return null;
  return <div className="music-now-playing-strip">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="M9 18V5l11-2v13M9 8l11-2" /><ellipse cx="6" cy="18" rx="3" ry="2" /><ellipse cx="17" cy="16" rx="3" ry="2" /></svg>
    <span className="music-now-playing-label">{t(music.playing ? 'dock.nowPlaying' : 'focus.island.music')}</span>
    <span className="music-now-playing-title" title={music.selected.title}>{music.selected.title}</span>
    <button type="button" className="round music-strip-play" disabled={music.selected.canControl === false || music.busy}
      onClick={() => void music.toggle()} aria-label={t(music.selected.paused ? 'music.play' : 'music.pause')}>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{music.selected.paused ? <path d="m8 5 11 7-11 7z" /> : <path d="M7 5h4v14H7zm6 0h4v14h-4z" />}</svg>
    </button>
  </div>;
}

export function MusicTrack({ music }: { music: BrowserMusicController }) {
  const { t } = useI18n();
  const { sessions, selected, setSelectedId } = music;
  if (!sessions.length) return null;
  return <>
    <div className="music-heading">
      <div className="music-art" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 18V5l11-2v13M9 8l11-2" /><ellipse cx="6" cy="18" rx="3" ry="2" /><ellipse cx="17" cy="16" rx="3" ry="2" /></svg></div>
      <div className="track-copy">
        <p className="eyebrow">{t('focus.island.music')}</p>
        <h2 title={selected?.title}>{selected?.title || t('music.nothingPlaying')}</h2>
        {selected && <p className="muted track-artist">{[selected.artist, selected.source].filter(Boolean).join(' · ')}</p>}
      </div>
      <span className={`music-playing-state${music.playing ? ' playing' : ''}`} role="status" aria-label={t(music.playing ? 'music.playing' : 'music.paused')}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 10h3v10H3zm5-6h3v16H8zm5 3h3v13h-3zm5-5h3v18h-3z" /></svg>
      </span>
    </div>
    <MusicPlaybackControls key={selected?.id} music={music} />
    {selected&&music.sourceAudioDelay&&<SourceAudioDelayControl key={music.sourceAudioDelay.owner} music={music}/>}
    {selected&&(!isNativeWidget()||nativeCompanionPreviewEnabled())&&<ExperimentalBeatControl key={`experimental:${selected.id}`} session={selected} refresh={music.refresh} compensationOnly={nativeCompanionPreviewEnabled()}/>}
    {sessions.length > 1 && <select className="music-sessions" aria-label={t('music.choose')} value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)}>{sessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {session.source}</option>)}</select>}
  </>;
}

export function MusicGrid({ music, colorMode = 'random', palette = 'bloom', orientation = 'horizontal',motionProfile='focus',motionReduction='system',visualActive=true }: { music: BrowserMusicController } & MusicVisualOptions) {
  const {t}=useI18n();
  const systemReduced=useMotionReduction(),reduced=motionReduction==='reduced'||systemReduced;
  const [legacy,setLegacy]=useState(false);
  const previewOwner=JSON.stringify([music.selected?.id,music.selected?.generation,music.selected?.asset?.provider,music.selected?.asset?.id,
    music.beat.sourceGeneration,music.beat.captureId,music.beat.synchronizationEpoch]);
  const [latePreview,setLatePreview]=useState({owner:previewOwner,enabled:false});
  if(latePreview.owner!==previewOwner)setLatePreview({owner:previewOwner,enabled:false});
  const compareLegacy=legacy&&!reduced;
  const privateNativeDelay=nativeCompanionPreviewEnabled()||music.sourceAudioDelay?.enabled===true;
  const motionPreview=import.meta.env.VITE_ENABLE_BEAT_GRID_PREVIEW==='true'||motionPreviewAllowed(music.selected?.syncState?.capability?.privateCandidate===true);
  const lateLivePreview=motionPreview&&!privateNativeDelay&&!compareLegacy&&!music.beta?.enabled&&Boolean(music.selected?.id)&&latePreview.owner===previewOwner&&latePreview.enabled;
  const showDebug = import.meta.env.DEV && new URLSearchParams(window.location.search).has('musicDebug');
  const [demo,setDemo]=useState(() => new URLSearchParams(window.location.search).get('musicDemo') === 'lead');
  const visibility = useRef<{ at: number; event: string; hidden: boolean }[]>([]);
  useEffect(() => {
    if (!showDebug) return;
    const record = (event: Event) => {
      visibility.current.push({ at: Date.now(), event: event.type, hidden: document.hidden });
      if (visibility.current.length > 64) visibility.current.shift();
    };
    document.addEventListener('visibilitychange', record);
    window.addEventListener('focus', record); window.addEventListener('blur', record);
    return () => {
      document.removeEventListener('visibilitychange', record);
      window.removeEventListener('focus', record); window.removeEventListener('blur', record);
    };
  }, [showDebug]);
  if(showDebug&&demo&&PrivateMelodyDemo)return <div style={{height:'100%',overflowY:'auto'}}>
    <button type="button" onClick={()=>setDemo(false)}>Return to live Beat Grid</button>
    <Suspense fallback={<p>Loading private Melody comparison…</p>}><PrivateMelodyDemo /></Suspense>
  </div>;
  const capability=music.selected?.syncState?.capability;
  const previewStatus=(!isNativeWidget()||privateNativeDelay)&&!music.beta?.enabled&&capability?.privateCandidate
    ?capability.reason==='protected-source'?'Instrument flashes are unavailable for this protected source. Music playback controls still work.'
    :capability.reason==='provider-policy'?'Instrument flashes are unavailable for this provider under the private test policy. Music playback controls still work.'
    :privateNativeDelay&&capability.bufferMs>0?`Intentional audio delay: ${capability.bufferMs} ms. Instrument predictions and physical synchronization are unverified.`
    :capability.allowTypedPreview?'Unverified instrument preview is on. Flashes can lag or be incorrect.'
    :privateNativeDelay&&capability.compensationEligible?'Instrument preview is off. Open Music → Audio Delay Compensation, pause playback and enable your chosen delay. Seeking or changing the source resets it to OFF.'
    :capability.livePreviewEligible?'Instrument preview is off for this source. Open Music → Private candidate → Live preview to enable it. Pause, seek and source changes turn preview off.'
    :null:null;
  const grid=<BeatPattern key={music.selected?.id} session={music.selected} beat={music.beat} colorMode={colorMode} palette={palette} orientation={orientation} semanticOnly={music.beta?.enabled?true:undefined} melodyEnabled={music.beta?.enabled&&music.beta.melody} independentRows={music.beta?.enabled} melodyEvents={music.beta?.enabled?music.beta.clip?.lead?.events:undefined}
    motionProfile={motionPreview&&!compareLegacy?motionProfile:'legacy'} motionReduced={reduced} motionActive={visualActive} lateLivePreview={lateLivePreview}/>;
  return <>
    {motionPreview&&<div className="music-motion-controls"><span>{t('dock.motion.preview')} · {compareLegacy?'Legacy':t(`dock.motion.${motionProfile}`)}</span>
      <button type="button" className="text-button motion-legacy" disabled={reduced} aria-pressed={compareLegacy} onClick={()=>setLegacy(value=>!value)}>{t(compareLegacy?'dock.motion.restore':'dock.motion.legacy')}</button>
      {!music.beta?.enabled&&!privateNativeDelay&&<button type="button" className="text-button motion-legacy" disabled={compareLegacy||!music.selected} aria-pressed={lateLivePreview}
        onClick={()=>setLatePreview({owner:previewOwner,enabled:!lateLivePreview})}>{t(lateLivePreview?'music.lateLive.disable':'music.lateLive.enable')}</button>}
    </div>}
    {motionPreview&&!music.beta?.enabled&&!privateNativeDelay&&<p className="motion-reduction-note" role="status" aria-label={t('music.lateLive.status')}>{t(lateLivePreview?'music.lateLive.active':'music.lateLive.strict')}</p>}
    {motionPreview&&reduced&&<p className="motion-reduction-note">{t('dock.motion.reducedNote')}</p>}
    {previewStatus&&<p role="status" aria-label="Instrument preview status">{previewStatus}</p>}
    {music.beta?.enabled?<div className={`hybrid-grid-frame${music.beta.renderer==='short'?' hybrid-short-attack':''}`}>{grid}</div>:grid}
    {showDebug && <details className="music-debug" open><summary>Beat debug</summary>
      {PrivateMelodyDemo&&<button type="button" onClick={()=>setDemo(true)}>Open saved Lead listening demo</button>}
      <>
        {fourRowBaseline ? <><p className="muted">Four-row baseline · Melody off · semantic events only</p>
        <p aria-label="Four-row event counters">Kick: {music.beat.onsets.kick || 0} · Snare: {music.beat.onsets.clap || 0} · Hat: {music.beat.onsets.hat || 0} · Bass: {music.beat.onsets.bass || 0}</p></>
          : <><p aria-label="Live event counters">Kick: {music.beat.onsets.kick || 0} · Snare / Clap: {music.beat.onsets.clap || 0} · Hat: {music.beat.onsets.hat || 0} · Bass: {music.beat.onsets.bass || 0} · Lead: {music.beat.melody?.note || music.beat.onsets.melody || 0}</p>
          <p aria-label="Lead pipeline status">Lead: {leadPulseEnabled()
            ? `${leadAvailabilityText(music.beat.leadAvailability)}${music.beat.lead ? ` · ${music.beat.lead.source} · ${music.beat.lead.kind}` : ''}`
            : 'new pipeline disabled · live local capture does not generate Lead events'}</p></>}
        <p aria-label="Companion capture status">Capture: {music.selected?.syncState?.mode || 'unknown'} · {music.selected?.syncState?.reason || 'no failure reported'} · Playback: {music.selected?.playing && !music.selected.paused ? 'playing' : 'paused'} · Path: {music.beat.eventPath || 'waiting'}</p>
        {music.selected?.syncState?.captureError && <p>Capture error: {music.selected.syncState.captureError.stage} · {music.selected.syncState.captureError.code}</p>}
        {music.selected?.syncState?.capability?.privateCandidate?<LivePipelineTraceControl music={music}/>:<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="text-button" onClick={() => { visibility.current = []; beatTelemetry.clear(); beatRowDiagnostics.start(30); }}>Record 30 seconds</button>
        <button type="button" className="text-button" onClick={() => {
          const rows = beatRowDiagnostics.snapshot(fourRowBaseline ? 'semantic-only' : undefined);
          const telemetry = beatTelemetry.snapshot();
          const snapshot = { ...rows, source: music.source,
            telemetry: { ...telemetry, records: telemetry.records.filter(record => Number(record.at) >= rows.startTime && Number(record.at) <= rows.endTime) },
            visibility: visibility.current.filter(record => record.at >= rows.startTime && record.at <= rows.endTime),
            leadEnabled: leadPulseEnabled(), leadAvailability: music.beat.leadAvailability,
            captureStatus: music.selected?.syncState, playback: { playing: music.selected?.playing, paused: music.selected?.paused, currentTime: music.selected?.currentTime },
            controller: { mode: music.beat.mode, reason: music.beat.reason, eventPath: music.beat.eventPath, onsets: music.beat.onsets } };
          const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
          const link = document.createElement('a'); link.href = url; link.download = fourRowBaseline ? 'kora-four-row-trace.json' : 'kora-live-grid-trace.json'; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}>Export row trace</button>
        </div>}
      </>
      <pre aria-label="Beat sync debug">{JSON.stringify({
      source: music.source, mode: music.beat.mode, reason: music.beat.reason, onsets: music.beat.onsets, rates: music.beat.rates,
      tempo: music.beat.tempo, tickCount: music.beat.tickCount, pattern: patternAt(music.selected?.currentTime || 0), captureId: music.beat.captureId,
      melody: music.beat.melody, lead: music.beat.lead, leadAvailability: music.beat.leadAvailability,
      eventPath: music.beat.eventPath, assetProvider: music.selected?.asset?.provider,
      visualAttacks:music.beat.visualAttacks?.slice(-4).map(a=>({band:a.band,deadlineMs:a.deadlineMs})),
      captureStatus: music.selected?.syncState, browserAnalysisSupported: music.selected?.canAnalyze,
    }, null, 2)}</pre></details>}
  </>;
}

export function MusicFeedback({ music }: { music: BrowserMusicController }) {
  const { t } = useI18n();
  const { selected, playing, busy, openMusicTab, error, beat } = music;
  const needsAccess = playing && (beat.mode !== 'capture' || beat.eventPath === 'degraded') && beat.reason === 'capture-permission';
  const outdatedCapturePolicy = beat.mode === 'clock' && (beat.reason === 'drm-protected' || selected?.syncState?.reason === 'drm-protected');
  const silentPlayback = playing && beat.mode === 'clock' && beat.reason === 'silent';
  return <div className="music-feedback">
    {playing && beat.eventPath && <p className="music-status muted" role="status">{t(`music.beatPath.${beat.eventPath}`)}</p>}
    {needsAccess && <div className="music-access" role="status">
      <p className="music-access-title">{t('music.beatAccessTitle')}</p>
      <p className="muted">{t('music.beatAccessHelp')}</p>
      <button type="button" className="solid" title={t('music.beatAccessHelp')} disabled={busy} onClick={() => void openMusicTab()}>{t('music.enableBeats')}</button>
    </div>}
    {silentPlayback && <p className="music-status muted" role="status">{t('music.silentCapture')}</p>}
    {outdatedCapturePolicy && <p className="music-status muted" role="status">{t('music.captureUpdate')}</p>}
    {error && <p className="music-status muted" role="status" title={error}>{error}</p>}
  </div>;
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
  const companion = useCompanionSetup();
  const beta=localHybridEnabled()&&music.beta?<HybridBetaControl beta={music.beta}/>:null;
  const delayRecovery=!music.selected&&music.sourceAudioDelay?.enabled?<SourceAudioDelayControl music={music}/>:null;
  if (music.connected || music.checking) return <>{beta}{delayRecovery}</>;
  if(nativeCompanionPreviewEnabled())return <div className="music-setup" role="status">
    <p>Private test Companion 0.3.28 is unavailable. Open the dedicated test browser; preserve your existing installed extensions.</p>
    <button type="button" className="text-button" onClick={music.refresh}>{t('music.checkAgain')}</button>
  </div>;
  return <>{beta}{delayRecovery}<div className="music-setup">
    {music.error && <p className="muted" role="status">{music.error}</p>}
    <div className="music-connect-actions">
      {isNativeWidget()
        ? <button className="install-button solid" type="button" disabled={companion.updating} onClick={() => void companion.run()}>
          {t(companion.updating ? 'music.companionUpdating' : 'music.addControls')}</button>
        : <a className="install-button solid" href={getMusicInstallUrl(language)} target="_blank" rel="noopener noreferrer">{t('music.addControls')}</a>}
      <button type="button" className="text-button" onClick={music.refresh}>{t('music.checkAgain')}</button>
    </div>
    {companion.message && <p className="muted" role="status" style={{ overflowWrap: 'anywhere' }}>{companion.message}</p>}
  </div></>;
}
