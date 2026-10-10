import { readFile, writeFile } from 'node:fs/promises';
import { temporalMatch } from './score-percussion-annotations.mjs';
const directory='src-tauri/target/percussion-closure';
const files=['matched-adtof','matched-causal','matched-cache'];
const runs=await Promise.all(files.map(async name=>({name,...JSON.parse(await readFile(`${directory}/${name}.json`,'utf8'))})));
if(new Set(runs.map(r=>r.audioSha256)).size!==1)throw new Error('Comparison uses different audio');
const streams=runs.map(run=>({path:run.name,audioSha256:run.audioSha256,modelSha256:run.modelSha256,
  summary:run.summary,bridgeDrops:run.bridgeDrops.length,
  rows:Object.fromEntries(['kick','snare','hat'].map(row=>[row,run.ui.filter(r=>r.stage==='EVENT_COMMITTED'&&r.type===row&&r.source==='onset')
    .map(r=>({eventId:r.id,time:r.targetPlaybackTime,source:r.eventSource,confidence:r.confidence}))]))}));
const agreement=streams.slice(1).map(candidate=>({path:candidate.path,interpretation:'Prediction agreement only; NOT human precision/recall',
  rows:Object.fromEntries(['kick','snare','hat'].map(row=>[row,temporalMatch(streams[0].rows[row].map(e=>e.time),candidate.rows[row].map(e=>e.time))]))}));
await writeFile(`${directory}/comparison.json`,JSON.stringify({streams,agreement},null,2));
console.log(JSON.stringify(streams.map(r=>({path:r.path,summary:r.summary,rows:Object.fromEntries(Object.entries(r.rows).map(([k,v])=>[k,v.length]))}))));
