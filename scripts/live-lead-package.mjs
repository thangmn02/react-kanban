import assert from 'node:assert/strict';
import {LEAD_TRACKER_VERSION} from '../extensions/kanban-music/lead-tracker.js';

export const liveLeadFiles=['lead-tracker.js','lead-tracker-worklet.js','lead-runtime.js'];

/** Owner evaluation: the causal Lead tracker feeds the fifth row through the existing onset transport. */
export function prepareLiveLead(files){
  const get=name=>{const matches=files.filter(file=>file.name===name);assert.equal(matches.length,1,'Live Lead needs '+name);return matches[0];};
  for(const name of liveLeadFiles)get(name);
  function edit(name,fn){const file=get(name);let source=file.bytes.toString().replaceAll('\r\n','\n');
    const replace=(before,after)=>{assert.equal(source.split(before).length-1,1,'Live Lead boundary changed: '+name);source=source.replace(before,after);};
    fn(replace);file.bytes=Buffer.from(source);
  }
  edit('capture-engine.js',replace=>{
    replace("import { createLeadAudioTap } from './lead-audio-tap.js';","import { createLeadAudioTap } from './lead-audio-tap.js';\nimport { createLeadRuntime } from './lead-runtime.js';");
    replace('    previous.audioTap?.stop();\n','    previous.audioTap?.stop();\n    previous.leadOwner?.runtime?.stop();\n');
    // The Lead tracker shares the capture's ownership, epoch and typed-preview gate with percussion.
    replace('      startPercussion();\n      stream.getAudioTracks()',`      const startLead=()=>{
        const owner={epoch:state.synchronizationEpoch};state.leadOwner=owner;
        void createLeadRuntime({context:state.context,source:state.source,ownership:{captureId,epoch:owner.epoch},
          onEvent(event){
            if(active!==state||state.leadOwner!==owner||owner.epoch!==state.synchronizationEpoch)return;
            if(state.candidate&&(!state.typedPreview||event.audioTime<state.acceptAfter)){state.droppedSemanticEvents++;return;}
            const trace=telemetry.events('onset',['melody'],{captureId,origin:'local-detector',confidence:event.confidence,
              targetTime:event.audioTime,targetClock:'audio-seconds'});
            for(const item of trace||[])Object.assign(item,{detectorModel:event.version,leadKind:event.kind,
              detectorReadyAt:Date.now(),...(event.midiPitch!==undefined?{midiPitch:event.midiPitch}:{})});
            enqueue('beat',['melody'],event.audioTime,trace,true);
          }}).then(runtime=>{
          if(active!==state||state.leadOwner!==owner){runtime?.stop();return;}
          owner.runtime=runtime||undefined;
        }).catch(()=>{if(state.leadOwner===owner)state.leadOwner=undefined;});
      };
      state.restartLead=()=>{
        const owner=state.leadOwner;if(!owner?.runtime){startLead();return;}
        owner.epoch=state.synchronizationEpoch;owner.runtime.reset({captureId,epoch:owner.epoch});
      };
      startPercussion();
      startLead();
      stream.getAudioTracks()`);
    replace('        drumHits.length=0;\n        state.latencies.length=0;','        drumHits.length=0;\n        state.restartLead?.();\n        state.latencies.length=0;');
    replace('workerFailures:active.percussionFailures||0}:undefined;},',
      'workerFailures:active.percussionFailures||0,leadLive:active.leadOwner?.runtime?.health.ready===true,leadEvents:active.leadOwner?.runtime?.health.events||0}:undefined;},');
  });
  edit('beat-sync.js',replace=>replace("const validBands = new Set(['kick', 'bass', 'clap', 'hat']);","const validBands = new Set(['kick', 'bass', 'clap', 'hat', 'melody']);"));
  const manifest=get('manifest.json'),metadata=JSON.parse(manifest.bytes);
  metadata.version_name=metadata.version_name.replace(' · evaluation',' · live lead · evaluation');manifest.bytes=Buffer.from(JSON.stringify(metadata,null,2)+'\n');
  return {detector:LEAD_TRACKER_VERSION,row:'melody',modelChanged:false,weights:'none (signal processing only)',causal:true,
    files:[...liveLeadFiles,'capture-engine.js','beat-sync.js'].map(name=>({name}))};
}
