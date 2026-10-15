import { useState } from 'react';
import { configureExperimentalSynchronization, type BrowserMusicSession } from './mediaBridge';

export default function ExperimentalBeatControl({session,refresh}:{session:BrowserMusicSession;refresh:()=>void}) {
  const [consent,setConsent]=useState({intentionalDelay:false,outputHeard:false,authorizedAudio:false,preview:false});
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const capability=session.syncState?.capability;
  if(!capability?.privateCandidate)return null;
  const enabled=capability.bufferMs>0;
  const available=session.paused&&capability.bufferEligible&&Boolean(session.syncState?.captureId);
  const ready=available&&(enabled||consent.intentionalDelay&&consent.outputHeard&&consent.authorizedAudio);
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
  return <details className="muted" aria-label="Private Beat Grid candidate">
    <summary>Private candidate · {capability.mode} · {capability.bufferMs ? `Audio intentionally delayed ${capability.bufferMs} ms` : 'Audio delay off'}</summary>
    <p role="status">{capability.reason} · {capability.detectorId} / {capability.detectorVersion}. Capture {capability.captureHealthy?'healthy':'unproven'}, clock {capability.clockHealthy?'healthy':'unreliable'}. Processing p95/p99 {capability.measuredP95Ms?.toFixed(1)??'unknown'} / {capability.measuredP99Ms?.toFixed(1)??'unknown'} ms ({capability.latencySamples} samples). Physical synchronization unverified.</p>
    <p>Buffer: {capability.bufferReason}. Withheld/reset instrument predictions: {capability.droppedSemanticEvents}. Only use authorized audio: clicking Companion starts local analysis and calibration. Confirm the captured output is audible, then pause. Delay is available only while paused on that same source. Typed preview uses an unverified detector.</p>
    {([
      ['authorizedAudio','I have permission to use this audio in the buffered experiment.'],
      ['outputHeard','I heard the captured output with no echo or second playback.'],
      ['intentionalDelay','I accept intentional audio delay for this experiment.'],
      ['preview','Show unverified instrument predictions during buffered playback.'],
    ] as const).map(([key,label])=><label key={key} style={{display:'block'}}><input type="checkbox" checked={consent[key]} disabled={busy||enabled}
      onChange={event=>setConsent(value=>({...value,[key]:event.target.checked}))}/>{label}</label>)}
    <button type="button" disabled={!ready||busy} onClick={()=>void configure()}>{enabled?'Disable intentional delay':`Enable calibrated ${capability.requiredBufferMs || 'pending'} ms delay`}</button>
    {message&&<p role="status">{message}</p>}
  </details>;
}
