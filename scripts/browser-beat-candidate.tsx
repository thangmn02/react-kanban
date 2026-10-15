import React,{useCallback,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {sendMusicRequest,configureExperimentalSynchronization,type BrowserMusicSession,type MusicClock} from '../src/features/music/mediaBridge';
import {useMusicBeatSync} from '../src/features/music/useMusicBeatSync';
import BeatPattern from '../src/features/music/BeatPattern';
import ExperimentalBeatControl from '../src/features/music/experimental-beat-control';
import {beatTelemetry} from '../extensions/kanban-music/beat-telemetry.js';
import '../src/components/focus/floatingFocus.css';
import './browser-beat-candidate.css';
beatTelemetry.enable();
const options={privateCandidate:true,demand:false,capturedInput:false,capabilities:{tier:'tab-capture' as const,captureClock:'output-clock-capable' as const}};
export function Candidate() {
  const [sessions,setSessions]=useState<BrowserMusicSession[]>([]),[id,setId]=useState(''),[error,setError]=useState('');
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
    Object.assign(window,{candidate:{selected,beat,error,telemetry:beatTelemetry.snapshot()},
      configureExperimentalSynchronization,selectCandidate:setId,refreshCandidate:refresh});
  },[selected,beat,error,refresh]);
  return <main className="private-beat-candidate">
    <h1>Private Beat Grid listening candidate</h1><p>Experimental only. Model accuracy and physical synchronization remain unverified. No cloud analysis.</p>
    {capability?.detectorVersion.startsWith('xo-')&&<p><strong>UNVERIFIED DETECTOR PREVIEW · {capability.detectorVersion==='xo-A'?'Baseline A':'Candidate B · NO-GO for adoption'}</strong></p>}
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
