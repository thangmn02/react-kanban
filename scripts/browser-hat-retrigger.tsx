// Renderer-only construction: these events are never recognition evidence.
import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import BeatPattern from '../src/features/music/BeatPattern';
import type {MusicBeatState} from '../src/features/music/useMusicBeatSync';
import {beatTelemetry} from '../extensions/kanban-music/beat-telemetry.js';
import '../src/components/focus/floatingFocus.css';
import './browser-beat-candidate.css';
import './browser-hat-transient.css';
const session={id:'renderer-only',title:'Known-event renderer diagnostic',source:'local',artist:'',currentTime:0,sampledAt:Date.now(),playbackRate:1,playing:true,paused:false};
const initial:MusicBeatState={sessionId:session.id,mode:'capture',captureId:'renderer-only',onsets:{},rates:{hat:1}};
export function Renderer(){
  const [mode,setMode]=useState('A'),[beat,setBeat]=useState(initial);
  useEffect(()=>{
    Object.assign(window,{hatRenderer:{setMode,async run(intervalMs:number,patternTime:number){
      beatTelemetry.enable();beatTelemetry.clear();
      const emitted=[];flushSync(()=>setBeat({...initial}));
      const start=Date.now()+250;
      for(let i=0;i<6;i++){
        const at=start+i*intervalMs;await new Promise(done=>setTimeout(done,Math.max(0,at-Date.now())));
        const raw=beatTelemetry.events('onset',['hat'],{captureId:'renderer-only'})![0];
        const trace={...raw,id:`T5:${mode}:${intervalMs}:${i}`,targetTime:at,targetClock:'epoch-ms' as const,targetPlaybackTime:patternTime+i*intervalMs/1000};
        emitted.push({id:trace.id,targetAt:at,emittedAt:Date.now(),sourceTime:trace.targetPlaybackTime});
        session.currentTime=patternTime;
        flushSync(()=>setBeat({...initial,onsets:{hat:i+1},telemetry:{'onset:hat':trace}}));
      }
      await new Promise(done=>setTimeout(done,900));
      return {mode,intervalMs,patternTime,rendererOnly:true,emitted,telemetry:beatTelemetry.snapshot()};
    }}});
  },[mode]);
  return <main className={`private-beat-candidate ${mode==='R'?'hat-transient-preview':''}`}>
    <h1>Renderer-only known-event diagnostic</h1><p>Not model output. {mode==='R'?'40 ms Hat transient prototype':'Existing visual envelope'}</p>
    <div className="candidate-grid"><BeatPattern session={session} beat={beat} palette="ultraviolet" colorMode="pastel" semanticOnly={false}/></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Renderer/>);
