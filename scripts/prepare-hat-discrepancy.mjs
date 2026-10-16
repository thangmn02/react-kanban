import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const folder=resolve('scratch/hat-playback-discrepancy'),old=resolve('scratch/xo-percussion-recovery');
await mkdir(folder,{recursive:true});
const previous=JSON.parse(await readFile(resolve(old,'manifest.json'),'utf8'));
const transport=JSON.parse(await readFile(resolve(old,'transport-manifest.json'),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),fixtures=[];
for(const entry of transport.fixtures){
 const source=previous.fixtures.find(f=>f.id===entry.id),bytes=await readFile(resolve(old,entry.wav));
 assert.equal(hash(bytes),entry.wavSha256);await copyFile(resolve(old,entry.wav),resolve(folder,entry.wav));
 fixtures.push({id:entry.id,inputEncoding:'audio',sourcePath:resolve(folder,entry.wav),sourceSha256:entry.wavSha256,
  duration:60,analysisStart:44,analysisEnd:58,sampleRate:44100,channels:2,kind:'controlled-acoustic',
  referenceStatus:'deterministic-synthetic-reference',events:source.events.map(e=>({...e,time:e.time+44})),
  segments:source.segments.map(s=>({...s,start:s.start+44,end:s.end+44}))});
}
const xo=previous.fixtures.find(f=>f.id==='trap');
const sourcePath=resolve(process.env.KORA_MUSIC_DOWNLOADS||resolve(process.env.USERPROFILE,'Downloads'),xo.sourceFilename);
assert.equal(hash(await readFile(sourcePath)),xo.sourceSha256);
fixtures.push({id:'trap',inputEncoding:'audio',sourcePath,sourceFilename:xo.sourceFilename,sourceSha256:xo.sourceSha256,
 duration:60,analysisStart:45,analysisEnd:57,sampleRate:44100,channels:2,kind:'natural-music',referenceStatus:'provisional-human-reference',scoringEligible:false});
const manifest={version:1,baselineRevision:'e2e2b73a944270a66057c34224629bc770f5f8f7',modelSha256:previous.modelSha256,
 sourceSha256:xo.sourceSha256,classifier:'onset-guided',thresholds:[.22,.24,.32,.22,.30],bufferMs:500,
 naturalAccuracyGate:'BLOCKED',officialNaturalMetricsCalculated:false,fixtures};
await writeFile(resolve(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(resolve(folder,'transport-manifest.json'),JSON.stringify(transport,null,2)+'\n');
console.log(JSON.stringify({fixtures:fixtures.map(f=>({id:f.id,sourceSha256:f.sourceSha256})),folder}));
