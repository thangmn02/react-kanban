import type {Prediction,Model} from './acoustic-visual-lab-core';
export type ListeningTrack=Model|'H';
export const feedbackTypes=['H feels better than A','H feels better than B','Kick missed','Missed Snare','Missed Hi-Hat','False Snare','False Hi-Hat','Flash too early','Flash too late','Rapid hits visually merged','Consecutive hits visually merged','This passage seems correct','Unsure / needs review'] as const;
export function eventsBetween(events:Prediction[],after:number,through:number){
 let low=0,high=events.length;while(low<high){const mid=(low+high)>>>1;if(events[mid].sourceTime<=after+1e-9)low=mid+1;else high=mid;}
 const result:Prediction[]=[];for(let i=low;i<events.length&&events[i].sourceTime<=through+1e-9;i++)result.push(events[i]);return result;
}
export function boundedLanes(events:Prediction[],start:number,end:number,perClass=160){
 const selected=eventsBetween(events,start-1e-8,end),classes=['kick','snare','hat','cymbal','grouped-percussion','tom'];
 return classes.map(instrument=>{const all=selected.filter(e=>e.instrument===instrument);return {instrument,total:all.length,events:all.slice(0,perClass)};});
}
export function feedbackPayload(sourceSha256:string,sourceTime:number,model:ListeningTrack,renderer:string,type:string,note:string){return {version:1,sourceSha256,sourceTime,model,renderer,type,note,provenance:'model-exposed-qualitative-feedback'};}
export function frameCoverage(times:number[],step:number,duration:number){
 const uncoveredIntervals:{start:number;end:number;reason:string}[]=[];let covered=0;
 for(const time of times){if(time>covered+1e-6)uncoveredIntervals.push({start:covered,end:Math.min(time,duration),reason:'No saved raw detector frames; original context/EOF behavior retained.'});covered=Math.max(covered,Math.min(duration,time+step));}
 if(covered<duration-1e-6)uncoveredIntervals.push({start:covered,end:duration,reason:'No saved raw detector frames at EOF; no padded inference or invented hits.'});
 return {rawStart:times[0]??null,rawEnd:times.at(-1)??null,stepSeconds:step,uncoveredIntervals,completeRawCoverage:uncoveredIntervals.length===0};
}
