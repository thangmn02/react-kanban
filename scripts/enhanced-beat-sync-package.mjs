import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const enhancedBeatSyncVersion='0.3.31';

/** Public Enhanced Beat Sync, layered on the source-audio-delay transform (run that first).
 *  The 0.3.29 evaluation route forgot an approved delay whenever a seek or track change restarted capture, so every
 *  song needed a fresh paused activation. Here an approval from Kora stands for the rest of that Kora subscription:
 *  when a restarted capture proves audible output, the Companion re-applies the approved delay at that boundary.
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
    // A restarted capture (seek, track change, recovery) re-applies the standing delay once audible output is proven.
    replace('    current.fallbackReason = undefined;\n    publishState(current);\n  }\n',
      '    current.fallbackReason = undefined;\n    publishState(current);\n    restoreStandingDelay(current);\n  }\n\n'
      +`  function restoreStandingDelay(current) {
    const standing=current.standingDelay,clock=current.clock;
    if(!standing||!delayCandidate(current)||current.delaySeconds>0||!current.captureId||!clock?.playing||clock.seeking||clock.buffering)return;
    const available=capability(current);if(!available?.compensationEligible)return;
    const captureId=current.captureId;
    const experiment={enabled:true,compensationMs:standing.compensationMs,intentionalDelay:true,outputHeard:true,authorizedAudio:true,preview:true,
      captureId,generation:clock.generation||0,detectorVariant:'L0',bufferMs:standing.compensationMs,calibration:{...current.calibration}};
    const next=decideBeatMode({...modeFacts(current),experiment});
    if(next.mode!=='experimental-buffered'||!(next.bufferMs>0))return;
    const epoch=crypto.randomUUID();current.synchronizationEpoch=epoch;
    void timeout(offscreenMessage({kind:'synchronization',captureId,settings:{bufferMs:next.bufferMs,allowTypedPreview:next.allowTypedPreview,
      eligible:true,paused:false,resume:true,flush:true,epoch,detectorVariant:'L0'}}),1500).then(result=>{
        if(state!==current||current.captureId!==captureId||current.synchronizationEpoch!==epoch)return;
        if(result?.ok!==true){cancelCapture(current);return;}
        current.experiment=experiment;current.delaySeconds=next.bufferMs/1000;
        telemetry.record('COMPENSATION_RESTORED',undefined,{captureId,configuredAudioDelayMs:next.bufferMs});
        publish(current,{kind:'clock',clock:audibleClock(fencedClock(current),current.delaySeconds)});publishState(current);
      },()=>{if(state===current&&current.synchronizationEpoch===epoch)cancelCapture(current);});
  }
`);
  });
  const manifest=get('manifest.json'),metadata=JSON.parse(manifest.bytes);
  Object.assign(metadata,{version:enhancedBeatSyncVersion,name:'Kora Music Companion'});delete metadata.version_name;
  manifest.bytes=Buffer.from(JSON.stringify(metadata,null,2)+'\n');
  return {enhancedBeatSync:true,standingApproval:'kora-subscription',files:proof};
}
