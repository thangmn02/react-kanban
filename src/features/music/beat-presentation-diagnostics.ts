import {beatTelemetry} from '../../../extensions/kanban-music/beat-telemetry.js';

export interface PresentationDecision {
  at:number; key:string; band:string; stage:'seed'|'gate'|'play'|'commit'|'frame'|'cleanup';
  reason:string; deadlineMs?:number; owner?:string; profile?:string;
  cells?:number; hidden?:boolean; active?:boolean;
  presentationTimeMs?:number;lateLivePreview?:boolean;
}
const capacity=6000;
let records:PresentationDecision[]=[],overflow=0;
/** Opt-in metadata only. No event generation, scheduling or rendering side effects. */
export const beatPresentationDiagnostics={
  record(value:Omit<PresentationDecision,'at'>){
    if(!beatTelemetry.enabled)return;
    if(records.length>=capacity){overflow++;return;}
    records.push({at:Date.now(),...value});
  },
  clear(){records=[];overflow=0;},
  snapshot(){return {records:records.map(r=>({...r})),overflow,capacity,physicalVerified:false};},
};
