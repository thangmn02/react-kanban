import {useState} from 'react';
import Button from '../../components/atoms/Button';
import type {SourceAudioDelayStatus} from './use-source-audio-delay';
import type {BrowserMusicController} from './useBrowserMusic';

const STATUS:Record<SourceAudioDelayStatus,string>={off:'Off',preparing:'Preparing',active:'Active','turning-off':'Turning off',error:'Error'};

export default function SourceAudioDelayControl({music}:{music:BrowserMusicController}){
  const [consentOwner,setConsentOwner]=useState('');
  const route=music.sourceAudioDelay,session=music.selected;
  if(!route||!session&&!route.enabled)return null;
  const consent=consentOwner===route.owner;
  // OFF stays reachable while preparing, active, failing or still turning off.
  const on=route.enabled||route.status==='preparing'||route.status==='turning-off';
  const mode=session?.syncState?.capability;
  const hint=route.status==='preparing'&&route.enabled
    ?!session?.syncState?.captureId?'Play the song, then click the Kora Music Companion icon in the browser toolbar on that tab so it can take over the sound.'
      :mode&&!mode.compensationEligible?'Not eligible yet: a visible video keeps its normal timing. Switch the browser to another tab, or use audio-only music.'
      :session.paused?'Applying the delay…':'Pause to apply the delay.'
    :route.status==='active'?`Sound plays ${route.delayMs} ms later. Turning off may skip a moment of audio.`:undefined;
  return <section className="muted" aria-label="Enhanced Beat Sync">
    <h2>Enhanced Beat Sync</h2>
    <p>Audio may play slightly later to match Beat Grid.</p>
    <p role="status" aria-label="Enhanced Beat Sync status">{STATUS[route.status]}{route.transitioning?' — restoring the previous song’s sound.':''}</p>
    {hint&&<p>{hint}</p>}
    {!on&&<>
      {!route.supported&&<p>Not available for this source. Playback controls still work.</p>}
      {route.supported&&<label><input type="checkbox" checked={consent} onChange={event=>setConsentOwner(event.target.checked?route.owner:'')}/>
        I may analyze this song, and accept that its sound plays about {route.delayMs} ms later.</label>}
      {route.supported&&!session?.paused&&<p>Pause the song to turn this on.</p>}
      <Button text="Turn on Enhanced Beat Sync" variant="outline"
        disabled={!route.supported||!session?.paused||!consent} onClick={()=>void route.setEnabled(true)}/>
    </>}
    {on&&<Button text={route.status==='turning-off'?'Turning off…':'Turn off'} variant="outline"
      disabled={route.status==='turning-off'} onClick={()=>void route.setEnabled(false)}/>}
    {route.error&&<p role="alert">{route.error}</p>}
  </section>;
}
