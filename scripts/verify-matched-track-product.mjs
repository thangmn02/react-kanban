// Replay saved, exact H0 events through actual Kora UI/controller/renderer.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const root=process.argv[2]||'scratch/matched-track-quality-gap',sourceId='df2173a39346b36c188e086d4d5c301c5356832267c048e3e2d39917042da108';
await mkdir(root,{recursive:true});
const receipt={sourceId,checks:[],runs:[],errors:[],physicalSynchronization:'UNVERIFIED'};
let browser,page;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 page=await browser.newPage({viewport:{width:1280,height:1100},acceptDownloads:true});
 page.on('pageerror',error=>receipt.errors.push(error.message));
 await page.addInitScript(()=>{
  const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.matchedAudio=this;return play.call(this);};
  window.rowFrameSamples=[];
 });
 await page.goto('http://127.0.0.1:1420/music?musicDebug=1');
 await page.getByRole('checkbox',{name:'Beat Grid Hybrid — Beta',exact:true}).check();
 await page.getByLabel('Beta local recording',{exact:true}).selectOption(sourceId);
 await page.getByRole('button',{name:'Play music',exact:true}).waitFor();
 await page.getByRole('button',{name:'Play music',exact:true}).click();await page.getByRole('button',{name:'Pause music',exact:true}).click();
 const audio=()=>page.evaluate(()=>({src:window.matchedAudio.currentSrc,time:window.matchedAudio.currentTime,rate:window.matchedAudio.playbackRate}));
 for(const envelope of (process.argv.includes('--probe-smoke')?['short']:['short','original'])){
  await page.getByRole('tab',{name:'Beat grid',exact:true}).click();
  await page.getByText('Local recording and visual envelope',{exact:true}).click();
  await page.getByLabel('Beta visual envelope',{exact:true}).selectOption(envelope);
  await page.getByText('Local recording and visual envelope',{exact:true}).click();
  await page.getByRole('tab',{name:'Music',exact:true}).click();
  const seek=page.getByRole('slider',{name:'Seek music',exact:true});await seek.fill('18');await seek.press('ArrowRight');
  await page.getByRole('tab',{name:'Beat grid',exact:true}).click();
  await page.getByRole('button',{name:'Record 30 seconds',exact:true}).click();
  await page.evaluate(()=>{window.rowFrameSamples=[];});
  await page.getByRole('tab',{name:'Music',exact:true}).click();
  await page.getByRole('button',{name:'Play music',exact:true}).click();
  await page.getByRole('tab',{name:'Beat grid',exact:true}).click();
  await page.locator('.music-pattern').scrollIntoViewIfNeeded();
  await page.locator('.music-pattern').evaluate(root=>{
    window.matchedProbeRunning=true;
    window.matchedProbeTicks=[];
    const observe=()=>{
      if(!window.matchedProbeRunning)return;
      if(window.matchedProbeTicks.length<500)window.matchedProbeTicks.push({root:root.isConnected,audio:!!window.matchedAudio,paused:window.matchedAudio?.paused,time:window.matchedAudio?.currentTime});
      if(root&&window.matchedAudio&&!window.matchedAudio.paused){
        const ids=[];
        for(const node of root.querySelectorAll('[data-semantic="true"][data-beat-trace]')){
          const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
          if(rect.width>0&&rect.top>=0&&rect.bottom<=innerHeight&&style.display!=='none'&&Number(style.opacity)>=.5)ids.push(node.dataset.beatTrace);
        }
        window.rowFrameSamples.push({at:Date.now(),sourceTime:window.matchedAudio.currentTime,visibleTraceIds:[...new Set(ids)]});
      }
      requestAnimationFrame(observe);
    };requestAnimationFrame(observe);
  });
  await page.waitForFunction(t=>window.matchedAudio.currentTime>=t,process.argv.includes('--probe-smoke')?23:50.3,{timeout:40000});
  const clock=await audio();
  const completeTelemetry=await page.evaluate(()=>window.__koraBeatTelemetry.snapshot());
  await page.evaluate(()=>{window.matchedProbeRunning=false;});
  await page.getByRole('tab',{name:'Music',exact:true}).click();await page.getByRole('button',{name:'Pause music',exact:true}).click();
  await page.getByRole('tab',{name:'Beat grid',exact:true}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export row trace',exact:true}).click();
  const trace=JSON.parse(await readFile(await(await download).path(),'utf8'));
  const frameSamples=await page.evaluate(()=>window.rowFrameSamples);
  const samplerHealth=await page.evaluate(()=>window.matchedProbeTicks);
  await writeFile(root+'/product-h0-'+envelope+'.json',JSON.stringify({trace,completeTelemetry,frameSamples,samplerHealth,clock},null,2));
  assert(clock.src.includes(sourceId));assert.equal(clock.rate,1);
  receipt.runs.push({envelope,clock,samples:frameSamples.length,scope:'Actual Kora production controller with existing H0 visual envelope. Computed DOM/viewport/opacity observations are not physical pixels or human-perceptual separation.'});
 }
 await page.screenshot({path:root+'/product-h0.png'});receipt.status=receipt.errors.length||receipt.runs.some(r=>!r.samples)?'PARTIAL':'PASS';
}catch(error){receipt.status='FAIL';receipt.errors.push(error.stack);process.exitCode=1;await page?.screenshot({path:root+'/product-h0-failure.png'}).catch(()=>{});}
finally{await browser?.close();await writeFile(root+'/product-replay-receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));}
