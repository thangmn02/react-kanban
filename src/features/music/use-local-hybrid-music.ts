import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createLocalAudioTransport} from './local-audio-transport';
import {localHybridClient,type LocalHybridClip} from './local-hybrid-track';
import {useMusicBeatSync} from './useMusicBeatSync';
import type {BrowserMusicSession,MusicAction} from './mediaBridge';
import {beatTelemetry} from '../../../extensions/kanban-music/beat-telemetry.js';
import {isNativeWidget} from '../native/runtime';
export const localHybridEnabled=()=>import.meta.env.DEV&&import.meta.env.VITE_PRIVATE_LOCAL_HYBRID==='true';
interface Entry {id:string;filename:string;status:{state:string;models:Record<string,{state:string}>}}
async function json<T>(url:string,init?:RequestInit):Promise<T>{const r=await fetch(url,{...init,credentials:'omit'});if(!r.ok)throw Error(await r.text());return r.json();}
export function useLocalHybridMusic(demand:boolean){
 const [enabled,setEnabled]=useState(false),[entries,setEntries]=useState<Entry[]>([]),[id,setId]=useState(''),[clip,setClip]=useState<LocalHybridClip>(),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('Select an authorized local recording.'),[session,setSession]=useState<BrowserMusicSession>(),[renderer,setRenderer]=useState('short'),[melody,setMelody]=useState(false);
 const [audio]=useState(()=>new Audio()),[transport]=useState(()=>createLocalAudioTransport(audio));const epoch=useRef(0),binding=useRef('');
 const refresh=useCallback(async()=>{const c=await json<{retained:Record<string,Entry>}>('/lab/full/songs');setEntries(Object.values(c.retained));},[]);
 useEffect(()=>{if(!enabled)return;beatTelemetry.enable();void refresh().catch(e=>setError(String(e)));const timer=setInterval(()=>void refresh().catch(e=>setError(String(e))),2000);return()=>clearInterval(timer);},[enabled,refresh]);
 useEffect(()=>()=>{audio.pause();audio.removeAttribute('src');audio.load();transport.dispose();},[audio,transport]);
 const selected=entries.find(e=>e.id===id);
 const modelState=JSON.stringify(Object.entries(selected?.status.models||{}).map(([m,s])=>[m,s.state]));
 useEffect(()=>{
  ++epoch.current;binding.current='';audio.pause();audio.removeAttribute('src');audio.load();setLoaded(false);setClip(undefined);setSession(undefined);setError('');
 },[enabled,id,audio]);
 useEffect(()=>{
  const owner=epoch.current;
  if(!enabled||!id)return;setStatus('Checking exact local recording and frozen analysis…');const abort=new AbortController();
  void json<LocalHybridClip>('/lab/full/clip/'+id,{signal:abort.signal}).then(c=>{
   if(owner!==epoch.current)return;if(!c){setStatus('Exact recording is still being prepared.');return;}if(c.originalSourceSha256!==id||c.sampleRate!==44100)throw Error('Exact source identity mismatch');
   if(c.hybrid.state==='READY')localHybridClient(c,false);
   if(c.lead?.state==='READY')localHybridClient(c,true);
   const next=[id,c.canonicalWavSha256,c.decodedPcmSha256,c.end].join(':');
   if(binding.current!==next){audio.pause();binding.current=next;setLoaded(false);audio.src=c.audioUrl+'?v='+c.canonicalWavSha256;audio.preload='metadata';audio.load();}
   setClip(c);setStatus(c.hybrid.state==='READY'?'Frozen H0 ready. Predictions can miss or misidentify instruments.':'Hybrid analysis incomplete; Bass remains independent. '+(c.hybrid.reason||''));
  }).catch(e=>{if(!abort.signal.aborted&&owner===epoch.current)setError(String(e));});return()=>abort.abort();
 },[enabled,id,modelState,audio]);
 const publish=useCallback(()=>{
  if(!enabled||!clip||!id||audio.readyState<1||Math.abs(audio.duration-clip.end)>.1)return;
  setSession({id:'owned:'+id,title:selected?.filename||'Authorized local recording',artist:'',source:'owned-local',playing:!audio.paused&&!audio.ended,paused:audio.paused,currentTime:audio.currentTime,duration:clip.end,volume:audio.volume,muted:audio.muted,playbackRate:audio.playbackRate,sampledAt:Date.now(),canControl:true,canSeek:true,canAnalyze:true});
 },[enabled,clip,id,selected?.filename,audio]);
 useEffect(()=>{const ready=()=>{if(!clip||Math.abs(audio.duration-clip.end)>.1){setLoaded(false);if(clip)setError('Local audio duration does not match its saved analysis.');return;}setLoaded(true);publish();};audio.addEventListener('loadedmetadata',ready);if(audio.readyState>=1)ready();const timer=setInterval(publish,100);const failed=()=>setError('Local audio could not be loaded. Verify the private runtime and exact recording.');audio.addEventListener('error',failed);return()=>{audio.removeEventListener('loadedmetadata',ready);audio.removeEventListener('error',failed);clearInterval(timer);};},[audio,publish,clip]);
 const eventOptions=useMemo(()=>({duration:clip?.end,capabilities:{tier:'tab-capture' as const,captureClock:'output-clock-capable' as const},eventTrackClient:clip&&(clip.hybrid.state==='READY'||melody&&clip.lead?.state==='READY')?localHybridClient(clip,melody):undefined,independentLocalRows:['bass'] as const,transport}),[clip,melody,transport]);
 const onClock=useCallback(()=>{},[]);
 const beat=useMusicBeatSync(enabled&&loaded?session?.id:undefined,onClock,eventOptions,enabled&&demand);
 async function toggle(){if(!loaded)return;try{setError('');if(audio.paused){await transport.audible();await audio.play();}else audio.pause();publish();}catch(e){setError(String(e));}}
 async function control(action:Extract<MusicAction,'media.seek'|'media.volume'|'media.previous'|'media.next'>,value?:number){if(!loaded)return;if(action==='media.seek'&&Number.isFinite(value))audio.currentTime=Math.max(0,Math.min(clip?.end||0,value!));if(action==='media.volume'&&Number.isFinite(value))audio.volume=Math.max(0,Math.min(1,value!));publish();}
 async function chooseFile(file:File){
  if(busy)return;if(file.size>256*1024**2){setError('Local file exceeds 256 MiB limit.');return;}const owner=epoch.current;audio.pause();setBusy(true);setError('');
  try{const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
   if(owner!==epoch.current)return;const existing=entries.find(e=>e.id===sha);if(existing){setId(sha);setStatus('Exact stored recording selected; no inference requested.');}
   else{setStatus('Preparing selected audio on this computer only. First-run frozen A/B analysis can take several minutes.');await json('/lab/full/upload?slot=retained',{method:'POST',headers:{'X-Audio-Filename':encodeURIComponent(file.name)},body:file});if(owner!==epoch.current)return;await refresh();if(owner===epoch.current)setId(sha);}
  }catch(e){if(owner===epoch.current)setError('Local analysis runtime unavailable: '+String(e));}finally{setBusy(false);}
 }
 function exportTrace(){const records=beatTelemetry.snapshot(),value={version:1,rollout:'PRIVATE_LOCAL_BETA',platform:isNativeWidget()?'Desktop':'Web',detector:'H0',eventPath:'precomputed percussion + existing live Bass',source:clip,session,controller:beat,transport:transport.diagnostics(),telemetry:records,acousticAccuracy:'UNVERIFIED',physicalSynchronization:'UNVERIFIED',liveCNN:'UNAVAILABLE',officialMetrics:false};const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='kora-hybrid-beta-trace.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return {enabled,setEnabled,entries,id,setId,renderer,setRenderer,melody,setMelody,clip,status,error,chooseFile,exportTrace,audioStatus:transport.diagnostics(),
  controller:{sessions:session?[session]:[],selected:session,setSelectedId:()=>{},connected:true,checking:false,error,busy,toggle,control,openMusicTab:async()=>{},refresh:()=>void refresh(),beat,source:(isNativeWidget()?'tauri-events':'extension-direct') as 'tauri-events'|'extension-direct',playing:Boolean(session?.playing&&!session.paused)}};
}
