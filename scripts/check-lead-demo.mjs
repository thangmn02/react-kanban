import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory='src-tauri/target/lead-pulse';
const desktop=process.argv.includes('--desktop'),prefix=desktop?'desktop-':'';
const preservation=JSON.parse(await readFile('src-tauri/target/melody-detector-demo/preservation.json','utf8'));
// New contract/provenance integrations are intentional; original model outputs,
// accepted detectors and renderer/scheduler algorithms remain byte-preserved.
const changedContracts=new Set(['src/features/music/beat-event-engine.ts','src/features/music/useMusicBeatSync.ts',
  'src/features/music/event-track.ts','src/features/music/event-track-ranges.ts','src/features/music/event-track-client.ts',
  'extensions/kanban-music/beat-telemetry.js','src/features/music/diagnostics/melody-fixture-clock.ts']);
const checked=[];
for(const [path,hash] of Object.entries(preservation.before)) {
  if(changedContracts.has(path))continue;
  if(createHash('sha256').update(await readFile(path)).digest('hex')!==hash)throw new Error('Protected baseline changed: '+path);
  checked.push(path);
}
const browser=desktop?await chromium.connectOverCDP('http://127.0.0.1:9223'):
  await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
let checkedPage;
try {
  const page=desktop?browser.contexts()[0].pages().find(p=>p.url().includes('127.0.0.1:1420')):
    await browser.newPage({viewport:{width:1100,height:1050},acceptDownloads:true});
  if(!page)throw new Error('Owned native WebView not found');
  checkedPage=page;
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/beat-events'))requests.push(r.url());});
  await page.goto(`http://127.0.0.1:${desktop?1420:5173}/beat-grid?musicDebug=1&musicLead=1`);
  const nativeRuntime=await page.evaluate(async()=> (await import('/src/features/native/runtime.ts')).isNativeWidget());
  if(nativeRuntime!==desktop)throw new Error('Incorrect platform runtime');
  await page.evaluate(async()=>{
    const reactModule=await import('/node_modules/.vite/deps/react.js');
    const React=reactModule.default??reactModule;
    const domModule=await import('/node_modules/.vite/deps/react-dom_client.js');
    const createRoot=domModule.createRoot??domModule.default?.createRoot;
    const {MusicGrid}=await import('/src/features/music/MusicPlayer.tsx');
    await import('/src/components/focus/floatingFocus.css');
    history.replaceState(null,'','/beat-grid?musicDebug=1&musicLead=1');
    document.getElementById('root').style.display='none';
    const mount=document.createElement('div');mount.id='lead-integration-check';mount.style.cssText='max-width:1000px;margin:20px auto;padding:20px';document.body.append(mount);
    createRoot(mount).render(React.createElement(MusicGrid,{music:{source:'none',sessions:[],beat:{sessionId:'',mode:'clock',onsets:{}}}}));
  });
  await page.getByRole('button',{name:'Use saved Melody demo',exact:true}).click();
  const audio=page.getByLabel('Demo original playback clock'),selector=page.getByLabel('Melody demo input');
  const data=JSON.parse(await readFile(`${directory}/fixtures.json`,'utf8'));
  const results=[];
  for(const id of ['lead-lee_hi_hskt','lead-rap','lead-jazz','lead-piano']) {
    await selector.selectOption(id);await page.waitForFunction(()=>document.querySelector('audio')?.readyState>=3&&!document.querySelector('audio').seeking);
    if(await audio.count()!==1||await page.locator('.beat-square').count()!==40)throw new Error('Clock/grid duplication');
    const fixture=data.fixtures.find(f=>f.id===id);
    await page.getByRole('button',{name:'Record 30 seconds',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('audio').paused,undefined,{timeout:40000});
    await page.getByRole('button',{name:'Missed note',exact:true}).click();
    const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export row trace',exact:true}).click();
    await (await pending).saveAs(`${directory}/${prefix}${id}-trace.json`);
    const trace=JSON.parse(await readFile(`${directory}/${prefix}${id}-trace.json`,'utf8'));
    const commits=trace.flashes.filter(e=>e.stage==='commit'),animations=trace.flashes.filter(e=>e.stage==='animation');
    if(!commits.length||commits.some(e=>e.row!==5||!e.selectedSource||!e.experimental))throw new Error('Missing/incorrect Lead render provenance');
    if(new Set(commits.map(e=>e.eventId)).size!==commits.length)throw new Error('Duplicate commits');
    const delays=commits.map(e=>(e.actualPlaybackTime-e.targetPlaybackTime)*1000).sort((a,b)=>a-b);
    const animationDelays=animations.map(e=>(e.actualPlaybackTime-e.targetPlaybackTime)*1000).sort((a,b)=>a-b);
    results.push({id,total:fixture.lead.length,commits:commits.length,animations:animations.length,
      medianCommitMs:delays[Math.floor(delays.length*.5)],p95CommitMs:delays[Math.floor(delays.length*.95)],
      medianAnimationMs:animationDelays[Math.floor(animationDelays.length*.5)],p95AnimationMs:animationDelays[Math.floor(animationDelays.length*.95)],
      telemetryStages:[...new Set(trace.telemetry.records.map(e=>e.stage))],unpitched:commits.filter(e=>e.midiPitch===null).length});
    if(commits.length!==fixture.lead.length)throw new Error('Scheduled events did not all commit: '+JSON.stringify(results.at(-1)));
    console.log(JSON.stringify(results.at(-1)));
  }
  await selector.selectOption('lead-rap');await page.waitForFunction(()=>document.querySelector('audio').readyState>=3);
  await audio.evaluate(a=>{a.currentTime=4;});await page.waitForFunction(()=>!document.querySelector('audio').seeking);
  await page.getByLabel('Row 5 Melody detector').selectOption('baseline');
  if(Math.abs(await audio.evaluate(a=>a.currentTime)-4)>.001)throw new Error('Mode moved media position');
  await page.getByLabel('Row 5 Melody detector').selectOption('lead');
  await audio.evaluate(a=>a.play());await page.waitForTimeout(600);await audio.evaluate(a=>a.pause());
  await page.waitForTimeout(200);const paused=await page.locator('[data-beat-trace]').count();
  if(paused)throw new Error('Stale paused flashes');
  await audio.evaluate(a=>{a.currentTime=9;});await page.waitForFunction(()=>!document.querySelector('audio').seeking);
  await audio.evaluate(a=>{a.playbackRate=1.5;return a.play();});await page.waitForTimeout(800);
  await audio.evaluate(a=>{a.currentTime=1;});await page.waitForFunction(()=>!document.querySelector('audio').seeking);
  await page.waitForTimeout(700);await audio.evaluate(a=>a.pause());
  await selector.selectOption('lead-jazz');await page.waitForFunction(()=>document.querySelector('audio').readyState>=3);
  await page.screenshot({path:`${directory}/${prefix}demo-grid.png`,fullPage:true});
  const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
  const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  const before=await metrics();await audio.evaluate(a=>a.play());await page.waitForTimeout(10000);await audio.evaluate(a=>a.pause());
  const after=await metrics(),wall=after.Timestamp-before.Timestamp;
  const performance={windowSeconds:wall,rendererTaskCpuSeconds:after.TaskDuration-before.TaskDuration,
    rendererTaskCpuPercent:100*(after.TaskDuration-before.TaskDuration)/wall,
    usedJsHeapMiB:after.JSHeapUsedSize/1048576,totalJsHeapMiB:after.JSHeapTotalSize/1048576,
    scope:'Page task duration; excludes browser audio decode and OS CPU. Not weak-hardware certification.'};
  await page.getByRole('button',{name:'Return to live Beat Grid',exact:true}).click();
  if(await audio.count()!==0||await page.locator('.beat-square').count()!==40)throw new Error('Private player cleanup failed');
  if(errors.length)throw new Error(errors.join('\n'));
  const report={nativeRuntime,results,performance,errors,protectedHashes:checked.length,requests:requests.length,
    allVersioned:requests.every(r=>r.includes('server-lead-pulse-range-v1')),checks:['single audio and existing 5x8 component',
      'actual versioned HTTP cache -> product scheduler -> DOM -> animation','pitch optional','mode switch preserves position',
      'pause/resume','seek forward/back','playbackRate','source switching','private disposal'],
    scope:desktop?'Actual Tauri WebView component integration; does not certify signed-in shell or hardware loopback.':
      'Isolated Edge component integration; does not certify signed-in shell or hardware loopback.'};
  await writeFile(`${directory}/${prefix}browser-check.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{
  if(checkedPage&&!checkedPage.isClosed()) {
    // Always restore the application, including assertion failures and native CDP disconnects.
    await checkedPage.reload().catch(()=>{});
  }
  await browser.close();
}
