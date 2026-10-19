import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {summarizeDelivery,quantiles} from './summarize-beat-delivery.mjs';
import {captureClockAges} from './analyze-percussion-latency-floor.mjs';

export function summarizeBrowserResources(samples) {
  const counters=new Map();let incompleteMemorySamples=0,counterResets=0;
  const workingSets=[];
  for(const sample of samples) {
    if(sample.processes.some(p=>!Number.isFinite(p.residentBytes)))incompleteMemorySamples++;
    else workingSets.push(sample.processes.reduce((sum,p)=>sum+p.residentBytes,0));
    for(const process of sample.processes)if(Number.isFinite(process.cpuSeconds)) {
      const prior=counters.get(process.pid);
      if(prior&&process.cpuSeconds<prior.last){counterResets++;prior.invalid=true;}
      if(prior)prior.last=process.cpuSeconds;
      else counters.set(process.pid,{first:process.cpuSeconds,last:process.cpuSeconds});
    }
  }
  const cpuSecondsLowerBound=[...counters.values()].filter(p=>!p.invalid).reduce((sum,p)=>sum+p.last-p.first,0);
  const wallSeconds=samples.length>1?(samples.at(-1).at-samples[0].at)/1000:null;
  return {samples:samples.length,observedPids:counters.size,counterResets,incompleteMemorySamples,
    cpuSecondsLowerBound:wallSeconds?cpuSecondsLowerBound:null,wallSeconds,
    averageLogicalCoreEquivalentLowerBound:wallSeconds?cpuSecondsLowerBound/wallSeconds:null,
    sampledWorkingSetSumBytes:quantiles(workingSets),
    scope:'Only this isolated Chrome process inventory. Observed CPU deltas exclude startup before first sighting and may omit short-lived processes; RSS sums can double-count shared pages and miss between-sample peaks. Harness/stress-worker/sampling-subprocess CPU is excluded. Not a universal browser budget qualification.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const root='scratch/low-latency-semantic/l1-runtime',runs=[];
  const config=JSON.parse(await readFile('extensions/kanban-music/generated/percussion/percussion.json','utf8'));
  for(const entry of await readdir(root,{withFileTypes:true}))if(entry.isDirectory()) {
    const scenario=entry.name.startsWith('stress')?'stress':'foreground';
    let receipt;
    try{receipt=JSON.parse(await readFile(`${root}/${entry.name}/browser-latency-${scenario}.json`,'utf8'));}
    catch(error){if(error.code==='ENOENT')continue;throw error;}
    const run={name:entry.name,detector:receipt.detector,status:receipt.status,errors:receipt.errors,
      startedAt:receipt.startedAt,browser:receipt.browser,software:receipt.runs.at(-1),continuity:receipt.continuity,
      previewAdmittedSeconds:Number.isFinite(receipt.eofAt)?(receipt.eofAt-receipt.liveStartedAt)/1000:null,
      browserResources:summarizeBrowserResources(receipt.browserResources?.samples||[])};
    if(receipt.status!=='FAIL') {
      const raw=JSON.parse(await readFile(`${root}/${entry.name}/${scenario}-latency-live-a.json`,'utf8'));
      run.stages=summarizeDelivery(raw);run.clockAges=captureClockAges(raw,config).summary;
    }
    runs.push(run);
  }
  const comparison=[['pair1-L0','pair1-L1-retry'],['pair2-L0','pair2-L1'],['pair3-L0','pair3-L1'],
    ['full-L0-retry','full-L1'],['stress-L0','stress-L1']].map(([baseline,candidate])=>{
      const a=runs.find(r=>r.name===baseline),b=runs.find(r=>r.name===candidate);
      return {baseline,candidate,complete:!!a?.software&&!!b?.software,
        p95DifferenceMs:a?.software&&b?.software?b.software.softwareAnimationDelayMs.p95-a.software.softwareAnimationDelayMs.p95:null};
    });
  const result={runs,comparison,physicalSynchronization:'UNVERIFIED',
    scope:'Independent controlled trials, not paired acoustic onsets. Negative p95 differences describe software improvement; missing stages stay unavailable. Raw PARTIAL status is retained.'};
  await writeFile('scratch/low-latency-semantic/l1/runtime-summary.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({completedRuns:runs.length,comparison}));
}
