import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const folder=resolve('scratch/browser-first-candidate');
const stats=values=>{
  const a=values.filter(Number.isFinite).sort((x,y)=>x-y);
  const p=q=>a[Math.max(0,Math.ceil(a.length*q)-1)]??null;
  return {samples:a.length,min:p(0),p50:p(.5),p95:p(.95),p99:p(.99),max:p(1)};
};
async function summarize(channel) {
  const bytes=await readFile(resolve(folder,`real-${channel}.json`)),run=JSON.parse(bytes);
  const samples=run.samples||[],first=samples[0],last=samples.at(-1),records=new Map();
  for(const sample of samples)for(const record of [...sample.telemetry?.records||[],...sample.offscreen?.telemetry?.records||[]])records.set(JSON.stringify(record),record);
  const all=[...records.values()],ids=new Map(),drops={};
  for(const record of all) {
    if(record.id){const group=ids.get(record.id)||[];group.push(record);ids.set(record.id,group);}
    if(record.stage==='EVENT_DROPPED')drops[record.reason||'unspecified']=(drops[record.reason||'unspecified']||0)+1;
  }
  const rendered=[],receiptToDom=[],ipc=[];
  for(const group of ids.values()) {
    const first=predicate=>group.filter(predicate).sort((a,b)=>a.at-b.at)[0];
    const dom=first(r=>r.stage==='EVENT_RENDERED'&&r.semantic===true&&['kick','snare','hat'].includes(r.type));
    const received=first(r=>r.stage==='EVENT_RECEIVED'&&r.component==='media-bridge');
    const sent=first(r=>r.stage==='EVENT_SENT'&&r.component==='offscreen');
    if(dom&&dom.targetClock==='epoch-ms')rendered.push(dom.at-dom.targetTime);
    if(dom&&received)receiptToDom.push(dom.at-received.at);
    if(sent&&received)ipc.push(received.at-sent.at);
  }
  const baseline=first?.playbackTime,wall=first?.elapsedMs;
  return {channel,browser:run.browser,manifest:run.manifest,artifactSha256:createHash('sha256').update(bytes).digest('hex'),
    completed:run.enduranceCompleted===true,enduranceSeconds:run.enduranceSeconds??null,errors:run.errors,
    snapshots:samples.length,modeCounts:samples.reduce((counts,sample)=>{const key=sample.status?.capability?.mode||'missing';counts[key]=(counts[key]||0)+1;return counts;},{}),
    configuredBuffersMs:[...new Set(samples.map(sample=>sample.status?.capability?.bufferMs))],
    outputMatchesStatus:samples.every(sample=>sample.offscreen?.health?.bufferMs===sample.status?.capability?.bufferMs),
    captureAndClockHealthy:samples.every(sample=>sample.status?.capability?.clockHealthy&&sample.status.capability.captureHealthy),
    maxQueueDepth:Math.max(0,...samples.map(sample=>sample.offscreen?.health?.queuedEvents||0),...all.filter(r=>r.stage==='WORKER_BATCH').map(r=>r.queueDepth||0)),
    appHeapBytes:stats(samples.map(sample=>sample.heap)),workerBatchMs:stats(all.filter(r=>r.stage==='WORKER_BATCH').map(r=>r.durationMs)),
    softwareDomTargetErrorMs:stats(rendered),softwareDomAbsoluteTargetErrorMs:stats(rendered.map(Math.abs)),
    sampledUniqueDomEventsOver50Ms:rendered.filter(value=>Math.abs(value)>50).length,
    softwareReceiptToDomMs:stats(receiptToDom),sampledOffscreenToAppIpcMs:stats(ipc),
    observedPlaybackWallDriftMs:stats(samples.map(sample=>Math.abs((sample.playbackTime-baseline)*1000-(sample.elapsedMs-wall)))),
    browserCpuSeconds:last?.cpuSeconds??null,averageLogicalCorePercent:last?.elapsedMs?last.cpuSeconds/(last.elapsedMs/1000)*100:null,
    finalCaptureHealth:last?.offscreen?.health,finalTraceCounters:last?.telemetry?.counts,
    sampledDropRecords:drops,uniqueSampledTraceIds:ids.size,
    limitations:['Bounded periodic trace windows are sampled, not a complete musical event ledger.',
      'DOM timestamps and elapsed-clock drift do not measure speaker-to-pixel synchronization.',
      'No sensor validates output glitches or echo; user listening acceptance is pending.']};
}
const runs=[];
for(const channel of ['chrome','msedge']) {try{runs.push(await summarize(channel));}catch(error){runs.push({channel,error:error.message});}}
const resourceName=process.env.KORA_CANDIDATE_RESOURCE_FILE;
let resources;
if(resourceName&&/^resources-\d+\.jsonl$/.test(resourceName)) {
  const rows=(await readFile(resolve(folder,resourceName),'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  resources={samples:rows.length,from:rows[0]?.timestamp,to:rows.at(-1)?.timestamp,
    aggregateProcessWorkingSetBytes:stats(rows.map(row=>row.processes.reduce((sum,p)=>sum+p.WorkingSet64,0))),
    aggregateProcessPrivateBytes:stats(rows.map(row=>row.processes.reduce((sum,p)=>sum+p.PrivateMemorySize64,0))),
    caveat:'Working sets count shared pages in each process; private bytes are separately reported.'};
}
const report={physicalVerified:false,userListeningAccepted:false,runs,resources};
await writeFile(resolve(folder,'runtime-summary.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
