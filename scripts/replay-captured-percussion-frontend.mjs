import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {PercussionFeatures}=await import(pathToFileURL(resolve('extensions/kanban-music/percussion-features.js')).href);
const input=JSON.parse(await readFile(process.argv[2],'utf8'));
const blocks=new Map();for(const frame of input.features)for(const block of frame.pcmAudit||[])blocks.set(block.startTime,block);
const ordered=[...blocks.values()].sort((a,b)=>a.startTime-b.startTime);
assert(ordered.length>100,'PCM observation required');
const config=JSON.parse(await readFile('extensions/kanban-music/generated/percussion/percussion.json','utf8'));
const extractor=new PercussionFeatures(config),observed=new Map(),frames=[];
for(const feature of input.features)for(let i=0;i<feature.times.length;i++)observed.set(feature.times[i].toFixed(8),feature.data.slice(i*config.bins,(i+1)*config.bins));
let prior;
for(const block of ordered){if(prior)assert(Math.abs(block.startTime-prior.startTime-prior.channels[0].length/config.sampleRate)<1e-7,'PCM gap');prior=block;
 extractor.push(block.channels.map(c=>Float32Array.from(c)),block.startTime,b=>b.times.forEach((time,i)=>frames.push({time,data:Array.from(b.data.slice(i*config.bins,(i+1)*config.bins))})));
}
const differences=[];let matched=0;
for(const frame of frames){const other=observed.get(frame.time.toFixed(8));assert(other,'Missing observed feature');matched++;frame.data.forEach((v,i)=>differences.push(Math.abs(v-other[i])));}
let maximum=0;for(const d of differences)maximum=Math.max(maximum,d);
const result={pcmBlocks:ordered.length,startAudioTime:ordered[0].startTime,endAudioTime:prior.startTime+prior.channels[0].length/config.sampleRate,
 frames:matched,values:differences.length,maxAbsoluteDifference:maximum,meanAbsoluteDifference:differences.reduce((s,v)=>s+v,0)/differences.length,
 exact:differences.every(d=>d===0),scope:'Unmodified production JS frontend replayed on exact observed pre-extractor PCM and original quantum times; bounded initial three seconds only.'};
await writeFile(process.argv[3],JSON.stringify(result,null,2));console.log(JSON.stringify(result));
