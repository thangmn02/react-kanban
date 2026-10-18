import { useId, useState } from 'react';
import { configureExperimentalSynchronization, type BrowserMusicSession } from './mediaBridge';

export default function ExperimentalLivePreviewControl({session,refresh}:{session:BrowserMusicSession;refresh:()=>void}) {
  const [consent,setConsent]=useState({authorizedAudio:false,outputHeard:false,latencyAccepted:false});
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const statusId=useId(),capability=session.syncState?.capability;
  if(!capability?.privateCandidate)return null;
  const policyBlocker=capability.reason==='protected-source'?'Instrument preview is unavailable for this protected source. Playback controls remain available. Choose an authorized, unprotected source.'
    :capability.reason==='provider-policy'?'Instrument preview is unavailable for this provider under the private test policy. Playback controls remain available. Choose another authorized source.':'';
  const active=capability.mode==='experimental-live'&&capability.allowTypedPreview;
  const captureId=session.syncState?.captureId;
  const accepted=consent.authorizedAudio&&consent.outputHeard&&consent.latencyAccepted;
  const available=Boolean(captureId&&capability.livePreviewEligible&&!session.paused&&capability.bufferMs===0);
  const ready=Boolean(!policyBlocker&&captureId&&!capability.bufferMs&&(active||available&&accepted));
  const status=policyBlocker|| (capability.bufferMs?'Disable the intentional audio delay before using live preview.'
    :!captureId?'Play the source and click Companion on that tab to connect capture.'
    :active?'Live preview is on. No intentional audio delay. Flashes may lag or be incorrect.'
    :session.paused?'Keep the source playing to enable live preview.'
    :capability.livePreviewEligible===undefined||capability.livePreviewReason==='unavailable'?'Reload the updated private Companion extension and both tabs to use live preview.'
    :!capability.livePreviewEligible?`Live preview unavailable: ${capability.livePreviewReason}.`
    :!accepted?'Complete the three live preview checks below.':'Ready. Enable live preview while the source keeps playing.');
  async function configure() {
    if(!ready||busy||!captureId)return;
    setBusy(true);setMessage('');
    try {
      await configureExperimentalSynchronization(session.id,{...consent,enabled:!active,preview:!active,
        live:true,intentionalDelay:false,captureId,generation:capability!.generation});
      setMessage(active?'Live preview disabled.':'Live preview enabled. Keep playback running.');refresh();
    }catch{setMessage('Capture or source changed. Refresh, play the source and reconnect Companion before trying again.');}
    finally{setBusy(false);}
  }
  return <section aria-label="Live instrument preview">
    <h2>Live preview · YouTube and supported captured tabs</h2>
    <p>No calibration or intentional audio delay. Instrument flashes are unverified and can lag behind the music. Pause, seek or source changes end this preview; enable it again while playing.</p>
    <p>This preview uses ADTOF for drums and the existing Bass detector. Live CNN Hi-Hat is unavailable. Hybrid H0 uses prepared local recordings.</p>
    {([
      ['authorizedAudio','I have permission to analyze this captured tab audio.'],
      ['outputHeard','I can hear the captured tab normally.'],
      ['latencyAccepted','I accept late or incorrect instrument flashes in this private test.'],
    ] as const).map(([key,label])=><label key={key} style={{display:'block'}}><input type="checkbox" checked={consent[key]} disabled={busy||active||Boolean(policyBlocker)}
      onChange={event=>setConsent(value=>({...value,[key]:event.target.checked}))}/>{label}</label>)}
    <p id={statusId} role="status" aria-label="Live preview activation status">{status}</p>
    <button type="button" disabled={!ready||busy} aria-describedby={statusId} onClick={()=>void configure()}>{active?'Disable live preview':'Enable live preview (no audio delay)'}</button>
    {message&&<p role="status">{message}</p>}
  </section>;
}
