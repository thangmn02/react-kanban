import {useEffect,useRef,useState} from 'react';
import {configureExperimentalSynchronization,type BrowserMusicSession} from './mediaBridge';
import {nativeSourceAudioDelayEnabled} from '../native/runtime';
import {prepareNativeSourceAudioDelay,sourceKey,stopNativeSourceAudioDelay} from '../native/nativeMusic';

// Owner-accepted preset from the private prototype; physical A/V timing is uncalibrated.
export const SOURCE_AUDIO_DELAY_MS=170;
const DELAY_HOSTS=['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','soundcloud.com','www.soundcloud.com','m.soundcloud.com',
  // Signed-out previews are plain audio; signed-in DRM tracks are refused by the Companion's protected-media check.
  'music.apple.com',
  // Owner-preview builds only: the loopback test player for authorized local files.
  ...(import.meta.env.VITE_OWNER_PREVIEW_LOOPBACK==='true'?['127.0.0.1']:[])];
export type SourceAudioDelayStatus='off'|'preparing'|'active'|'turning-off'|'error';
type Pending='on'|'off'|undefined;

// A UI hint only; the Companion re-checks protection, output ownership and video visibility on every clock sample.
export const sourceDelaySupported=(session?:BrowserMusicSession)=>Boolean(session&&session.canAnalyze!==false
  &&DELAY_HOSTS.includes(session.source)&&session.asset?.provider!=='spotify'&&session.syncState?.capability?.support!=='policy-blocked');

// Active only once the Companion confirms buffering on the output it owns.
export function sourceDelayStatus({enabled,pending,transitioning,error,session}:{enabled:boolean;pending:Pending;transitioning:boolean;error:string;session?:BrowserMusicSession}):SourceAudioDelayStatus{
  if(pending==='off'||transitioning)return 'turning-off';
  if(error)return 'error';
  if(pending==='on')return 'preparing';
  if(!enabled)return 'off';
  const mode=session?.syncState?.capability;
  return mode&&mode.bufferMs>0&&mode.outputOwned?'active':'preparing';
}

export function useSourceAudioDelay(selected:BrowserMusicSession|undefined,refresh:()=>void){
  const available=nativeSourceAudioDelayEnabled();
  // Bound to the browser document and song, not a media element or seek generation; the Companion revokes the delay on seeks itself.
  const fence=JSON.stringify([selected&&sourceKey(selected.id),selected?.asset?.provider,selected?.asset?.id]);
  const latest=useRef({fence,session:selected});latest.current={fence,session:selected};
  const [route,setRoute]=useState({owner:fence,sessionId:selected?.id,enabled:false});
  if(!route.enabled&&route.owner!==fence)setRoute({owner:fence,sessionId:selected?.id,enabled:false});
  const [pending,setPending]=useState<Pending>(),[error,setError]=useState('');
  // Every request takes a token; a completion whose token was superseded never touches route state.
  const token=useRef(0);
  const supported=sourceDelaySupported(selected);
  const transitioning=route.enabled&&route.owner!==fence;
  const routed=available&&route.enabled&&route.owner===fence;

  async function setEnabled(enabled:boolean){
    if(!available)return;
    if(enabled){
      if(pending||route.enabled||!selected||!supported||!selected.paused)return;
      const mine=++token.current,owner=fence,sessionId=selected.id;
      setPending('on');setError('');
      try{
        await prepareNativeSourceAudioDelay(sessionId);
        // OFF or a source change arrived meanwhile: retire the intent this request just created.
        if(token.current!==mine||latest.current.fence!==owner){
          await stopNativeSourceAudioDelay(sessionId).catch(()=>{});
          if(token.current===mine)setError('The song changed while turning on. Pause and try again.');
          return;
        }
        setRoute({owner,sessionId,enabled:true});
      }catch(reason){if(token.current===mine)setError(reason instanceof Error?reason.message:'Enhanced Beat Sync could not start.');}
      finally{if(token.current===mine)setPending(undefined);}
      return;
    }
    // OFF needs no consent and supersedes an ON still in flight.
    if(!route.enabled&&!pending&&!error)return;
    const mine=++token.current,sessionId=route.sessionId??selected?.id;
    setPending('off');setError('');
    try{
      if(sessionId)await stopNativeSourceAudioDelay(sessionId);
      if(token.current===mine)setRoute({owner:latest.current.fence,sessionId:latest.current.session?.id,enabled:false});
    }catch{if(token.current===mine)setError('Turning off is not confirmed. Retry, or close the music tab to restore normal sound.');}
    finally{if(token.current===mine)setPending(undefined);}
  }

  // Leaving the consented source turns the route OFF once per transition.
  const previousStop=useRef('');
  useEffect(()=>{
    if(!transitioning||pending)return;
    const transition=JSON.stringify([route.owner,fence]);if(previousStop.current===transition)return;
    previousStop.current=transition;void setEnabled(false);
  });

  // The consent given at ON covers this source; apply the delay once per capture while paused and owned.
  const mode=selected?.syncState?.capability,captureId=selected?.syncState?.captureId;
  const applied=useRef('');
  useEffect(()=>{
    if(!routed||pending||error||!selected?.paused||!captureId||!mode?.compensationEligible||!mode.outputOwned||mode.bufferMs>0)return;
    const key=JSON.stringify([fence,captureId,mode.generation]);if(applied.current===key)return;
    applied.current=key;const mine=token.current;
    configureExperimentalSynchronization(selected.id,{enabled:true,captureId,generation:mode.generation,compensationMs:SOURCE_AUDIO_DELAY_MS,
      intentionalDelay:true,authorizedAudio:true,outputHeard:true,preview:true})
      .then(refresh,()=>{if(token.current===mine)setError('The delay could not be applied. Turn Enhanced Beat Sync off and try again.');});
  });

  return {available,routed,controller:available?{owner:fence,enabled:route.enabled,transitioning,supported,busy:Boolean(pending),error,
    delayMs:SOURCE_AUDIO_DELAY_MS,status:sourceDelayStatus({enabled:route.enabled,pending,transitioning,error,session:selected}),setEnabled}:undefined};
}
