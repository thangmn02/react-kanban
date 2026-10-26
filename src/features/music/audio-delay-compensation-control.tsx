import {useState} from 'react';
import {configureExperimentalSynchronization,type BrowserMusicSession} from './mediaBridge';

export default function AudioDelayCompensationControl({session,refresh}:{session:BrowserMusicSession;refresh:()=>void}) {
  const mode=session.syncState?.capability;
  const [delay,setDelay]=useState(170),[consentOwner,setConsentOwner]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [detector,setDetector]=useState<'L0'|'H-SHADOW'|'H-LIVE'>('L0');
  const owner=`${session.id}:${session.syncState?.captureId}:${mode?.generation}`;
  const consent=consentOwner===owner;
  if(!mode?.privateCandidate)return null;
  const active=mode.bufferMs>0;
  const available=Boolean(session.syncState?.captureId&&mode.compensationEligible&&session.paused&&consent);
  async function apply(enabled:boolean) {
    const captureId=session.syncState?.captureId;
    if(!captureId||busy||enabled&&!available)return;
    setBusy(true);setError('');
    try {
      await configureExperimentalSynchronization(session.id,{enabled,captureId,generation:mode!.generation,
        compensationMs:enabled?delay:0,intentionalDelay:consent,authorizedAudio:consent,outputHeard:consent,preview:enabled,
        ...(mode!.hybridLiveAvailable?{detectorVariant:enabled?detector:'L0'}:{})});
      refresh();
    } catch {setError('Source, capture or clock changed. Delay was not applied. Reconnect and pause before retrying.');}
    finally {setBusy(false);}
  }
  return <section aria-label="Audio Delay Compensation — Experimental">
    <h2>Audio Delay Compensation — Experimental</h2>
    <p role="status">{active?`Active audio delay: ${mode.bufferMs} ms`:'OFF — 0 ms'}. Physical audio/visual synchronization unverified.</p>
    {mode.hybridLiveAvailable&&<>
      <label>Compensated detector <select aria-label="Compensated detector" value={active?mode.hybridMode||'L0':detector} disabled={busy||active}
        onChange={event=>setDetector(event.target.value as 'L0'|'H-SHADOW'|'H-LIVE')}>
        <option value="L0">L0 · ADTOF baseline</option><option value="H-SHADOW">H-SHADOW · Log CNN Hat; display L0</option>
        <option value="H-LIVE">H-LIVE · ADTOF Kick/Snare + CNN Hat</option>
      </select></label>
      <p>Hybrid uses experimental running normalization, not exact offline H0. Turn compensation OFF to change detector. CNN failure withholds Hybrid Hats; no automatic ADTOF Hat fallback.</p>
      {mode.hybridFailure&&<p role="alert">Hybrid detector issue: {mode.hybridFailure}. Roll back to L0 or reconnect.</p>}
    </>}
    <p>Pause to enable or change delay. You can turn it OFF immediately. Seeking, replacing the source or changing output device resets compensation to OFF. Pause clears buffered audio; resume refills the delay. Analysis remains undelayed.</p>
    <p>For tab-owned audio only. Video sound will lag its picture by the selected delay. The 170 ms preset is uncalibrated. Cached Companion events are withheld while compensation is active until that path is verified.</p>
    <label>Delay preset <select aria-label="Audio compensation delay" value={delay} disabled={busy||active} onChange={event=>setDelay(Number(event.target.value))}>
      {[100,120,150,170,200,250].map(value=><option key={value} value={value}>{value} ms</option>)}
    </select></label>
    <label style={{display:'block'}}><input type="checkbox" checked={consent} disabled={busy||active} onChange={event=>setConsentOwner(event.target.checked?owner:'')}/>
      I am authorized to analyze this audio, heard one captured output with no echo, and accept intentional delay and unverified instrument predictions.</label>
    {!active&&!available&&<p>Use one supported captured tab, confirm output ownership, then pause and accept the experiment.</p>}
    <button type="button" disabled={busy||!session.syncState?.captureId||!active&&!available} onClick={()=>void apply(!active)}>
      {active?'Turn audio compensation OFF':`Enable ${delay} ms compensation`}
    </button>
    {error&&<p role="alert">{error}</p>}
  </section>;
}
