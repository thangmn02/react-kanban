// Private event routing only; the canonical Python function performs the selection.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {resolve} from 'node:path';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const hybridVariant='H0-frozen-routing-diagnostic-v1';
export const frozenModels={A:'c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a',B:'785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db'};
export async function createHybridRouter(){
 const script=resolve('scripts/hat-recovery-core.py'),algorithmSha256=hash(await readFile(script)),cache=new Map();
 return async function route(source,records,coverage){
  const missing=['A','B'].filter(m=>!records[m]);
  if(missing.length)return {events:null,metadata:{variantId:hybridVariant,state:'INCOMPLETE',missing,reason:'H requires both exact frozen A and B; no fallback or invented events.'}};
  const components=Object.fromEntries(['A','B'].map(m=>{
   const r=records[m],modelSha256=r.contract?.identities?.[m]?.contract?.modelSha256;
   if(modelSha256!==frozenModels[m])throw Error('H requires the frozen '+m+' checkpoint');
   if(r.sourceSha256!==source.originalSourceSha256||r.pcmSha256!==source.decodedPcmSha256)throw Error('H source binding mismatch');
   return [m,{modelSha256,cacheKey:r.cacheKey,resultSha256:r.resultSha256,contract:r.contract.identities[m],coverage:coverage[m]}];
  }));
  const binding={variantId:hybridVariant,algorithmSha256,originalSourceSha256:source.originalSourceSha256,canonicalWavSha256:source.canonicalWavSha256,decodedPcmSha256:source.decodedPcmSha256,components},cacheKey=hash(JSON.stringify(binding));
  if(cache.has(cacheKey))return cache.get(cacheKey);
  const pending=(async()=>{
   const output=await new Promise((done,reject)=>{
    const child=execFile(resolve('scratch/beat-grid-v2/.venv/Scripts/python.exe'),['-B',script],{windowsHide:true,timeout:30000,maxBuffer:16*1024*1024},(error,stdout)=>error?reject(error):done(stdout));
    child.stdin.on('error',reject);child.stdin.end(JSON.stringify({A:records.A.events,B:records.B.events}));
   });
   const events=JSON.parse(output).map(event=>({...event,originModelSha256:components[event.originModel].modelSha256,originCacheKey:components[event.originModel].cacheKey,originResultSha256:components[event.originModel].resultSha256}));
   return {events,metadata:{...binding,cacheKey,state:'READY',routing:{kick:'A',snare:'A',hat:'B'},cymbalMerged:false,inferenceRun:false,cacheScope:'One routing result per exact validated binding per server process; persisted A/B caches reused unchanged.',coverageByInstrument:{kick:coverage.A,snare:coverage.A,hat:coverage.B}}};
  })();cache.set(cacheKey,pending);try{return await pending;}catch(error){cache.delete(cacheKey);throw error;}
 };
}
