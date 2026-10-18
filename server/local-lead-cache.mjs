import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function savedLocalLead(root,id,clip){
 const unavailable=reason=>({state:'UNAVAILABLE',reason,revision:'unavailable',events:[],provenance:{scope:'No exact saved Lead binding; no fabricated notes.'}});
 try{
  const registry=JSON.parse(await readFile('scratch/hybrid-beta/saved-lead-registry.json','utf8')),entry=registry.entries.find(e=>e.id===id);if(!entry)return unavailable('No saved Lead analysis for this exact recording.');
  const bytes=await readFile(resolve(root,id,'lead-cache.json'));if(hash(bytes)!==entry.recordSha256)return unavailable('Saved Lead cache changed; verify its provenance before reuse.');
  const data=JSON.parse(bytes);if(data.sourceSha256!==id||data.canonicalWavSha256!==clip.canonicalWavSha256||data.decodedPcmSha256!==clip.decodedPcmSha256||data.duration!==clip.end||data.revision!==entry.revision)return unavailable('Saved Lead source/PCM/duration binding mismatch.');
  return {state:'READY',revision:data.revision,events:data.events,provenance:{...data,events:undefined},coverage:{start:0,end:clip.end,completeForExactRecording:true}};
 }catch(error){return unavailable(error.code==='ENOENT'?'Local saved Lead cache unavailable.':String(error.message));}
}
