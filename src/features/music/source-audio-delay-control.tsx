import {useState} from 'react';
import type {SourceAudioDelayStatus} from './use-source-audio-delay';
import {useEnhancedBeatSyncPreference} from './use-source-audio-delay';
import type {BrowserMusicController} from './useBrowserMusic';

const STATUS:Record<SourceAudioDelayStatus,string>={off:'Off',preparing:'Preparing',on:'On',unavailable:'Unavailable',error:'Error'};

/** Compact Music-tab status. The setting itself lives in dock settings; this line appears only while it is on or failing. */
export default function SourceAudioDelayControl({music}:{music:BrowserMusicController}){
  const route=music.sourceAudioDelay;
  if(!route||!route.preferred&&!route.error&&route.status==='off')return null;
  return <section className="music-sync-status muted" aria-label="Enhanced Beat Sync">
    <p><span>Enhanced Beat Sync</span> · <span role="status" aria-label="Enhanced Beat Sync status">{STATUS[route.status]}</span></p>
    {route.error?<p role="alert">{route.error}</p>:route.hint&&<p>{route.hint}</p>}
  </section>;
}

/** Dock setting: one approval, remembered until turned off. */
export function EnhancedBeatSyncSetting(){
  const preference=useEnhancedBeatSyncPreference();
  const [confirming,setConfirming]=useState(false);
  if(!preference.available)return null;
  return <fieldset className="dock-sync-setting">
    <legend>Enhanced Beat Sync</legend>
    <label><input type="checkbox" checked={preference.enabled||confirming}
      onChange={event=>{if(event.target.checked)setConfirming(true);else{setConfirming(false);preference.setEnabled(false);}}}/> Line the Beat Grid up with the beat</label>
    {confirming&&!preference.enabled?<div role="group" aria-label="Turn on Enhanced Beat Sync">
      <p className="muted">Supported music will play about 0.17 s later, so drum flashes land on the beat.
        Kora pauses a playing song for a moment to switch it on. You can turn it off at any time.</p>
      <button type="button" onClick={()=>{preference.setEnabled(true);setConfirming(false);}}>Turn on</button>{' '}
      <button type="button" onClick={()=>setConfirming(false)}>Cancel</button>
    </div>:<p className="muted">{preference.enabled?'On for supported music sources.':'Off. Music plays without delay.'}</p>}
  </fieldset>;
}
