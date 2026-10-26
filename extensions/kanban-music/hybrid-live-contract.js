export const hybridModes=Object.freeze(['L0','H-SHADOW','H-LIVE']);
export const cnnModelSha256='785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db';
export const sameHybridOwner=(a,b)=>['captureId','sourceId','sourceGeneration','synchronizationEpoch'].every(key=>a?.[key]!==undefined&&a[key]===b?.[key]);
export const acceptsHybridEvent=(mode,detector,event)=>detector==='CNN-B'?mode==='H-LIVE'&&event.band==='hat'
  :mode==='H-LIVE'?['kick','clap'].includes(event.band):true;

// Frozen B postprocessing: sigmoid(logit)>0.5, rising edges, skip frame zero.
export class CnnHatEdges {
  constructor(){this.reset();}
  reset(){this.previous=false;}
  push(logits,frame,audioTime){
    if(logits.length!==3||!Array.from(logits).every(Number.isFinite)||!Number.isFinite(audioTime))throw Error('Invalid CNN output');
    const active=logits[2]>0,emit=frame>0&&active&&!this.previous;this.previous=active;
    if(!emit)return;
    const confidence=1/(1+Math.exp(-Math.max(-80,Math.min(80,logits[2]))));
    return {band:'hat',classIndex:2,originalClassName:'hihat',detectorModel:'CNN-B',audioTime,
      confidence,classMargin:confidence-.5,value:confidence,scores:Array.from(logits),scoreKind:'logits',
      modelSha256:cnnModelSha256,frontendVersion:'cnn-running-max-soxr-hq-v1; A_PARTIAL'};
  }
}
