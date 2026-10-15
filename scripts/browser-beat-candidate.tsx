import React,{useCallback,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {sendMusicRequest,configureExperimentalSynchronization,type BrowserMusicSession,type MusicClock} from '../src/features/music/mediaBridge';
import {useMusicBeatSync} from '../src/features/music/useMusicBeatSync';
import BeatPattern from '../src/features/music/BeatPattern';
import ExperimentalBeatControl from '../src/features/music/experimental-beat-control';
import {beatTelemetry} from '../extensions/kanban-music/beat-telemetry.js';
import '../src/components/focus/floatingFocus.css';
beatTelemetry.enable();
const options={privateCandidate:true,demand:false,capturedInput:false,capabilities:{tier:'tab-capture' as const,captureClock:'output-clock-capable' as const}};
export function Candidate() {
  const [sessions,setSessions]=useState<BrowserMusicSession[]>([]),[id,setId]=useState(''),[error,setError]=useState('');
  const refresh=useCallback(()=>{void sendMusicRequest('sessions.get').then(value=>{setSessions(value);setError('');}).catch(()=>setError('Companion unavailable'));},[]);
  useEffect(()=>{refresh();const timer=setInterval(refresh,2000);return()=>clearInterval(timer);},[refresh]);
  const selected=sessions.find(session=>session.id===id)||sessions[0];
  const updateClock=useCallback((sessionId:string,clock:MusicClock)=>setSessions(current=>current.map(session=>session.id===sessionId?{...session,...clock}:session)),[]);
  const beat=useMusicBeatSync(selected?.id,updateClock,options,false);
  useEffect(()=>{
    Object.assign(window,{candidate:{selected,beat,error,telemetry:beatTelemetry.snapshot()},
      configureExperimentalSynchronization,selectCandidate:setId,refreshCandidate:refresh});
  },[selected,beat,error,refresh]);
  return <main style={{background:'#18181c',color:'#eee',padding:24,minHeight:'100vh',fontFamily:'system-ui'}}>
    <h1>Private Beat Grid listening candidate</h1><p>Experimental only. Model accuracy and physical synchronization remain unverified. No cloud analysis.</p>
    <p role="status">{error||`${sessions.length} source(s) · ${beat.eventPath||'waiting'}`}</p>
    <select aria-label="Source" value={selected?.id||''} onChange={event=>setId(event.target.value)}>
      {sessions.map(session=><option key={session.id} value={session.id}>{session.title} · {session.source}</option>)}
    </select><button onClick={refresh}>Refresh</button>
    {selected&&<><button onClick={()=>void sendMusicRequest(selected.paused?'media.play':'media.pause',selected.id).then(refresh)}>{selected.paused?'Play':'Pause'}</button>
      <ExperimentalBeatControl key={selected.id} session={selected} refresh={refresh}/>
      <BeatPattern session={selected} beat={beat}/></>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Candidate/>);
