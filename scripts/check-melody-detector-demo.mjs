import { chromium } from '@playwright/test';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory='src-tauri/target/melody-detector-demo';
const preservation=JSON.parse(await readFile(`${directory}/preservation.json`,'utf8'));
for(const [path,hash] of Object.entries(preservation.before)) {
  if(createHash('sha256').update(await readFile(path)).digest('hex')!==hash)throw new Error('Protected baseline changed: '+path);
}
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try {
  const page=await browser.newPage({viewport:{width:1100,height:1050},acceptDownloads:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Component integration harness only; do not forge a signed-in user or alter auth.
  await page.goto('http://127.0.0.1:5173/beat-grid?musicDebug=1');
  const initialRoutePath=new URL(page.url()).pathname;
  await page.evaluate(async()=>{
    const reactModule=await import('/node_modules/.vite/deps/react.js');
    const React=reactModule.default??reactModule;
    const domModule=await import('/node_modules/.vite/deps/react-dom_client.js');
    const createRoot=domModule.createRoot??domModule.default?.createRoot;
    const {MusicGrid}=await import('/src/features/music/MusicPlayer.tsx');
    await import('/src/components/focus/floatingFocus.css');
    history.replaceState(null,'','/beat-grid?musicDebug=1');
    document.getElementById('root').style.display='none';
    const mount=document.createElement('div');mount.id='component-integration-check';mount.style.cssText='max-width:1000px;margin:20px auto;padding:20px';document.body.append(mount);
    createRoot(mount).render(React.createElement(MusicGrid,{music:{source:'none',sessions:[],selected:undefined,
      beat:{sessionId:'',mode:'clock',onsets:{}}}}));
  });
  await page.getByRole('button',{name:'Use saved Melody demo',exact:true}).click();
  await page.getByLabel('Melody demo input').selectOption('gymnopedie-stem');
  await page.waitForFunction(()=>document.querySelector('audio')?.readyState>=3);
  const audio=page.getByLabel('Demo original playback clock');
  if(await audio.count()!==1)throw new Error('Duplicate audio clock');
  const summaries=await page.evaluate(async()=>{
    const {compareMelodyDetectors}=await import('/src/features/music/diagnostics/melody-detector-fusion.ts');
    const data=await (await fetch('/src-tauri/target/melody-detector-demo/fixtures.json')).json();
    return data.fixtures.map(f=>{const c=compareMelodyDetectors(f);
      if(c.baseline.some((n,i)=>n.start!==f.baseline[i].start||n.end!==f.baseline[i].end||n.pitch!==f.baseline[i].pitch))throw new Error('Baseline mutated');
      if(c.fusion.some((n,i)=>i&&n.start<c.fusion[i-1].end-1e-7))throw new Error('Polyphonic fusion');
      return {id:f.id,baseline:c.baseline.length,rawBP:f.basicPitch.length,basicPitch:c.basicPitch.length,added:c.added.length,fusion:c.fusion.length};});
  });
  await audio.evaluate(a=>{a.currentTime=2;});
  for(const mode of ['basic-pitch','fusion','ab','baseline']) {
    await page.getByLabel('Row 5 Melody detector').selectOption(mode);
    await page.waitForFunction(()=>document.querySelectorAll('.beat-square').length===(document.querySelector('[aria-label="Row 5 Melody detector"]').value==='ab'?80:40));
    if(Math.abs(await audio.evaluate(a=>a.currentTime)-2)>.001)throw new Error('Mode moved playback position');
  }
  await audio.evaluate(a=>a.play());
  const time=await audio.evaluate(a=>a.currentTime);
  await page.getByLabel('Row 5 Melody detector').selectOption('ab');
  if((await audio.evaluate(a=>a.currentTime))<time || await audio.evaluate(a=>a.paused))throw new Error('Mode stopped active playback');
  await audio.evaluate(a=>a.pause());
  const epochs=[];
  for(const mode of ['baseline','fusion','baseline']) {
    await page.getByLabel('Row 5 Melody detector').selectOption(mode);
    await audio.evaluate(a=>{a.currentTime=1.7;});
    await page.waitForFunction(()=>!document.querySelector('audio').seeking);
    await audio.evaluate(a=>a.play());
    await page.waitForFunction(()=>document.querySelector('[data-event-id]'));
    epochs.push(await page.locator('[data-event-id]').first().getAttribute('data-event-id'));
    await audio.evaluate(a=>a.pause());
  }
  if(new Set(epochs).size!==epochs.length)throw new Error('Detector remount reused an event identity');
  await page.getByLabel('Row 5 Melody detector').selectOption('ab');
  const traces=[];
  for(const id of ['gymnopedie-stem','lee_hi_hskt-stem','nujabes-mix']) {
    await page.getByLabel('Melody demo input').selectOption(id);
    await page.waitForFunction(()=>document.querySelector('audio').readyState>=3&&!document.querySelector('audio').seeking);
    const fixture=await page.evaluate(async id=>(await (await fetch('/src-tauri/target/melody-detector-demo/fixtures.json')).json()).fixtures.find(f=>f.id===id),id);
    await audio.evaluate((a,start)=>{a.currentTime=start;},fixture.start);
    await page.waitForFunction(()=>!document.querySelector('audio').seeking);
    await page.getByRole('button',{name:'Record 30 seconds',exact:true}).click();
    await page.waitForTimeout(1600);
    await page.getByRole('button',{name:'Missed note',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('audio').paused,undefined,{timeout:40000});
    const downloaded=page.waitForEvent('download');
    await page.getByRole('button',{name:'Export row trace',exact:true}).click();
    const file=await downloaded;await file.saveAs(`${directory}/${id}-ab-trace.json`);
    const trace=JSON.parse(await readFile(`${directory}/${id}-ab-trace.json`,'utf8'));
    if(!trace.markers.length||!trace.flashes.length)throw new Error('No markers/render trace');
    if(trace.flashes.some(e=>e.row!==5||!e.experimental||e.verified!==false||!e.selectedSource||!Number.isFinite(e.midiPitch)))throw new Error('Incorrect semantic identity/provenance');
    const commits=trace.flashes.filter(e=>e.stage==='commit'),baseline=commits.filter(e=>e.lane==='baseline'),fusion=commits.filter(e=>e.lane==='fusion');
    const expectedFusion=summaries.find(f=>f.id===id).fusion;
    if(baseline.length!==fixture.baseline.length||fusion.length!==expectedFusion)throw new Error('Incomplete full-passage render: '+id);
    if(new Set(commits.map(e=>e.eventId)).size!==commits.length)throw new Error('Duplicate semantic commits');
    const delays=commits.filter(e=>Number.isFinite(e.actualPlaybackTime)).map(e=>(e.actualPlaybackTime-e.targetPlaybackTime)*1000).sort((a,b)=>a-b);
    traces.push({id,baseline:baseline.length,fusion:fusion.length,expectedBaseline:fixture.baseline.length,
      medianCommitDelayMs:delays[Math.floor(delays.length*.5)],p95CommitDelayMs:delays[Math.floor(delays.length*.95)],
      animations:trace.flashes.filter(e=>e.stage==='animation').length});
    console.log(JSON.stringify(traces.at(-1)));
  }
  await page.getByLabel('Melody demo input').selectOption('gymnopedie-stem');
  await page.waitForFunction(()=>document.querySelector('audio').readyState>=3&&!document.querySelector('audio').seeking);
  await audio.evaluate(a=>{a.currentTime=5.5;});
  await page.waitForFunction(()=>!document.querySelector('audio').seeking);
  await page.getByRole('button',{name:'Replay passage',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('audio').currentTime<1&&!document.querySelector('audio').paused);
  await audio.evaluate(a=>a.pause());
  const compact=await page.evaluate(()=>{
    const mount=document.getElementById('component-integration-check');
    mount.style.width='420px';mount.style.height='460px';
    const panel=mount.firstElementChild;
    return {width:panel.clientWidth,scrollWidth:panel.scrollWidth,height:panel.clientHeight,scrollHeight:panel.scrollHeight};
  });
  if(compact.scrollWidth>compact.width+2||compact.scrollHeight<=compact.height)throw new Error('Compact demo controls overflow or cannot scroll');
  await page.screenshot({path:`${directory}/demo-grid.png`,fullPage:true});
  await page.getByRole('button',{name:'Return to live Beat Grid',exact:true}).click();
  if(await page.locator('audio').count()!==0||await page.locator('.beat-square').count()!==40)throw new Error('Demo did not release its player/grid');
  if(errors.length)throw new Error(errors.join('\n'));
  const result={errors,initialRoutePath,scope:'Existing MusicGrid component in an isolated browser; no auth/session bypass or signed-in shell verification.',
    summaries,traces,compact,protectedHashes:Object.keys(preservation.before).length,
    checks:['four modes','one authoritative audio element','mode switch retains paused/playing position','same-source timestamps',
      'original baseline unchanged','fusion monophonic','pause/resume/replay/seek','unique event identities after detector remount','two existing 5x8 renderers in A/B',
      'row 5 only','actual DOM commits and animation provenance','human markers/export','return to live cleanup']};
  await writeFile(`${directory}/browser-check.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
