import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createServer} from 'node:http';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {cpus,totalmem} from 'node:os';
const root=resolve('scratch/p3-p4-261026-1706');
const hz=process.argv.includes('--120')?120:60;
const opalOnly=process.argv.includes('--opal-only');
const edgesOnly=process.argv.includes('--edges-only');
const handoffOnly=process.argv.includes('--handoff-only');
const cancelOnly=process.argv.includes('--cancel-only');
const folder=resolve(root,`browser-${hz}-${new Date().toISOString().replaceAll(/[:.]/g,'-')}`);await mkdir(folder,{recursive:true});
const base='http://127.0.0.1:1436';
const baseline=(await readFile(resolve(root,'src__features__music__BeatPattern.tsx'),'utf8'))
  .replaceAll("from './SemanticBeatPattern'","from '/scratch/p3-p4-261026-1706/baseline-semantic.tsx'")
  .replaceAll("from './","from '/src/features/music/").replaceAll("from '../../../extensions/","from '/extensions/");
const semantic=(await readFile(resolve(root,'src__features__music__SemanticBeatPattern.tsx'),'utf8'))
  .replaceAll("from './","from '/src/features/music/").replaceAll("from '../../../extensions/","from '/extensions/");
await writeFile(resolve(root,'baseline-beat-pattern.tsx'),baseline);await writeFile(resolve(root,'baseline-semantic.tsx'),semantic);
await writeFile(resolve(root,'presentation.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><title>Kora Phase 3</title><div id="root"></div><script type="module" src="/scripts/fixtures/p3-p4-presentation.tsx"></script></html>');
const built=resolve(folder,'site');
await build({configFile:false,plugins:[react()],logLevel:'error',build:{outDir:built,emptyOutDir:false,copyPublicDir:false,rollupOptions:{input:resolve(root,'presentation.html')}}});
const server=createServer(async(request,response)=>{
  try{
    const path=new URL(request.url,base).pathname;
    const file=resolve(built,'.'+(path==='/'?'/scratch/p3-p4-261026-1706/presentation.html':decodeURIComponent(path)));
    if(!file.startsWith(built+sep))throw Error('Outside evidence site');
    response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(file)]||'application/octet-stream');
    response.end(await readFile(file));
  }catch{response.writeHead(404);response.end();}
});
const stats=values=>{const v=values.filter(Number.isFinite).sort((a,b)=>a-b),q=p=>v[Math.max(0,Math.ceil(v.length*p)-1)]??null;return {n:v.length,p50:q(.5),p95:q(.95),p99:q(.99),max:v.at(-1)??null};};
const result={at:new Date().toISOString(),requestedSoftwareHz:hz,physicalVerified:false,hardware:{cpu:cpus()[0].model,logicalCpus:cpus().length,ramBytes:totalmem()},runs:[],errors:[]};
let browser;
try{
  await new Promise((done,fail)=>{server.once('error',fail);server.listen(1436,'127.0.0.1',done);});
  result.process={pid:process.pid,command:process.argv.join(' '),port:1436,startedAt:new Date().toISOString(),worktree:process.cwd()};
  browser=await chromium.launch({channel:'chrome',headless:true,args:[`--fake-vsync-rate=${hz}`,'--autoplay-policy=no-user-gesture-required','--mute-audio']});
  result.browser=await browser.version();
  const page=await browser.newPage({viewport:{width:1000,height:900}});page.on('pageerror',e=>result.errors.push(e.stack));
  const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__p3Qualification);
  const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  async function run(configuration){
    const before=await metrics();
    const raw=await page.evaluate(configuration=>window.__p3Qualification.run(configuration),configuration);const after=await metrics();
    const unique=values=>new Set(values),ids=raw.accepted.map(e=>e.id);
    const commits=raw.rows.flashes.filter(f=>f.semantic&&f.stage==='commit'),animations=raw.rows.flashes.filter(f=>f.semantic&&f.stage==='animation');
    const eventCommits=raw.telemetry.records.filter(r=>r.stage==='EVENT_COMMITTED'&&r.semantic===true);
    const suppression=unique(raw.decisions.records.filter(r=>['gate','cleanup'].includes(r.stage)&&r.reason==='pattern-exclusive').map(r=>raw.accepted.find(e=>e.key===r.key)?.id||r.key));
    const steady=unique(raw.decisions.records.filter(r=>r.stage==='play'&&r.reason==='steady').map(r=>raw.accepted.find(e=>e.key===r.key)?.id||r.key));
    const visible=unique(raw.sampledFrames.flatMap(f=>f.ids));
    const firstFrame=new Map();for(const frame of raw.sampledFrames)for(const id of frame.ids)if(!firstFrame.has(id))firstFrame.set(id,frame.at);
    const firstCommit=new Map();for(const event of commits)if(!firstCommit.has(event.eventId))firstCommit.set(event.eventId,event.actualRenderTime);
    const frameGroups=new Map();for(const [id,at]of firstFrame){const list=frameGroups.get(at)||[];list.push(id);frameGroups.set(at,list);}
    const coalesced=[...frameGroups.values()].flatMap(group=>group.filter((id,i)=>group.slice(0,i).some(other=>raw.accepted.find(e=>e.id===other)?.band===raw.accepted.find(e=>e.id===id)?.band)));
    const summary={name:configuration.name,baseline:!!configuration.baseline,semanticOnly:!!configuration.semanticOnly,profile:configuration.profile||'legacy',reduced:!!configuration.reduced,
      inputHash:createHash('sha256').update(JSON.stringify(configuration.input)).digest('hex'),accepted:ids.length,committed:unique(commits.map(e=>e.eventId)).size,
      animationStarted:unique(animations.map(e=>e.eventId)).size,softwareVisible:visible.size,suppressed:suppression.size,subFrameCoalesced:coalesced.length,
      reducedSteady:steady.size,missing:ids.filter(id=>!visible.has(id)&&!suppression.has(id)&&!steady.has(id)),
      additionalCellCommits:commits.length-unique(commits.map(e=>e.eventId)).size,duplicateCommits:eventCommits.length-unique(eventCommits.map(e=>e.id)).size,
      unexpectedVisible:[...visible].filter(id=>!ids.includes(id)),
      commitOffsetMs:stats(raw.accepted.flatMap(e=>firstCommit.has(e.id)?[firstCommit.get(e.id)-e.target]:[])),
      frameOffsetMs:stats(raw.accepted.flatMap(e=>firstFrame.has(e.id)?[firstFrame.get(e.id)-e.target]:[])),rafGapsMs:stats(raw.rafGaps),longTasksMs:stats(raw.longTasks),
      taskCpuMs:(after.TaskDuration-before.TaskDuration)*1000,heapBefore:before.JSHeapUsedSize,heapAfter:after.JSHeapUsedSize,
      animationsAfterStop:raw.animationsAfterStop,staleAfterStop:raw.staleAfterStop,diagnosticOverflow:raw.rows.overflow+raw.decisions.overflow};
    summary.lifecycle=raw.lifecycle;
    summary.presentationStates=raw.presentationStates;
    result.runs.push(summary);await writeFile(resolve(folder,`${result.runs.length}-${configuration.name}.json`),JSON.stringify(raw,null,2));console.log(JSON.stringify(summary));
    assert.equal(summary.diagnosticOverflow,0);
    if(!configuration.baseline){assert.equal(summary.animationsAfterStop,0);assert.equal(summary.staleAfterStop,0);assert.equal(summary.duplicateCommits,0);assert.deepEqual(summary.missing,[]);assert.deepEqual(summary.unexpectedVisible,[]);}
    for(const state of raw.lifecycle)assert.equal(state.semanticElements,0,`Stale ${state.action}`);
    if(configuration.exclusive){assert(raw.presentationStates.some(s=>s.state==='EXCLUSIVE_ACTIVE'));if(!configuration.lifecycle)assert(raw.presentationStates.some(s=>s.state==='EXCLUSIVE_EXIT'));assert.equal(raw.presentationStates.at(-1).state,'NORMAL');assert(summary.suppressed>0);}
    return summary;
  }
  const cases=[
    ['kick',[{at:150,bands:['kick']}]],['snare',[{at:150,bands:['clap']}]],['hat',[{at:150,bands:['hat']}]],
    ['kick-bass',[{at:150,bands:['kick','bass'],duration:1.2}]],['all-drums',[{at:150,bands:['kick','clap','hat']}]],
    ...[20,30,60,125].map(ms=>[`rapid-${ms}`,Array.from({length:10},(_,i)=>({at:150+i*ms,bands:['hat']}))]),
    ['batch',[{at:150,bands:['hat','hat','hat']}]],['bass-sustain',[{at:150,bands:['bass'],duration:1.8}]],
    ['lead',[{at:150,bands:['melody'],duration:.3}]],['dense',Array.from({length:18},(_,i)=>({at:150+i*30,bands:['kick','clap','hat','bass','melody']}))],['silence',[]],
  ];
  for(const [name,input]of opalOnly||edgesOnly||handoffOnly||cancelOnly?[]:cases)for(const semanticOnly of [false,true]){
    if(['batch','dense','rapid-20'].includes(name))await run({name,input,semanticOnly,baseline:true});
    await run({name,input,semanticOnly});
  }
  if(!opalOnly&&!edgesOnly&&!handoffOnly&&!cancelOnly){
  await page.emulateMedia({reducedMotion:'reduce'});
  await run({name:'reduced-motion',input:[{at:150,bands:['kick','clap','hat','bass','melody']}],reduced:true});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await run({name:'exclusive',exclusive:true,input:[{at:150,bands:['kick']},{at:400,bands:['hat']},{at:700,bands:['clap']},{at:9700,bands:['hat']}],milliseconds:400});
  await run({name:'stress',stress:true,input:Array.from({length:25},(_,i)=>({at:150+i*30,bands:['hat']}))});
  for(const semanticOnly of [false,true])await run({name:'lifecycle',semanticOnly,lifecycle:true,input:[{at:150,bands:['kick','bass','melody'],duration:1.8}]});
  await run({name:'degraded',degraded:true,input:[]});
  }
  if(!edgesOnly&&!handoffOnly&&!cancelOnly){
    for(const profile of ['focus','dynamic'])for(const semanticOnly of [false,true])await run({name:`opal-${profile}`,profile,semanticOnly,input:Array.from({length:8},(_,i)=>({at:150+i*60,bands:['kick','clap','hat']}))});
    for(const profile of ['focus','dynamic'])await run({name:`opal-reduced-${profile}`,profile,reduced:true,semanticOnly:true,input:Array.from({length:8},(_,i)=>({at:150+i*60,bands:['hat']}))});
  }
  if(!opalOnly&&!handoffOnly&&!cancelOnly)for(const semanticOnly of [false,true])await run({name:'cached-lead-state',stateLead:true,semanticOnly,input:[{at:150,bands:['kick','melody'],duration:.35}]});
  if(!opalOnly&&!edgesOnly&&!cancelOnly)for(const semanticOnly of [false,true])await run({name:'cached-lead-handoff',stateLead:true,splitLead:true,semanticOnly,input:[{at:150,bands:['melody'],duration:.3},{at:200,bands:['kick']}]});
  if(cancelOnly)await run({name:'exclusive-cancel',exclusive:true,lifecycle:true,input:[{at:150,bands:['kick']}]});
  await page.screenshot({path:resolve(folder,'surface.png')});
  assert.deepEqual(result.errors,[]);result.status='PASS';
}catch(error){result.status='FAIL';result.errors.push(error.stack);process.exitCode=1;}
finally{await browser?.close();if(server.listening)await new Promise(done=>server.close(done));await writeFile(resolve(folder,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({folder,status:result.status,errors:result.errors}));}
