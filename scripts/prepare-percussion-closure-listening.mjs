// Private audio stays in ignored target; no production page or model is shipped.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory=resolve('src-tauri/target/percussion-closure');
const manifest=JSON.parse(await readFile(resolve(directory,'audio/manifest.json'),'utf8'));
await writeFile(resolve(directory,'listen.html'),`<!doctype html><html><head><meta charset="utf-8"><title>Private percussion comparison</title><style>
body{margin:24px;background:#eef0f7;color:#202335;font:15px system-ui}main{max-width:1000px;margin:auto}select,button,textarea{font:inherit;padding:8px;margin:5px;border-radius:8px;border:1px solid #abb0c9}audio{width:100%}.panel{padding:20px;margin:18px 0;border:1px solid white;border-radius:22px;background:linear-gradient(120deg,#cfdbfa99,#e8d9f799);box-shadow:0 12px 36px #28345e22}.labels{display:flex;gap:12px;flex-wrap:wrap}.labels label{flex:1}textarea{width:90%;height:80px}#root .music-semantic-grid{width:100%}small{color:#555b74}
</style></head><body><main><h1>Private Rows 1–3 comparison</h1><p>One causal candidate, preserved ADTOF reference, and a precomputed range through the existing scheduler. Melody is disabled. The causal candidate fails negative-control and full-mix accuracy gates. No model output is human ground truth.</p><div id="root"></div></main><script type="module" src="./listen.tsx?run=${Date.now()}"></script></body></html>`);
await writeFile(resolve(directory,'listen.tsx'),`
import React,{useState,useEffect,useMemo,useRef} from 'react';import {createRoot} from 'react-dom/client';
import SemanticBeatPattern from '../../../src/features/music/SemanticBeatPattern';
import {useMusicBeatSync} from '../../../src/features/music/useMusicBeatSync';
import {beatTelemetry} from '../../../extensions/kanban-music/beat-telemetry.js';
import '../../../src/components/focus/floatingFocus.css';
const inputs=${JSON.stringify(manifest)};
beatTelemetry.enable();let subscription,sequence=0,owner=0;const traces=[];
window.__privateListeningTrace=()=>traces.concat(beatTelemetry.snapshot().records);
window.addEventListener('message',e=>{const r=e.data;if(e.source!==window||r?.direction!=='app-to-extension')return;
subscription=r.subscriptionId;window.postMessage({channel:r.channel,direction:'extension-to-app',requestId:r.requestId,ok:true},location.origin);});
function deliver(event){window.postMessage({channel:'kanban-music-v1',direction:'extension-event',event:'beat',sessionId:'private-listening',subscriptionId:subscription,emittedAt:Date.now(),...event,...(event.kind==='onset'?{sequence:++sequence}:{})},location.origin);}
function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const clockListener=()=>{};
function Grid({track,mode,playing}){const options=useMemo(()=>({demand:mode==='cache',duration:track.duration,
 ...(mode==='cache'?{asset:{provider:'soundcloud',id:'private-local/'+track.input}}:{}),
 capabilities:{tier:'tab-capture',captureClock:'output-clock-capable'}}),[track,mode]);
 const beat=useMusicBeatSync('private-listening',clockListener,options);
 return <SemanticBeatPattern session={{id:'private-listening',title:track.input,playing}} beat={beat} melodyEnabled={false}/>;}
function App(){const [index,setIndex]=useState(6),[mode,setMode]=useState('cache'),[playing,setPlaying]=useState(false),[status,setStatus]=useState('ready');
 const [annotations,setAnnotations]=useState({});const media=useRef(null),engine=useRef(null);const track=inputs[index];
 const [rows,setRows]=useState({kick:'',snare:'',hat:''});const [verified,setVerified]=useState(false);const [time,setTime]=useState(0);
 useEffect(()=>{const prior=annotations[track.input];setRows(prior?.text||{kick:'',snare:'',hat:''});setVerified(prior?.verified||false);},[track.input]);
 useEffect(()=>{const ticket=++owner;let interval,context,live=true;const element=media.current;let generation=0;
 setStatus('loading');const sourceChanged=()=>generation++;
 const clock=()=>({currentTime:element.currentTime,sampledAt:Date.now(),duration:track.duration,playbackRate:element.playbackRate,
 playing:!element.paused,paused:element.paused,seeking:element.seeking,buffering:element.readyState<3&&!element.paused,generation});
 const forward=e=>{if(live&&ticket===owner)deliver(e);};
 const sample=()=>{forward({kind:'clock',clock:clock()});setTime(element.currentTime);setPlaying(!element.paused);};
 element.addEventListener('seeking',sourceChanged);element.src='./audio/'+track.file;element.load();
 void (async()=>{const folder=mode==='reference'?'../percussion-latency/candidate':'./companion';
 const {createCaptureEngine}=await import(folder+'/capture-engine.js');const {playbackTiming}=await import(folder+'/beat-timing.js');
 if(!live)return;const active=createCaptureEngine({monitorOnly:true,getUserMedia:async()=>element.captureStream(),
 createAudioContext:()=>context=new AudioContext({sampleRate:44100}),onStop:()=>{},
 onAudible:id=>forward({kind:'sync.state',mode:'capture',captureId:id}),
 onBeat:(id,bands,telemetry,timing)=>forward({kind:'onset',captureId:id,bands,telemetry,...playbackTiming(clock(),timing)}),onTempo:()=>{},onTempoTick:()=>{}});
 engine.current=active;interval=setInterval(()=>{active.renew('private-capture');sample();traces.push(...beatTelemetry.snapshot().records);beatTelemetry.clear();if(traces.length>12000)traces.splice(0,traces.length-12000);},50);
 const start=async()=>{await context?.resume();if(live&&!context){setStatus('starting capture');await active.start('private','private-capture');setStatus('playing '+mode);}sample();};
 element.addEventListener('play',start);element.__start=start;setStatus('ready — press Play');})();
 return()=>{live=false;owner++;clearInterval(interval);engine.current?.stop();engine.current=null;element.pause();element.removeEventListener('seeking',sourceChanged);if(element.__start)element.removeEventListener('play',element.__start);};
 },[track,mode]);
 const edit=(row,text)=>{const next={...rows,[row]:text};setRows(next);setAnnotations({...annotations,[track.input]:{text:next,verified:false}});setVerified(false);};
 const exportLabels=()=>{const data=inputs.map(t=>{const a=t.input===track.input?{text:rows,verified}:annotations[t.input];
 return {input:t.input,start:0,end:t.duration,origin:'human',verified:Boolean(a?.verified),rows:Object.fromEntries(['kick','snare','hat'].map(r=>[r,a?.text?.[r]?a.text[r].split(/[ ,\\n]+/).filter(Boolean).map(Number):a?.verified?[]:null]))};});download('percussion-human-annotations.json',data);};
 return <><div className="panel"><select aria-label="Excerpt" value={index} onChange={e=>setIndex(Number(e.target.value))}>{inputs.map((t,i)=><option value={i} key={t.input}>{t.input} · {t.split}</option>)}</select>
 <select aria-label="Inference path" value={mode} onChange={e=>setMode(e.target.value)}><option value="cache">Precomputed ADTOF range</option><option value="causal">Causal student — failed quality gate</option><option value="reference">Preserved ADTOF first playback</option></select>
 <p>{track.identity} · {status} · {time.toFixed(2)} s</p><audio ref={media} controls/><Grid key={track.input+mode} track={track} mode={mode} playing={playing}/>
 <button onClick={()=>download('percussion-render-trace.json',traces)}>Export render trace</button></div>
 <div className="panel"><h2>Independent listening labels</h2><p>Enter only attacks you hear, in seconds relative to this excerpt. Model events are not filled into these fields. Empty verified lists mean that row is absent throughout the excerpt.</p>
 <div className="labels">{['kick','snare','hat'].map(row=><label key={row}>{row}<textarea aria-label={row+' timestamps'} value={rows[row]} onChange={e=>edit(row,e.target.value)}/><button onClick={()=>edit(row,(rows[row]+' '+media.current.currentTime.toFixed(3)).trim())}>Mark current time</button></label>)}</div>
 <label><input type="checkbox" checked={verified} onChange={e=>{setVerified(e.target.checked);setAnnotations({...annotations,[track.input]:{text:rows,verified:e.target.checked}});}}/> I checked all three rows throughout this excerpt.</label>
 <button onClick={exportLabels}>Export human annotations</button><small>Button timing includes human reaction delay; replay and edit timestamps before verification. No positive accuracy score is claimed until labels are checked.</small></div></>;
}createRoot(document.getElementById('root')).render(<App/>);
`);
console.log(resolve(directory,'listen.html'));
