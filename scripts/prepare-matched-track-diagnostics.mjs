// Private local-source audit copy: observations only; numerical assets unchanged.
import assert from 'node:assert/strict';
import {cp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve('scratch/matched-track-quality-gap'),source=resolve('scratch/browser-first-candidate/extension');
const target=resolve(root,'extension');await mkdir(root,{recursive:true});
await cp(source,target,{recursive:true});
const changes=[];
const sha=b=>createHash('sha256').update(b).digest('hex');
async function patch(name,before,after){
  const path=resolve(target,name),bytes=await readFile(path),text=bytes.toString().replaceAll('\r\n','\n');
  assert.equal(text.split(before).length,2,`One audit sentinel: ${name}`);
  const next=text.replace(before,after);await writeFile(path,next);
  changes.push({file:name,beforeSha256:sha(bytes),afterSha256:sha(next),before,after});
}
await patch('beat-candidate.js','privatePercussionDiagnostics = false','privatePercussionDiagnostics = true');
// Copy input blocks before the extractor. Attach to the existing feature message;
// do not change its values, timestamps, cadence or transfer ownership.
await patch('percussion-worklet.js','    this.features.push(inputs[0] || [], currentFrame / sampleRate,\n      message => this.port.postMessage(message, [message.data.buffer]));',
`    this.auditBlocks ??= [];
    this.auditSeen=(this.auditSeen||0)+(inputs[0]?.[0]?.length||0);
    if(this.auditSeen<=sampleRate*3)this.auditBlocks.push({startTime:currentFrame/sampleRate,channels:(inputs[0]||[]).map(c=>Array.from(c))});
    this.features.push(inputs[0] || [], currentFrame / sampleRate,
      message => { message.pcmAudit=this.auditBlocks; this.auditBlocks=[]; this.port.postMessage(message,[message.data.buffer]); });`);
await patch('percussion-runtime.js',"onDiagnostic({kind:'features',times:data.times,data:Array.from(data.data),",
 "onDiagnostic({kind:'features',times:data.times,data:Array.from(data.data),pcmAudit:data.pcmAudit,");
const names=JSON.parse(await readFile('scratch/browser-first-candidate/package-files.json','utf8'))
  .filter(p=>p.startsWith('extension/')).map(p=>p.slice(10));
const files={};for(const name of names){const a=await readFile(resolve(source,name)),b=await readFile(resolve(target,name));
  if(!changes.some(c=>c.file===name))assert.equal(sha(a),sha(b),name);files[name]=sha(b);}
await writeFile(resolve(root,'diagnostic-extension.json'),JSON.stringify({source,target,changes,files,
  scope:'Authorized local canonical audio only. Added bounded PCM/feature observations to the existing production path. Do not load this audit copy for provider audio. Diagnostic copying can affect timing; no clean performance improvement claim.'},null,2));
console.log(JSON.stringify({target,changedFiles:changes.map(c=>c.file),unchangedFiles:names.length-changes.length}));
