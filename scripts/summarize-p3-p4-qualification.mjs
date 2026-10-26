import {readFile,readdir,writeFile} from 'node:fs/promises';
const root='scratch/p3-p4-261026-1706';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const stats=values=>{const v=values.filter(Number.isFinite).sort((a,b)=>a-b),q=p=>v[Math.max(0,Math.ceil(v.length*p)-1)]??null;return {n:v.length,p50:q(.5),p95:q(.95),p99:q(.99),max:v.at(-1)??null};};
const results=[];
for(const group of ['live','lifecycle','youtube','youtube-endurance','final-runtime','final-runtime-gc']){
  let dirs;try{dirs=await readdir(`${root}/${group}/browser-runs`);}catch{continue;}
  for(const name of dirs){let r;try{r=await read(`${root}/${group}/browser-runs/${name}/result.json`);}catch{continue;}
    const before=new Map((r.processesBefore||[]).map(p=>[p.id,p.cpuTime]));
    const cpu=(r.processesAfter||[]).reduce((n,p)=>n+Math.max(0,p.cpuTime-(before.get(p.id)||0)),0);
    const sumMemory=values=>Array.isArray(values)?values.reduce((n,p)=>n+p.WorkingSet64,0)/1048576:null;
    const result={group,name,status:r.status,complete:r.complete??false,delayMs:r.delayMs,mode:r.detector,sourceSha256:r.sourceSha256,videoId:r.videoId,
      errors:r.errors,cpuCoreEquivalents:r.cpuSampleEnd?cpu/((r.cpuSampleEnd-r.cpuSampleStart)/1000):null,rssBeforeMiB:sumMemory(r.memoryBefore),rssAfterMiB:sumMemory(r.memoryAfter),
      gc:r.gcProfile??null,lifecycle:r.extendedLifecycle??null,appCodeUnchanged:r.appCodeUnchanged};
    if(r.endurance){
      const s=r.endurance.samples,first=s[0],last=s.at(-1);
      result.endurance={elapsedMs:r.endurance.elapsedMs,requestedSeconds:r.endurance.requestedSeconds,samples:s.length,
        sourceAlwaysPlaying:s.every(v=>v.media.playing&&!v.media.ended),contextAlwaysRunning:s.every(v=>v.capture?.health?.context==='running'),
        bufferValues:[...new Set(s.map(v=>v.capture?.health?.bufferMs))],workerFailures:stats(s.map(v=>v.capture?.health?.workerFailures)),
        semanticRejectionsFirst:first.capture?.health?.droppedSemanticEvents,semanticRejectionsLast:last.capture?.health?.droppedSemanticEvents,
        maxQueuedEvents:s.reduce((n,v)=>Math.max(n,v.capture?.health?.queuedEvents||0),0),
        rendererCommitsFirst:first.visual.telemetry.EVENT_COMMITTED,rendererCommitsLast:last.visual.telemetry.EVENT_COMMITTED,
        flatCommitIntervals:s.filter((v,i)=>i&&v.visual.telemetry.EVENT_COMMITTED===s[i-1].visual.telemetry.EVENT_COMMITTED).length,
        rafGapsMs:stats(s.flatMap(v=>v.visual.rafGaps)),heapMiB:stats(s.map(v=>v.visual.heap/1048576)),
        longTasksMs:stats(s.flatMap(v=>v.visual.longTasks).map(v=>v.duration)),
        observationLimits:'10-second health/heap/count snapshots plus continuous bounded RAF samples; root DOM queries do not traverse dock Shadow DOM. No physical pixels, audible glitches or exhaustive per-ID 30-minute trace.'};
    }
    results.push(result);
  }
}
await writeFile(root+'/qualification-summary.json',JSON.stringify({at:new Date().toISOString(),runs:results,physicalVerified:false,
  decisions:{p3:'PASS',p4Engineering:'PARTIAL',productionRelease:'BLOCKED'},frozenP2:'PARTIAL — ACOUSTIC QUALIFICATION NOT COMPLETE'},null,2));
console.log(JSON.stringify(results.map(r=>({group:r.group,status:r.status,enduranceMs:r.endurance?.elapsedMs,gc:r.gc}))));
