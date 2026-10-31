import {useEffect,useRef,useState} from 'react';
import {configureExperimentalSynchronization,sendMusicRequest,type BrowserMusicSession} from './mediaBridge';
import {nativeSourceAudioDelayEnabled} from '../native/runtime';
import {prepareNativeSourceAudioDelay,sourceKey,stopNativeSourceAudioDelay} from '../native/nativeMusic';

// Owner-accepted preset from the private prototype; physical A/V timing is uncalibrated.
export const SOURCE_AUDIO_DELAY_MS=170;
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

const settle=(test:()=>boolean,timeoutMs:number)=>new Promise<boolean>(resolve=>{
  const started=Date.now(),check=()=>{if(test())resolve(true);else if(Date.now()-started>=timeoutMs)resolve(false);else setTimeout(check,50);};check();
});

export function useSourceAudioDelay(selected:BrowserMusicSession|undefined,refresh:()=>void){
  const preference=useEnhancedBeatSyncPreference(),available=preference.available;
  // The route belongs to the music tab, not to a song: track changes and seeks keep it.
  const owner=selected?sourceKey(selected.id):'';
  const latest=useRef({owner,session:selected});latest.current={owner,session:selected};
  const [route,setRoute]=useState<{owner:string;sessionId?:string;enabled:boolean}>({owner:'',enabled:false});
  const [pending,setPending]=useState<Pending>(),[failure,setFailure]=useState({owner:'',capture:'',message:''});
  // Every request takes a token; a completion whose token was superseded never touches route state.
  const token=useRef(0);
  const supported=sourceDelaySupported(selected);
  const routed=available&&route.enabled&&Boolean(owner)&&route.owner===owner;
  const mode=selected?.syncState?.capability,captureId=selected?.syncState?.captureId;
  const error=failure.owner===owner&&(!failure.capture||failure.capture===captureId)?failure.message:'';

  async function start(session:BrowserMusicSession){
    const mine=++token.current,key=sourceKey(session.id);
    setPending('on');setFailure({owner:'',capture:'',message:''});
    try{
      await prepareNativeSourceAudioDelay(session.id);
      // OFF or a source change arrived meanwhile: retire the intent this request just created.
      if(token.current!==mine||latest.current.owner!==key){await stopNativeSourceAudioDelay(session.id).catch(()=>{});return;}
      setRoute({owner:key,sessionId:session.id,enabled:true});
    }catch(reason){if(token.current===mine)setFailure({owner:key,capture:'',message:reason instanceof Error?reason.message:'Enhanced Beat Sync could not start.'});}
    finally{if(token.current===mine)setPending(undefined);}
  }
  async function stop(){
    const mine=++token.current,{owner:previous,sessionId}=route;
    setPending('off');
    try{
      if(sessionId)await stopNativeSourceAudioDelay(sessionId);
      if(token.current===mine)setRoute({owner:'',enabled:false});
    }catch{if(token.current===mine)setFailure({owner:previous,capture:'',message:'Turning off is not confirmed. Close the music tab to restore normal sound, or try again.'});}
    finally{if(token.current===mine)setPending(undefined);}
  }

  // Reconcile the route with the standing preference and the selected music tab.
  useEffect(()=>{
    if(!available||pending)return;
    const wanted=preference.enabled&&supported&&Boolean(owner);
    if(route.enabled&&(!wanted||route.owner!==owner)){if(!(failure.owner===route.owner&&failure.message))void stop();return;}
    if(!route.enabled&&wanted&&!error&&selected)void start(selected);
  });
  // A new approval (or turning it off) clears an earlier failure so the next attempt is clean.
  useEffect(()=>{setFailure({owner:'',capture:'',message:''});},[preference.enabled]);

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
          await sendMusicRequest('media.pause',sessionId);
          // The Companion accepts the delay only after its own clock has seen the pause.
          if(!await settle(()=>current()?.paused===true,2000))throw Error('pause');
        }
        for(let attempt=0;attempt<3&&!applied&&token.current===mine;attempt++){
          const session=current(),facts=session?.syncState?.capability,id=session?.syncState?.captureId;
          if(!session||!facts||!id||id!==capture)break;
          applied=await configureExperimentalSynchronization(sessionId,{enabled:true,captureId:id,generation:facts.generation,
            compensationMs:SOURCE_AUDIO_DELAY_MS,intentionalDelay:true,authorizedAudio:true,outputHeard:true,preview:true}).then(()=>true,()=>false);
          if(!applied)await new Promise(done=>setTimeout(done,200));
        }
        if(!applied&&token.current===mine)setFailure({owner,capture,message:'The delay could not start on this song. It will try again on the next one.'});
      }catch{if(token.current===mine)setFailure({owner,capture,message:'The delay could not start on this song. It will try again on the next one.'});}
      finally{
        // Resume a song this paused, even if the pause has not been reported back yet.
        if(wasPlaying)await sendMusicRequest('media.play',sessionId).catch(()=>{});
        refresh();
      }
    })();
  });

  const status=sourceDelayStatus({preferred:preference.enabled,routed,pending,error,supported,session:selected});
  const hint=status==='preparing'&&routed&&selected&&!captureId?'Click the Kora Music Companion icon on the music tab once so it can take over the sound.'
    :status==='unavailable'?'Not available for this source, or while its video is visible. Music plays normally.':undefined;
  return {available,routed,controller:available?{owner,enabled:route.enabled,preferred:preference.enabled,supported,busy:Boolean(pending),error,hint,
    delayMs:SOURCE_AUDIO_DELAY_MS,status,setPreferred:preference.setEnabled}:undefined};
}
