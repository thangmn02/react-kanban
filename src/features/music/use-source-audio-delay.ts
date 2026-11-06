import {useEffect,useRef,useState} from 'react';
import {configureExperimentalSynchronization,sendMusicRequest,type BrowserMusicSession} from './mediaBridge';
import {nativeSourceAudioDelayEnabled} from '../native/runtime';
import {prepareNativeSourceAudioDelay,sourceKey,stopNativeSourceAudioDelay} from '../native/nativeMusic';
import { translateNow } from '../../i18n/context';

// Owner-accepted preset from the private prototype; physical A/V timing is uncalibrated.
export const SOURCE_AUDIO_DELAY_MS=170;
// How long Preparing may last on a running capture before Kora restarts the song once on its own.
export const SOURCE_DELAY_STUCK_MS=8000;
const DELAY_HOSTS=['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','soundcloud.com','www.soundcloud.com','m.soundcloud.com',
  // Signed-out previews are plain audio; signed-in DRM tracks are refused by the Companion's protected-media check.
  'music.apple.com',
  // Owner-preview builds only: the loopback test player for authorized local files.
  ...(import.meta.env.VITE_OWNER_PREVIEW_LOOPBACK==='true'?['127.0.0.1']:[])];
export type SourceAudioDelayStatus='off'|'preparing'|'on'|'unavailable'|'error';
type Pending='on'|'off'|undefined;

/** The one-time approval. It covers eligible audio sources at exactly the approved delay; a different delay needs a new approval. */
export interface EnhancedBeatSyncPreference{enabled:true;approvedDelayMs:number;scope:'eligible-audio-sources';approvedAt:string}
export const ENHANCED_BEAT_SYNC_KEY='kora.music.enhancedBeatSync.v1';
const PREFERENCE_EVENT='kora:enhanced-beat-sync';
export function readEnhancedBeatSyncPreference():EnhancedBeatSyncPreference|undefined{
  try{
    const value=JSON.parse(localStorage.getItem(ENHANCED_BEAT_SYNC_KEY)||'null');
    return value?.enabled===true&&value.approvedDelayMs===SOURCE_AUDIO_DELAY_MS&&value.scope==='eligible-audio-sources'
      &&typeof value.approvedAt==='string'?value:undefined;
  }catch{return undefined;}
}
export function writeEnhancedBeatSyncPreference(enabled:boolean){
  try{
    if(enabled)localStorage.setItem(ENHANCED_BEAT_SYNC_KEY,JSON.stringify({enabled:true,approvedDelayMs:SOURCE_AUDIO_DELAY_MS,
      scope:'eligible-audio-sources',approvedAt:new Date().toISOString()} satisfies EnhancedBeatSyncPreference));
    else localStorage.removeItem(ENHANCED_BEAT_SYNC_KEY);
  }catch{/* Without storage the setting lasts for this window only. */}
  window.dispatchEvent(new Event(PREFERENCE_EVENT));
}
export function useEnhancedBeatSyncPreference(){
  const [preference,setPreference]=useState(readEnhancedBeatSyncPreference);
  useEffect(()=>{
    const update=()=>setPreference(readEnhancedBeatSyncPreference());
    window.addEventListener('storage',update);window.addEventListener(PREFERENCE_EVENT,update);
    return()=>{window.removeEventListener('storage',update);window.removeEventListener(PREFERENCE_EVENT,update);};
  },[]);
  return {available:nativeSourceAudioDelayEnabled(),enabled:Boolean(preference),delayMs:SOURCE_AUDIO_DELAY_MS,setEnabled:writeEnhancedBeatSyncPreference};
}

// A UI hint only; the Companion re-checks protection, output ownership and video visibility on every clock sample.
export const sourceDelaySupported=(session?:BrowserMusicSession)=>Boolean(session&&session.canAnalyze!==false
  &&DELAY_HOSTS.includes(session.source)&&session.asset?.provider!=='spotify'&&session.syncState?.capability?.support!=='policy-blocked');

