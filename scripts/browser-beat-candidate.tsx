import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {sendMusicRequest,configureExperimentalSynchronization,type BrowserMusicSession,type MusicClock} from '../src/features/music/mediaBridge';
import {useMusicBeatSync} from '../src/features/music/useMusicBeatSync';
import BeatPattern from '../src/features/music/BeatPattern';
import ExperimentalBeatControl from '../src/features/music/experimental-beat-control';
import {beatTelemetry} from '../extensions/kanban-music/beat-telemetry.js';
import '../src/components/focus/floatingFocus.css';
import './browser-beat-candidate.css';
import './browser-hat-transient.css';
beatTelemetry.enable();
const options={privateCandidate:true,demand:false,capturedInput:false,capabilities:{tier:'tab-capture' as const,captureClock:'output-clock-capable' as const}};
export function Candidate() {
  const [sessions,setSessions]=useState<BrowserMusicSession[]>([]),[id,setId]=useState(''),[error,setError]=useState('');
  const [firstFrames,setFirstFrames]=useState<{traceId:string;eventId:string;sourceTime:number|null;observedAt:number;performanceNow:number;opacity:number}[]>([]);
  const frameRecording=useRef(false),frameSeen=useRef(new Set<string>());
  useEffect(()=>{
    let frame=0;
    const observe=()=>{
      if(frameRecording.current){
        const next:typeof firstFrames=[];
        for(const element of document.querySelectorAll<HTMLElement>('.candidate-grid .semantic-beat-flash[data-beat-trace]')){
          const traceId=element.dataset.beatTrace!,style=getComputedStyle(element),rect=element.getBoundingClientRect();
          if(frameSeen.current.has(traceId)||style.display==='none'||style.visibility==='hidden'||Number(style.opacity)<.5||rect.top<0||rect.bottom>innerHeight)continue;
          frameSeen.current.add(traceId);next.push({traceId,eventId:element.dataset.eventId||traceId,sourceTime:element.dataset.targetPlaybackTime?Number(element.dataset.targetPlaybackTime):null,observedAt:Date.now(),performanceNow:performance.now(),opacity:Number(style.opacity)});
        }
        if(next.length)setFirstFrames(previous=>[...previous,...next].slice(-2048));
        if(frameSeen.current.size>4096)frameRecording.current=false;
      }
      frame=requestAnimationFrame(observe);
    };frame=requestAnimationFrame(observe);return()=>cancelAnimationFrame(frame);
  },[]);
  const refresh=useCallback(()=>{void sendMusicRequest('sessions.get').then(value=>{setSessions(value);setError('');}).catch(()=>setError('Companion unavailable'));},[]);
  useEffect(()=>{refresh();const timer=setInterval(refresh,2000);return()=>clearInterval(timer);},[refresh]);
  const selected=sessions.find(session=>session.id===id)||sessions[0];
  const updateClock=useCallback((sessionId:string,clock:MusicClock)=>setSessions(current=>current.map(session=>session.id===sessionId?{...session,...clock}:session)),[]);
  const beat=useMusicBeatSync(selected?.id,updateClock,options,false);
  const capability=selected?.syncState?.capability;
  const captured=selected?.syncState?.mode==='capture';
  const preview=captured&&capability?.allowTypedPreview===true;
  const visibleBeat=captured?beat:{...beat,mode:'clock' as const,onsets:{}};
  useEffect(()=>{
    Object.assign(window,{candidate:{selected,beat,error,telemetry:beatTelemetry.snapshot(),firstObservedFrames:firstFrames},
      configureExperimentalSynchronization,selectCandidate:setId,refreshCandidate:refresh});
  },[selected,beat,error,refresh,firstFrames]);
  return <main className={`private-beat-candidate ${capability?.detectorVersion==='hat-R'?'hat-transient-preview':''}`} data-visual-experiment={capability?.detectorVersion==='hat-R'?'hat-transient-40ms':'baseline-150ms'}>
    <h1>Private Beat Grid listening candidate</h1><p>Experimental only. Model accuracy and physical synchronization remain unverified. No cloud analysis.</p>
    <p><a href="/lab/" style={{color:'#c9b2ff'}}>Open private A/B Listening Lab</a> · One exact audio clock, blind annotations and saved A/B/C predictions. Requires the diagnostic lab server.</p>
    <details><summary>Private live pipeline trace</summary><p>This view exercises the actual baseline Companion path. Export records before its bounded 2,048-entry log evicts them. Missing worker/Companion realm records remain unavailable; they do not prove transport loss. DOM animation callbacks do not prove separate perceived flashes.</p>
      <button onClick={()=>{beatTelemetry.clear();frameSeen.current.clear();setFirstFrames([]);frameRecording.current=true;setError('');}}>Start fresh app trace</button>
      <button onClick={()=>{const value={version:1,mode:'actual-live-baseline-app-trace',exportedAt:new Date().toISOString(),selectedSource:selected?{id:selected.id,title:selected.title,source:selected.source,asset:selected.asset,captureId:selected.syncState?.captureId,generation:selected.generation,currentTime:selected.currentTime}:null,
        sourceBinding:'Session metadata only; bind captured audio independently before acoustic/source-offset conclusions.',telemetry:beatTelemetry.snapshot(),beat,
        firstObservedFrames:firstFrames,frameMeasurement:'First >=0.5 computed opacity on an in-viewport semantic flash, sampled with requestAnimationFrame. This is not physical visibility or a count of perceptually distinct attacks.',
        unavailableStages:['worker raw activations unless separately exported','Companion/offscreen realm records unless separately exported','physical speaker-to-pixel timing'],physicalVerified:false};
        const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='private-live-baseline-trace.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Export app trace JSON</button>
      <p>For the exact saved passage, use the <a href="http://127.0.0.1:5174/" target="_blank" style={{color:'#c9b2ff'}}>local diagnostic source</a> and enable the existing private Companion capture and live preview. Stop offline playback first.</p>
      <p aria-label="Live first-frame count">First-frame trace IDs observed: {firstFrames.length}. Frame samples require a visible foreground grid; this does not establish separate perceived flashes.</p>
    </details>
    {capability?.detectorVersion.startsWith('xo-')&&<p><strong>UNVERIFIED DETECTOR PREVIEW · {capability.detectorVersion==='xo-A'?'Baseline A':'Candidate B · NO-GO for adoption'}</strong></p>}
    {capability?.detectorVersion.startsWith('hat-')&&<p><strong>UNVERIFIED DETECTOR PREVIEW · {capability.detectorVersion==='hat-A'?'Baseline A · existing visuals':'Recovery R · Hat visualization only; detector unchanged'}</strong></p>}
    {capability?.detectorVersion==='hat-R'&&<p>Hat flashes use a shorter transient. Dense 20–30 ms activity may still fuse. Reduced motion shows sustained activity rather than separate flashes.</p>}
    <p role="status">{error||`${sessions.length} source(s) · ${selected&&!captured?'capture not enabled':beat.eventPath||'waiting'}`}</p>
    <p>Use Chrome or Edge with Kora Music Companion Private. Play audio in the source tab, then click Companion’s toolbar icon on that tab to enable capture.</p>
    <select aria-label="Source" value={selected?.id||''} onChange={event=>setId(event.target.value)}>
      {sessions.map(session=><option key={session.id} value={session.id}>{session.title} · {session.source}</option>)}
    </select><button onClick={refresh}>Refresh</button>
    {selected&&<><button onClick={()=>void sendMusicRequest(selected.paused?'media.play':'media.pause',selected.id).then(refresh)}>{selected.paused?'Play':'Pause'}</button>
      <button onClick={()=>void sendMusicRequest('media.focus',selected.id).catch(()=>setError('Unable to focus source tab'))}>Open source tab</button>
      <div className="candidate-grid"><BeatPattern session={selected} beat={visibleBeat} palette="ultraviolet" colorMode="pastel"/></div>
      <section className="candidate-status" aria-label="Capture and preview status">
        <p>{!captured?'Capture is not enabled for this source. Open its tab and click Companion’s toolbar icon.'
          :!capability?.privateCandidate?'Capture is connected, but private capabilities are unavailable. Check that the private Companion is loaded and reload both pages.'
          :preview?capability.mode==='experimental-live'?'Unverified live preview enabled. No intentional audio delay; instrument flashes may lag or be incorrect.'
            :'Unverified instrument preview enabled. Row flashes show model predictions, not verified drum hits.'
          :capability.sourceKind==='video'?'Instrument preview is off. Use “Enable live preview (no audio delay)” below while the video keeps playing. Video cannot use the calibrated audio delay.'
          :'Instrument preview is off. Enable live preview below while playing, or calibrate and pause to use the optional audio-only delay.'}</p>
        <p>{!captured?'The grid stays idle until capture is enabled.':selected.paused?'Playback is paused.':preview?'Playback is running.': 'The border pulse is decorative playback feedback. It does not identify instruments or measure musical accuracy.'}</p>
        {preview&&<p aria-label="Preview event counts">Preview events · Kick {beat.onsets.kick||0} · Snare {beat.onsets.clap||0} · Cymbal {beat.onsets.hat||0} · Bass {beat.onsets.bass||0}</p>}
      </section>
      <ExperimentalBeatControl key={selected.id} session={selected} refresh={refresh} initiallyOpen/></>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Candidate/>);
