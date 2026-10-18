import type {useLocalHybridMusic} from './use-local-hybrid-music';
import {useState} from 'react';
import {beatTelemetry} from '../../../extensions/kanban-music/beat-telemetry.js';
type Beta=ReturnType<typeof useLocalHybridMusic>;
export default function HybridBetaControl({beta}:{beta:Beta}){
 const [research,setResearch]=useState(false);
 const cutoff=Number(beta.controller.selected?.sampledAt||0)-30000;
 const late=research?beatTelemetry.snapshot().records.filter(r=>r.stage==='EVENT_COMMITTED'&&r.captureId===beta.controller.beat.captureId&&Number(r.at)>=cutoff).map(r=>Math.max(0,Number(r.at)-Number(r.targetTime))).filter(Number.isFinite).sort((a,b)=>a-b):[];
 return <section className="hybrid-beta-controls" aria-label="Beat Grid Hybrid Beta">
  <label><input type="checkbox" checked={beta.enabled} onChange={e=>beta.setEnabled(e.target.checked)}/> Beat Grid Hybrid — Beta</label>
  {beta.enabled&&<><p>Private local playback · ADTOF Kick/Snare + CNN Hi-Hat · existing Bass. Predictions may miss or misidentify instruments.</p>
   <details open={!beta.id}><summary>Local recording and visual envelope</summary>
   <label>Local recording <select aria-label="Beta local recording" value={beta.id} onChange={e=>beta.setId(e.target.value)}><option value="">Choose a prepared recording</option>{beta.entries.map(e=><option key={e.id} value={e.id}>{e.filename} · {e.id.slice(0,12)} · {e.status.models.A?.state==='READY'&&e.status.models.B?.state==='READY'?'H0 ready':e.status.state}</option>)}</select></label>
   <label>Choose authorized local audio <input aria-label="Beta local audio file" type="file" disabled={beta.controller.busy} accept=".mp3,.wav,.flac,audio/*" onChange={e=>{const f=e.target.files?.[0];if(f)void beta.chooseFile(f);e.target.value='';}}/></label>
   <label>Visual envelope <select aria-label="Beta visual envelope" value={beta.renderer} onChange={e=>beta.setRenderer(e.target.value)}><option value="short">Short Attack</option><option value="original">Original</option></select></label>
   </details>
   <label><input type="checkbox" checked={beta.melody} disabled={beta.clip?.lead?.state!=='READY'} onChange={e=>beta.setMelody(e.target.checked)}/> Melody / Lead (saved analysis)</label>
   <p>{beta.clip?.lead?.state==='READY'?'Exact saved Lead reference available. Pitched notes and vocal articulation retain their original provenance; recognition is unverified.':beta.clip?.lead?.reason||'No eligible saved Lead analysis selected.'}</p>
   <p role="status">{beta.status}</p>{beta.error&&<p role="alert">{beta.error}</p>}
   <details onToggle={e=>setResearch(e.currentTarget.open)}><summary>Developer / research diagnostics</summary><p>Source: owned local file. Detector: frozen H0. Path: precomputed percussion + independent Bass. Live CNN: unavailable. No intentional audio delay. Speaker-to-pixel synchronization unverified.</p><p>Runtime percussion lookahead: none (precomputed). Software DOM lateness p95, last 30 seconds: {late.length?late[Math.ceil((late.length-1)*.95)].toFixed(1)+' ms ('+late.length+' observations)':'not measured'}. This is a software clock measurement.</p><p>Source SHA: {beta.id||'unselected'}</p><output aria-label="Hybrid event counters">Kick {beta.controller.beat.onsets.kick||0} · Snare {beta.controller.beat.onsets.clap||0} · Hat {beta.controller.beat.onsets.hat||0} · Bass {beta.controller.beat.onsets.bass||0} · Melody {beta.controller.beat.melody?.note||0}</output><pre aria-label="Hybrid audio status">{JSON.stringify(beta.audioStatus,null,2)}</pre><p>Inference backlog: N/A for precomputed percussion. First-run preprocessing readiness is separate from playback.</p><button type="button" onClick={beta.exportTrace}>Export Hybrid technical trace</button><pre>{JSON.stringify(beta.clip?.hybrid,null,2)}</pre></details>
  </>}
 </section>;
}
