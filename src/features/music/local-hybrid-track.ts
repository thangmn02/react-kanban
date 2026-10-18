import {CHUNK_SECONDS,parseChunk,parseManifest,type TrackOnset} from './event-track';
import {InvalidEventTrack,type EventTrackClient} from './event-track-client';
import type {LeadProvenance} from './lead-events';

export const HYBRID_VARIANT='H0-frozen-routing-diagnostic-v1';
export interface HybridPrediction {id:string;sourceTime:number;instrument:string;confidence?:number;originModel:string;originPredictionId:string;originModelSha256:string;originCacheKey:string;originResultSha256:string}
export interface LocalHybridClip {
 originalSourceSha256:string;canonicalWavSha256:string;decodedPcmSha256:string;sampleRate:number;end:number;audioUrl:string;
 predictions:{H:HybridPrediction[]|null};hybrid:{state:string;cacheKey?:string;variantId:string;reason?:string;coverageByInstrument?:Record<string,{uncoveredIntervals:{start:number;end:number;reason:string}[]}>};
 lead?:{state:string;reason?:string;revision:string;events:{id:string;time:number;duration:number;confidence:number;lead:LeadProvenance}[];provenance:unknown};
}
export function localHybridClient(clip:LocalHybridClip,melody:boolean):EventTrackClient {
 const sha=/^[a-f0-9]{64}$/;
 if(![clip.originalSourceSha256,clip.canonicalWavSha256,clip.decodedPcmSha256].every(v=>sha.test(v))||clip.sampleRate!==44100||!Number.isFinite(clip.end)||clip.end<=0)throw new InvalidEventTrack('Invalid exact local source');
 const percussion=clip.hybrid.state==='READY';
 if(percussion&&(clip.hybrid.variantId!==HYBRID_VARIANT||!clip.predictions.H||!sha.test(clip.hybrid.cacheKey||'')))throw new InvalidEventTrack('Frozen H0 analysis incomplete');
 if(!percussion&&!(melody&&clip.lead?.state==='READY'))throw new InvalidEventTrack('No eligible saved analysis');
 const modelHashes={A:'c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a',B:'785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db'};
 const originals=new Set<string>();const events:TrackOnset[]=(percussion?clip.predictions.H!:[]).map(e=>{
  const m=e.instrument==='hat'?'B':'A';if(!['kick','snare','hat'].includes(e.instrument)||e.originModel!==m||e.originPredictionId!==e.id||e.originModelSha256!==modelHashes[m]||![e.originCacheKey,e.originResultSha256].every(v=>sha.test(v))||originals.has(m+':'+e.id))throw new InvalidEventTrack('Invalid H0 event provenance');
  originals.add(m+':'+e.id);return {id:e.id,time:e.sourceTime,row:e.instrument as 'kick'|'snare'|'hat',confidence:e.confidence??0};
 });
 if(melody&&clip.lead?.state==='READY')events.push(...clip.lead.events.map(e=>({...e,row:'melody' as const})));
 events.sort((a,b)=>a.time-b.time||a.row.localeCompare(b.row)||a.id.localeCompare(b.id));
 const asset={provider:'kora-development' as const,id:clip.originalSourceSha256},revision=[percussion?clip.hybrid.cacheKey:'no-percussion',melody&&clip.lead?.state==='READY'?clip.lead.revision:'no-lead'].join(':');
 const manifest=parseManifest({version:1,asset,revision,analysisVersion:'private-local-h0-v1',duration:clip.end,chunkSeconds:CHUNK_SECONDS,melodyPolicy:'dominant-monophonic'},asset,clip.end);
 if(!manifest)throw new InvalidEventTrack('Invalid private local manifest');
 const chunks=new Map();for(let index=0;index*CHUNK_SECONDS<clip.end;index++){
  const chunk=parseChunk({version:1,revision,index,events:events.filter(e=>Math.floor(e.time/CHUNK_SECONDS)===index)},manifest,index);
  if(!chunk)throw new InvalidEventTrack('Invalid private local event chunk');chunks.set(index,chunk);
 }
 return {async manifest(){return manifest;},async chunk(view,index){return view.revision===revision?chunks.get(index):undefined;},async requestAnalysis(){return 'unavailable';},analysisStatus:()=> 'completed'};
}
