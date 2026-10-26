export const ADTOF_CLASS_NAMES=Object.freeze(['kick','snare','tom','hat','cymbal']);
const mappings=Object.freeze({M0:['kick','clap',null,'hat','hat'],M1:['kick','clap',null,'hat',null]});
export function mappedPercussionKind(index,mapping='M0'){
  if(!Object.hasOwn(mappings,mapping))throw new TypeError('Invalid Hat label mapping');
  return mappings[mapping][index]??null;
}

export function validateHatLabelMode(mode='off') {
  if(!['off','M0','M1','shadow'].includes(mode))throw new TypeError('Invalid private Hat label mode');
  return mode;
}

export function mapPercussionCandidates(candidates,mapping,thresholds,diagnostics=false) {
  if(!Object.hasOwn(mappings,mapping))throw new TypeError('Invalid Hat label mapping');
  const unique=new Map(),records=[];
  for(const event of candidates){
    const band=mappedPercussionKind(event.classIndex,mapping);
    const record=diagnostics?{audioTime:event.audioTime,originalClassIndex:event.classIndex,
      originalClassName:ADTOF_CLASS_NAMES[event.classIndex],rawClassScore:event.confidence,
      rawScores:event.scores,peakNovelty:event.value,threshold:thresholds[event.classIndex],
      postprocessingDecision:'finalized-peak-group',mappedSemanticKind:band,
      eventId:`${event.classIndex}:${event.audioTime}`,mapping,
      finalEmissionDecision:band?'emitted':'suppressed-label-contract'}:undefined;
    if(record)records.push(record);
    if(!band)continue;
    const key=`${band}:${event.audioTime}`,previous=unique.get(key);
    if(!previous||previous.event.confidence<event.confidence){
      if(previous?.record){previous.record.finalEmissionDecision='same-timestamp-replaced';previous.record.replacedBy=record?.eventId;}
      unique.set(key,{event,record});
    }else if(record){record.finalEmissionDecision='same-timestamp-suppressed';record.replacedBy=previous.record?.eventId;}
  }
  return {events:[...unique.values()].map(value=>value.event),...(diagnostics?{labelCandidates:records}:{})};
}

export function labelProvenance(record,config,mapping){
  const owner=config.ownership||{};
  return {...record,...owner,modelId:config.id||'adtof-frame-rnn',modelSha256:config.sha256,mapping,
    eventId:JSON.stringify([owner.captureId,owner.sourceId,owner.sourceGeneration,owner.synchronizationEpoch,
      record.originalClassIndex,record.audioTime])};
}
