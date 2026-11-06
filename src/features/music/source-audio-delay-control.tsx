import {useState} from 'react';
import {useI18n} from '../../i18n';
import type {SourceAudioDelayStatus} from './use-source-audio-delay';
import {useEnhancedBeatSyncPreference} from './use-source-audio-delay';
import type {BrowserMusicController} from './useBrowserMusic';

type Translate=ReturnType<typeof useI18n>['t'];
// The routing hook stays untouched; its known English messages are translated here for display only.
const MESSAGES:Record<string,string>={
  'Click the Kora Music Companion icon on the music tab once so it can take over the sound.':'music.sync.hint.click',
  'Not available for this source right now. Music plays normally.':'music.sync.hint.unavailable',
  'The delay could not start on this song. It will try again on the next one.':'music.sync.error.start',
  'Turning off is not confirmed. Close the music tab to restore normal sound, or try again.':'music.sync.error.off',
  'Enhanced Beat Sync could not start.':'music.sync.error.generic',
};
const translated=(t:Translate,message:string)=>MESSAGES[message]?t(MESSAGES[message] as Parameters<Translate>[0]):message;
const STATUS:Record<SourceAudioDelayStatus,Parameters<Translate>[0]>={off:'music.sync.status.off',preparing:'music.sync.status.preparing',
  on:'music.sync.status.on',unavailable:'music.sync.status.unavailable',error:'music.sync.status.error'};

function Confirm({t,onConfirm,onCancel}:{t:Translate;onConfirm:()=>void;onCancel:()=>void}){
  return <div role="group" aria-label={`${t('music.sync.turnOn')}: ${t('music.sync.title')}`}>
    <p className="muted">{t('music.sync.confirm')}</p>
    <p className="muted">{t('music.sync.video')}</p>
    <button type="button" onClick={onConfirm}>{t('music.sync.turnOn')}</button>{' '}
    <button type="button" onClick={onCancel}>{t('music.sync.cancel')}</button>
  </div>;
}

/** Compact Music-tab row: one tap to turn on (after the same confirmation as dock settings), then status and a turn-off button. */
export default function SourceAudioDelayControl({music}:{music:BrowserMusicController}){
  const {t}=useI18n();
  const [confirming,setConfirming]=useState(false);
  const route=music.sourceAudioDelay;
  if(!route)return null;
  const off=!route.preferred&&!route.error&&route.status==='off';
  return <section className="music-sync-status muted" aria-label={t('music.sync.title')}>
    <p><span>{t('music.sync.title')}</span> · <span role="status" aria-label={t('music.sync.status', { title: t('music.sync.title') })}>{t(STATUS[route.status])}</span>{' '}
      {off?!confirming&&<button type="button" className="text-button" onClick={()=>setConfirming(true)}>{t('music.sync.turnOn')}</button>
        :route.preferred&&<button type="button" className="text-button" onClick={()=>route.setPreferred(false)}>{t('music.sync.turnOff')}</button>}</p>
    {off&&confirming&&<Confirm t={t} onConfirm={()=>{route.setPreferred(true);setConfirming(false);}} onCancel={()=>setConfirming(false)}/>}
    {route.error?<p role="alert">{translated(t,route.error)}</p>:route.hint&&<p>{translated(t,route.hint)}</p>}
  </section>;
}

/** Dock setting: one approval, remembered until turned off. */
export function EnhancedBeatSyncSetting(){
  const {t}=useI18n();
  const preference=useEnhancedBeatSyncPreference();
  const [confirming,setConfirming]=useState(false);
  if(!preference.available)return null;
  return <fieldset className="dock-sync-setting">
    <legend>{t('music.sync.title')}</legend>
    <label><input type="checkbox" checked={preference.enabled||confirming}
      onChange={event=>{if(event.target.checked)setConfirming(true);else{setConfirming(false);preference.setEnabled(false);}}}/> {t('music.sync.toggle')}</label>
    {confirming&&!preference.enabled?<Confirm t={t} onConfirm={()=>{preference.setEnabled(true);setConfirming(false);}} onCancel={()=>setConfirming(false)}/>
      :<p className="muted">{t(preference.enabled?'music.sync.onNote':'music.sync.offNote')}</p>}
  </fieldset>;
}
