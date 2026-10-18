import { useId, useState } from 'react';
import { configureExperimentalSynchronization, type BrowserMusicSession } from './mediaBridge';
import ExperimentalLivePreviewControl from './experimental-live-preview-control';

export default function ExperimentalBeatControl({session,refresh,initiallyOpen=false}:{session:BrowserMusicSession;refresh:()=>void;initiallyOpen?:boolean}) {
  const [consent,setConsent]=useState({intentionalDelay:false,outputHeard:false,authorizedAudio:false,preview:false});
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const activationStatusId=useId();
  const capability=session.syncState?.capability;
  if(!capability?.privateCandidate)return null;
  const policyBlocker=capability.reason==='protected-source'?'Audio analysis and calibrated delay are unavailable for this protected source. Playback controls remain available.'
    :capability.reason==='provider-policy'?'Audio analysis and calibrated delay are unavailable for this provider under the private test policy. Playback controls remain available.':'';
  const enabled=capability.bufferMs>0;
  const available=session.paused&&capability.bufferEligible&&Boolean(session.syncState?.captureId);
  const ready=!policyBlocker&&available&&(enabled||consent.intentionalDelay&&consent.outputHeard&&consent.authorizedAudio);
  const blockers:string[]=[];
  if(policyBlocker)blockers.push(policyBlocker);
  else {
    if(!session.paused)blockers.push('Pause the selected source before changing its audio delay.');
    if(!session.syncState?.captureId)blockers.push('The capture has ended. Resume audio and click Companion on the source tab to reconnect.');
    if(!capability.bufferEligible) {
      const reasons:Record<string,string>={
        'source-or-output-unproven':'Single-source audio output is not confirmed. Use one audio-only source with no video or frames in its tab.',
        'capture-unproven':'Capture is not healthy. Resume audio and reconnect Companion on the source tab.',
        'clock-unreliable':'The source clock is unreliable. Resume audio until the clock is healthy, then pause again.',
        'rate-unsupported':'Set playback speed to 1×, let audio play, then pause again.',
        'calibration-unavailable':'Calibration is incomplete or exceeds the 500 ms limit. Resume audio to collect more timing samples before pausing.',
        'detector-rights-unavailable':'This detector is unavailable for the private experiment.',
      };
      blockers.push(reasons[capability.bufferReason]||`Buffer is unavailable (${capability.bufferReason}).`);
    }
    if(!enabled&&!(consent.intentionalDelay&&consent.outputHeard&&consent.authorizedAudio))
      blockers.push('Complete the three audio permission, audible output and intentional delay consent checks.');
  }
  async function configure() {
    if(!ready||busy||!session.syncState?.captureId)return;
    setBusy(true);setMessage('');
    try {
      await configureExperimentalSynchronization(session.id,{...consent,enabled:!enabled,
        captureId:session.syncState.captureId,generation:capability!.generation});
      setMessage('Configuration applied. Resume playback to listen.');refresh();
    }catch{setMessage('Source or capture changed. Pause and refresh before trying again.');}
    finally{setBusy(false);}
  }
  return <details open={initiallyOpen} className="muted" aria-label="Private Beat Grid candidate">
    <summary>Private candidate · {capability.mode} · {capability.bufferMs ? `Audio intentionally delayed ${capability.bufferMs} ms` : 'Audio delay off'}</summary>
    <ExperimentalLivePreviewControl session={session} refresh={refresh}/>
    <h2>Calibrated delay · audio-only sources</h2>
    <p role="status">{capability.reason} · {capability.detectorId} / {capability.detectorVersion}. Capture {capability.captureHealthy?'healthy':'unproven'}, clock {capability.clockHealthy?'healthy':'unreliable'}. Processing p95/p99 {capability.measuredP95Ms?.toFixed(1)??'unknown'} / {capability.measuredP99Ms?.toFixed(1)??'unknown'} ms ({capability.latencySamples} samples). Physical synchronization unverified.</p>
    {!policyBlocker&&<p>Buffer: {capability.bufferReason}. Withheld/reset instrument predictions: {capability.droppedSemanticEvents}. Only use authorized audio: clicking Companion starts local analysis and calibration. Confirm the captured output is audible, then pause. Delay is available only while paused on that same source. Typed preview uses an unverified detector.</p>}
    {([
      ['authorizedAudio','I have permission to use this audio in the buffered experiment.'],
      ['outputHeard','I heard the captured output with no echo or second playback.'],
      ['intentionalDelay','I accept intentional audio delay for this experiment.'],
      ['preview','Show unverified instrument predictions during buffered playback.'],
    ] as const).map(([key,label])=><label key={key} style={{display:'block'}}><input type="checkbox" checked={consent[key]} disabled={busy||enabled||Boolean(policyBlocker)}
      onChange={event=>setConsent(value=>({...value,[key]:event.target.checked}))}/>{label}</label>)}
    <p id={activationStatusId} role="status" aria-label="Delay activation status">{busy?'Applying audio delay settings.':blockers.length?`Cannot change delay: ${blockers.join(' ')}`:'Ready. You can change the calibrated audio delay now.'}</p>
    <button type="button" disabled={!ready||busy} aria-describedby={activationStatusId} onClick={()=>void configure()}>{enabled?'Disable intentional delay':`Enable calibrated ${capability.requiredBufferMs || 'pending'} ms delay`}</button>
    {message&&<p role="status">{message}</p>}
  </details>;
}