// On only once the Companion confirms buffering on the output it owns.
export function sourceDelayStatus({preferred,routed,pending,error,supported,session}:{preferred:boolean;routed:boolean;pending:Pending;error:string;supported:boolean;session?:BrowserMusicSession}):SourceAudioDelayStatus{
  if(error)return 'error';
  const mode=session?.syncState?.capability;
  if(!preferred)return pending||routed?'preparing':'off';
  if(session&&!supported||mode&&mode.compensationEligible===false&&session?.syncState?.captureId)return 'unavailable';
  return routed&&mode&&mode.bufferMs>0&&mode.outputOwned?'on':'preparing';
}

export function useSourceAudioDelay(selected:BrowserMusicSession|undefined,refresh:()=>void){
  const preference=useEnhancedBeatSyncPreference(),available=preference.available;
  // The route belongs to the music tab, not to a song: track changes and seeks keep it.
  const owner=selected?sourceKey(selected.id):'';
  const latest=useRef({owner,session:selected});latest.current={owner,session:selected};
  const [route,setRoute]=useState<{owner:string;sessionId?:string;enabled:boolean}>({owner:'',enabled:false});
  const [pending,setPending]=useState<Pending>(),[failure,setFailure]=useState({owner:'',capture:'',message:'',retryAt:0});
  // Every request takes a token; a completion whose token was superseded never touches route state.
  const token=useRef(0);
  const supported=sourceDelaySupported(selected);
  const routed=available&&route.enabled&&Boolean(owner)&&route.owner===owner;
  const mode=selected?.syncState?.capability,captureId=selected?.syncState?.captureId;
  const error=failure.owner===owner&&(!failure.capture||failure.capture===captureId)?failure.message:'';
  // A failed start retries on its own after a short wait; a busy Companion during capture restart is transient.
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{if(!failure.retryAt)return;const wait=setTimeout(()=>setNow(Date.now()),Math.max(0,failure.retryAt-Date.now()));return()=>clearTimeout(wait);},[failure.retryAt]);
  const retryDue=Boolean(failure.retryAt)&&now>=failure.retryAt;

  async function start(session:BrowserMusicSession){
    const mine=++token.current,key=sourceKey(session.id);
    setPending('on');setFailure({owner:'',capture:'',message:'',retryAt:0});
    try{
      await prepareNativeSourceAudioDelay(session.id);
      // OFF or a source change arrived meanwhile: retire the intent this request just created.
      if(token.current!==mine||latest.current.owner!==key){await stopNativeSourceAudioDelay(session.id).catch(()=>{});return;}
      setRoute({owner:key,sessionId:session.id,enabled:true});
    }catch(reason){if(token.current===mine)setFailure({owner:key,capture:'',message:reason instanceof Error?reason.message:'Enhanced Beat Sync could not start.',retryAt:Date.now()+5000});}
    finally{if(token.current===mine)setPending(undefined);}
  }
  async function stop(){
    const mine=++token.current,{owner:previous,sessionId}=route;
    setPending('off');
    try{
      if(sessionId)await stopNativeSourceAudioDelay(sessionId);
      if(token.current===mine)setRoute({owner:'',enabled:false});
    }catch{if(token.current===mine)setFailure({owner:previous,capture:'',message:translateNow('music.sync.error.off'),retryAt:Date.now()+5000});}
    finally{if(token.current===mine)setPending(undefined);}
  }

  // Reconcile the route with the standing preference and the selected music tab.
  useEffect(()=>{
    if(!available||pending)return;
    // Only turning the setting off or selecting a different tab ends the route. A seek, a refresh that briefly
    // drops the selection or a momentarily ineligible source keeps it; the Companion itself withholds the delay.
    const otherTab=Boolean(owner)&&route.owner!==owner;
    if(route.enabled&&(!preference.enabled||otherTab)){if(!(failure.owner===route.owner&&failure.message&&!retryDue))void stop();return;}
    if(!route.enabled&&preference.enabled&&supported&&owner&&selected&&(!error||retryDue))void start(selected);
  });
  // A new approval (or turning it off) clears an earlier failure so the next attempt is clean.
  useEffect(()=>{setFailure({owner:'',capture:'',message:'',retryAt:0});},[preference.enabled]);

  // Apply the approved delay once per capture. Applying needs a paused source, so a playing song pauses briefly first.
  const applied=useRef('');
  useEffect(()=>{
    if(!routed||pending||error||!selected||!captureId||!mode?.compensationEligible||!mode.outputOwned||mode.bufferMs>0)return;
    const key=JSON.stringify([owner,captureId,mode.generation]);if(applied.current===key)return;
    applied.current=key;
    const mine=token.current,sessionId=selected.id,capture=captureId,wasPlaying=!selected.paused;
    const current=()=>latest.current.session?.id===sessionId?latest.current.session:undefined;
    void (async()=>{
      let applied=false;
      try{
        if(wasPlaying){
          // The pause reply is the source's own state; Kora's polled copy can lag by seconds.
          const after=await sendMusicRequest('media.pause',sessionId);
          if(after.find(item=>item.id===sessionId)?.paused!==true)throw Error('pause');
        }
        // The Companion accepts the delay once its clock has seen the pause (about one 100 ms sample), so retry briefly.
        const generation=current()?.syncState?.capability?.generation??mode.generation;
        for(let attempt=0;attempt<8&&!applied&&token.current===mine;attempt++){
          if(current()?.syncState?.captureId&&current()!.syncState!.captureId!==capture)break;
          applied=await configureExperimentalSynchronization(sessionId,{enabled:true,captureId:capture,generation,
            compensationMs:SOURCE_AUDIO_DELAY_MS,intentionalDelay:true,authorizedAudio:true,outputHeard:true,preview:true}).then(()=>true,()=>false);
          if(!applied)await new Promise(done=>setTimeout(done,100));
        }
        if(!applied&&token.current===mine)setFailure({owner,capture,message:translateNow('music.sync.error.start'),retryAt:0});
      }catch{if(token.current===mine)setFailure({owner,capture,message:translateNow('music.sync.error.start'),retryAt:0});}
      finally{
        // Resume a song this paused, even if the pause has not been reported back yet.
        if(wasPlaying)await sendMusicRequest('media.play',sessionId).catch(()=>{});
        refresh();
      }
    })();
  });

  const status=sourceDelayStatus({preferred:preference.enabled,routed,pending,error,supported,session:selected});
  // Still Preparing on a running capture well after the switch (the delay never took): do once, per capture, what
  // pausing and playing by hand does. A fresh play makes the Companion re-check the capture and the delay re-apply.
  const stuck=status==='preparing'&&routed&&!pending&&Boolean(captureId)&&Boolean(selected&&!selected.paused);
  const stuckKey=stuck?JSON.stringify([owner,captureId]):'';
  const nudged=useRef('');const stuckNow=useRef('');stuckNow.current=stuckKey;
  useEffect(()=>{
    if(!stuckKey||nudged.current===stuckKey||!selected)return;
    const sessionId=selected.id;
    const wait=setTimeout(()=>{
      if(stuckNow.current!==stuckKey)return;
      nudged.current=stuckKey;applied.current='';
      void sendMusicRequest('media.pause',sessionId).then(()=>sendMusicRequest('media.play',sessionId)).catch(()=>{}).finally(refresh);
    },SOURCE_DELAY_STUCK_MS);
    return()=>clearTimeout(wait);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Keyed on the stuck capture; the session object changes every poll.
  },[stuckKey]);
  const hint=status==='preparing'&&routed&&selected&&!captureId?'Click the Kora Music Companion icon on the music tab once so it can take over the sound.'
    :status==='unavailable'?'Not available for this source right now. Music plays normally.':undefined;
  return {available,routed,controller:available?{owner,enabled:route.enabled,preferred:preference.enabled,supported,busy:Boolean(pending),error,hint,
    delayMs:SOURCE_AUDIO_DELAY_MS,status,setPreferred:preference.setEnabled}:undefined};
}
