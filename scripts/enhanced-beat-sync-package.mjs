import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const enhancedBeatSyncVersion='0.3.31';

/** Public Enhanced Beat Sync, layered on the source-audio-delay transform (run that first).
 *  Kora's approval stands for its subscription. When a seek, track change or recovery restarts capture, the
 *  Companion re-applies the approved delay right at that boundary, using the two steps its audio engine accepts:
 *  hold the new output paused with the delay set, then resume into the delayed output. One attempt per capture;
 *  a refusal falls back to normal output (never a capture restart, which looped) and Kora re-applies it later.
 *  Visible video keeps the delay (Kora tells the owner the sound runs behind the picture).
 *  Turning it off, ending the subscription or losing eligibility still restores normal output. */
export function prepareEnhancedBeatSync(files){
  const get=name=>{const matches=files.filter(file=>file.name===name);assert.equal(matches.length,1,name);return matches[0];};
  assert.ok(files.some(file=>file.name==='source-audio-delay-contract.js'),'Apply the source-audio-delay transform first.');
  const proof=[];
  function edit(name,fn){const file=get(name);let source=file.bytes.toString().replaceAll('\r\n','\n');
    const replace=(before,after)=>{assert.equal(source.split(before).length-1,1,'Enhanced Beat Sync boundary changed: '+name);source=source.split(before).join(after);};
    fn(replace);file.bytes=Buffer.from(source);proof.push({name,outputSha256:hash(file.bytes)});
  }
  edit('beat-sync.js',replace=>{
    // An explicit ON/OFF from Kora sets or clears the standing approval; it is never inferred.
    replace('        current.experiment=experiment;current.delaySeconds=next.bufferMs/1000;\n',
      '        current.experiment=experiment;current.delaySeconds=next.bufferMs/1000;\n'
      +'        current.standingDelay=configuration.enabled&&Number.isInteger(configuration.compensationMs)&&configuration.compensationMs>0?{compensationMs:configuration.compensationMs}:undefined;\n');
    replace('    current.fallbackReason = undefined;\n    publishState(current);\n  }\n',
      '    current.fallbackReason = undefined;\n    publishState(current);\n    current.captureConfirmedAt=Date.now();void restoreStandingDelay(current);\n  }\n\n'
      +`  async function restoreStandingDelay(current) {
    const standing=current.standingDelay,clock=current.clock,captureId=current.captureId;
    // Only right after a capture (re)starts, i.e. at the seek or track boundary, never later in the song.
    if(!standing||!delayCandidate(current)||current.delaySeconds>0||!captureId||current.restoreAttempt===captureId
      ||!(Date.now()-(current.captureConfirmedAt||0)<1500)||!clock?.playing||clock.seeking||clock.buffering)return;
    const available=capability(current);if(!available?.compensationEligible)return;
    const experiment={enabled:true,compensationMs:standing.compensationMs,intentionalDelay:true,outputHeard:true,authorizedAudio:true,preview:true,
      captureId,generation:clock.generation||0,detectorVariant:'L0',bufferMs:standing.compensationMs,calibration:{...current.calibration}};
    const next=decideBeatMode({...modeFacts(current),experiment});
    if(next.mode!=='experimental-buffered'||!(next.bufferMs>0))return;
    current.restoreAttempt=captureId;
    const settings={bufferMs:next.bufferMs,allowTypedPreview:next.allowTypedPreview,eligible:true,flush:true,detectorVariant:'L0'};
    const step=async(extra)=>{const epoch=crypto.randomUUID();current.synchronizationEpoch=epoch;
      const result=await timeout(offscreenMessage({kind:'synchronization',captureId,settings:{...settings,...extra,epoch}}),1500).catch(()=>undefined);
      return state===current&&current.captureId===captureId&&current.synchronizationEpoch===epoch&&result?.ok===true;};
    // Hold the fresh output paused with the delay, then resume into it: one gap, at the boundary.
    if(await step({paused:true})&&await step({paused:false,resume:true})){
      current.experiment=experiment;current.delaySeconds=next.bufferMs/1000;
      telemetry.record('COMPENSATION_RESTORED',undefined,{captureId,configuredAudioDelayMs:next.bufferMs});
      publish(current,{kind:'clock',clock:audibleClock(fencedClock(current),current.delaySeconds)});publishState(current);return;
    }
    if(state!==current||current.captureId!==captureId)return;
    const epoch=crypto.randomUUID();current.synchronizationEpoch=epoch;
    void timeout(offscreenMessage({kind:'synchronization',captureId,settings:{bufferMs:0,eligible:false,allowTypedPreview:false,flush:true,paused:false,epoch}}),1500).catch(()=>{});
    publishState(current);
  }
`);
    // A capture can be proven audible while the page still reports seeking; retry on the next clock samples.
    replace('      if (resumed) current.retryAt = 0;\n','      if (resumed) current.retryAt = 0;\n      void restoreStandingDelay(current);\n');
    // A new source in the same tab replaces the session state; carry the approval for the same owner, tab and document.
    // Every ending (replacement, Kora unsubscribing, or the page emptying its media at a track change) remembers the
    // approval briefly; the next state for the same owner, tab and document resumes it.
    replace("  async function stopCurrent(keepOffscreen = false,reason='stopped') {\n    const previous = state;\n",
      "  let recentStanding,idleClose;\n  const standingKeyOf=(owner,session)=>`${owner.native||owner.tabId}:${session.tabId}:${session.documentId}`;\n"
      +"  async function stopCurrent(keepOffscreen = false,reason='stopped') {\n    const previous = state;\n"
      +"    if(previous?.standingDelay)recentStanding={key:standingKeyOf(previous.owner,previous.session),standing:previous.standingDelay,at:Date.now()};\n");
    replace("          tabMuted: session.tabMuted, clock: session };\n        state = current;\n",
      "          tabMuted: session.tabMuted, clock: session,\n"
      +"          standingDelay:recentStanding?.key===standingKeyOf(owner,session)&&Date.now()-recentStanding.at<10000?recentStanding.standing:undefined };\n"
      +"        recentStanding=undefined;\n        state = current;\n");
    // A song change in the same tab keeps the empty document and its warm detector workers for the next song, so the
    // models are not reloaded; an idle document closes after 30 s.
    replace('    if (keepOffscreen&&released) return true;\n',
      "    clearTimeout(idleClose);\n    if (keepOffscreen&&released) {\n"
      +"      idleClose=setTimeout(()=>{void serialize(async()=>{if(!state)await timeout(api.offscreen.closeDocument(),1000).catch(()=>{});});},30000);\n"
      +"      return true;\n    }\n");
    replace('    return serialize(async () => { if (state === current) await stopCurrent(false,reason); });\n',
      "    return serialize(async () => { if (state === current) await stopCurrent(reason==='track-changed',reason); });\n");
  });
  // The owner accepts that a visible video's sound runs behind its picture; Kora says so when the setting is turned on.
  edit('beat-mode.js',replace=>replace("const compensationEligible=Boolean(liveSource&&(source.kind==='audio-only'&&source.noVideo===true||source.hidden===true)&&",
    'const compensationEligible=Boolean(liveSource&&'));
  const manifest=get('manifest.json'),metadata=JSON.parse(manifest.bytes);
  Object.assign(metadata,{version:enhancedBeatSyncVersion,name:'Kora Music Companion'});delete metadata.version_name;
  manifest.bytes=Buffer.from(JSON.stringify(metadata,null,2)+'\n');
  return {enhancedBeatSync:true,approval:'kora-subscription, boundary restore once per capture',files:proof};
}
