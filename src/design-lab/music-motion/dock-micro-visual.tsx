import { useEffect, useRef, useState } from 'react';
import type { BrowserMusicController } from '../../features/music/useBrowserMusic';
import MicroScene from './micro-scene';
import { createOnsetActivity, previewActivity, quietActivity } from './visual-activity';
import microCss from './micro-visual.css?inline';

export interface MicroInput { playing: boolean; sample: (dt: number, time: number) => ReturnType<typeof quietActivity> }

/** Dev-only dock experiment. Uses the dock's existing music owner and subscription. */
export default function DockMicroVisual({ music }: { music: BrowserMusicController }) {
  const [mode, setMode] = useState<'vinyl' | 'orbit'>('vinyl');
  const [preview, setPreview] = useState(true);
  const [paused, setPaused] = useState(false), [silence, setSilence] = useState(false), [low, setLow] = useState(false);
  const adapter = useRef(createOnsetActivity());
  const input = useRef<MicroInput>({ playing: true, sample: (_dt, time) => previewActivity(time) });
  useEffect(() => { adapter.current.reset(); }, [music.selected?.id, music.beat.captureId, music.playing, preview]);
  useEffect(() => { adapter.current.observe(music.beat.onsets); }, [music.beat.onsets]);
  useEffect(() => {
    input.current = preview ? { playing: !paused, sample: (_dt, time) => previewActivity(time, silence) }
      : { playing: music.playing && music.beat.mode === 'capture', sample: dt => adapter.current.sample(dt) };
  }, [preview, paused, silence, music.playing, music.beat.mode]);
  return <div className="km-widget" aria-label="Private music micro-visualizer">
    <style>{microCss}</style>
    <div className="km-top"><div role="group" aria-label="Micro visualizer mode">
      <button type="button" aria-pressed={mode === 'vinyl'} onClick={() => setMode('vinyl')}>Vinyl</button>
      <button type="button" aria-pressed={mode === 'orbit'} onClick={() => setMode('orbit')}>Orbit</button>
    </div><button type="button" className="km-play" onClick={() => preview ? setPaused(!paused) : void music.toggle()}
      disabled={!preview && (!music.selected || music.busy)} aria-label={preview ? paused ? 'Resume visual preview' : 'Pause visual preview' : music.playing ? 'Pause music' : 'Play music'}>
      {preview ? paused ? '▶' : 'Ⅱ' : music.playing ? 'Ⅱ' : '▶'}</button></div>
    <MicroScene key={`${mode}:${preview}`} mode={mode} input={input} low={low} />
    <div className="km-status" role="status">{preview ? 'Synthetic preview · silent' : music.beat.mode === 'capture' && music.playing ? 'Companion · live onset activity' : 'Companion · waiting for active capture'}</div>
    <details className="km-settings"><summary>Preview settings</summary><div>
      <label><input type="checkbox" checked={!preview} onChange={e => setPreview(!e.target.checked)} />Use Companion</label>
      {preview && <label><input type="checkbox" checked={silence} onChange={e => setSilence(e.target.checked)} />Silence</label>}
      <label><input type="checkbox" checked={low} onChange={e => setLow(e.target.checked)} />Low power</label>
      <small>Artistic onset envelopes, not measured RMS/spectrum. No new capture.</small>
    </div></details>
  </div>;
}
