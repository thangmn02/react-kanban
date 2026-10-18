// Only mutates the generated fixture's recoverable private cache, never user audio.
import assert from 'node:assert/strict';
import {readFile,writeFile,open,copyFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='http://127.0.0.1:5173',root='scratch/acoustic-visual-lab',checks=[];
const get=async path=>{const response=await fetch(base+path);assert.equal(response.status,200);return response.json();};
const post=async path=>{const response=await fetch(base+path,{method:'POST',headers:{Origin:base}});assert.equal(response.status,200);return response.json();};
const catalog=await get('/lab/full/songs'),id=catalog.songs.fixture.id,folder=`${root}/full-songs/${id}`;
const hashes=async()=>Object.fromEntries(await Promise.all(['A','B','C'].map(async m=>[m,createHash('sha256').update(await readFile(`${folder}/${m}.json`)).digest('hex')])));
const before=await hashes();
async function until(predicate){for(let i=0;i<200;i++){if(await predicate())return;await new Promise(done=>setTimeout(done,50));}throw Error('Timed out waiting for owned preparation state');}
await post('/lab/full/retry/'+id);let pid;
await until(async()=>{try{const worker=JSON.parse(await readFile(root+'/full-songs/worker-process.json','utf8'));if(worker.id===id&&worker.pid){pid=worker.pid;return true;}}catch{}return false;});
await post('/lab/full/cancel/'+id);await until(async()=>(await get('/lab/full/status/'+id)).state==='CANCELLED');assert.deepEqual(await hashes(),before);checks.push('Active owned preparation cancellation preserves every successful cached model result');
await post('/lab/full/retry/'+id);await until(async()=>{const s=await get('/lab/full/status/'+id);return s.state==='READY'&&['A','B','C'].every(m=>s.models[m].reused);});assert.deepEqual(await hashes(),before);checks.push('Retry after actual cancellation reuses all valid lane records');
const source=JSON.parse(await readFile(folder+'/source.json','utf8')),canonical=folder+'/canonical.wav',backup=folder+'/canonical-integrity-test-backup.wav';await copyFile(canonical,backup);
try{
 const file=await open(canonical,'r+');const byte=Buffer.alloc(1);await file.read(byte,0,1,200);byte[0]^=1;await file.write(byte,0,1,200);await file.close();
 assert.equal((await fetch(base+'/lab/full/clip/'+id)).status,400);assert.equal((await get('/lab/full/status/'+id)).state,'STALE');assert.equal((await fetch(base+'/lab/full/audio/'+id)).status,400);checks.push('Changed canonical bytes fail closed before clip or audio delivery and mark readiness STALE');
}finally{await copyFile(backup,canonical);assert.equal(createHash('sha256').update(await readFile(canonical)).digest('hex'),source.canonicalWavSha256);await unlink(backup);}
await post('/lab/full/retry/'+id);await until(async()=>{const s=await get('/lab/full/status/'+id);return s.state==='READY'&&['A','B','C'].every(m=>s.models[m].reused);});assert.deepEqual(await hashes(),before);checks.push('Restored exact canonical source reuses successful inference rather than repeating it');
const receipt={status:'PASS',generatedSourceOnly:true,sourceSha256:id,cancelledWorkerPid:pid,checks,resultHashes:before};await writeFile(root+'/full-song-cache-api-verification.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
