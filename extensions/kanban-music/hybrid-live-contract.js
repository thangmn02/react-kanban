export const hybridModes=Object.freeze(['L0','H-SHADOW','H-LIVE']);
export const cnnModelSha256='785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db';
export const sameHybridOwner=(a,b)=>['captureId','sourceId','sourceGeneration','synchronizationEpoch'].every(key=>a?.[key]!==undefined&&a[key]===b?.[key]);
// H-LIVE: ADTOF Kick/Snare + CNN Hat. Light drums (a device too slow for ADTOF): CNN Kick/Snare/Hat, the lab's B routing.
export const acceptsHybridEvent=(mode,detector,event,light=false)=>detector==='CNN-B'
  ?mode==='H-LIVE'&&(event.band==='hat'||light&&['kick','clap'].includes(event.band))
  :mode==='H-LIVE'?!light&&['kick','clap'].includes(event.band):true;

const cnnClasses=[['kick','kick'],['clap','snare'],['hat','hihat']];
// Frozen B postprocessing per class: sigmoid(logit)>0.5, rising edges, skip frame zero.
export class CnnDrumEdges {
  constructor(){this.reset();}
  reset(){this.previous=[false,false,false];}
  push(logits,frame,audioTime){
    if(logits.length!==3||!Array.from(logits).every(Number.isFinite)||!Number.isFinite(audioTime))throw Error('Invalid CNN output');
    const events=[];
    for(let classIndex=0;classIndex<3;classIndex++){
      const active=logits[classIndex]>0,emit=frame>0&&active&&!this.previous[classIndex];this.previous[classIndex]=active;
      if(!emit)continue;
      const confidence=1/(1+Math.exp(-Math.max(-80,Math.min(80,logits[classIndex])))),[band,originalClassName]=cnnClasses[classIndex];
      events.push({band,classIndex,originalClassName,detectorModel:'CNN-B',audioTime,
        confidence,classMargin:confidence-.5,value:confidence,scores:Array.from(logits),scoreKind:'logits',
        modelSha256:cnnModelSha256,frontendVersion:'cnn-running-max-soxr-hq-v1; A_PARTIAL'});
    }
    return events;
  }
}
