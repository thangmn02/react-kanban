// Owned-browser diagnostic: actual loaded Companion, local media, real UI consent.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';

const root=process.cwd(),folder=resolve(root,'scratch/xo-percussion-recovery');
const manifest=JSON.parse(await readFile(resolve(folder,'manifest.json'),'utf8'));
const variants=(process.env.KORA_XO_VARIANTS||'A,B').split(','),inputs=(process.env.KORA_XO_TRANSPORT_INPUTS||'xo').split(',');
const channel=process.env.KORA_XO_BROWSER||'msedge';assert(['chrome','msedge'].includes(channel));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const result={baselineRevision:'d5b28b1',sourceSha256:manifest.sourceSha256,outputConfiguration:{mode:'experimental-buffered',bufferMs:500},
  referenceStatus:'provisional-human-reference',officialNaturalMetricsCalculated:false,physicalVerified:false,results:[],errors:[]};
const output=resolve(folder,`actual-${channel}-${inputs.join('-')}.json`);
const transports=inputs.some(input=>input!=='xo')?JSON.parse(await readFile(resolve(folder,'transport-manifest.json'),'utf8')).fixtures:[];
const save=()=>writeFile(output,JSON.stringify(result,null,2));
console.log(JSON.stringify({pid:process.pid,command:'node scripts/verify-xo-companion.mjs',ports:[5173,5174],channel,variants,inputs}));
for(const variant of variants)for(const input of inputs){
  assert(['A','B'].includes(variant));let context,app;
  const run={variant,input,records:[],flashes:[],frames:[],predictions:[],samples:[]};
  result.results.push(run);
  try{
    const fixture=manifest.fixtures.find(f=>f.id===(input==='xo'?'trap':input));assert(fixture);
    const transport=transports.find(f=>f.id===input);
    const path=input==='xo'?resolve(process.env.KORA_MUSIC_DOWNLOADS||resolve(process.env.USERPROFILE,'Downloads'),fixture.sourceFilename)
      :resolve(folder,transport.wav);
    const expectedHash=input==='xo'?fixture.sourceSha256:transport.wavSha256;
    assert.equal(hash(await readFile(path)),expectedHash,'Listening source changed');run.sourceFileSha256=expectedHash;
    run.referenceStatus=fixture.referenceStatus;
    run.analysisStart=input==='xo'?45:transport.analysisStart;
    run.analysisEnd=input==='xo'?57:transport.analysisEnd;
    const extension=resolve(folder,'candidate-'+variant,'extension');
    const profile=await mkdtemp(resolve(folder,`actual-${variant}-${input}-`));run.profile=profile;
    context=await chromium.launchPersistentContext(profile,{channel,headless:true,ignoreDefaultArgs:['--disable-extensions','--mute-audio'],
      args:['--enable-unsafe-extension-debugging','--no-first-run']});
    const cdp=await context.browser().newBrowserCDPSession();run.browser=(await cdp.send('Browser.getVersion')).product;
    const {id}=await cdp.send('Extensions.loadUnpacked',{path:extension});run.extensionId=id;
    const setup=await context.newPage();await setup.goto(`chrome-extension://${id}/setup.html`);
    run.manifest=await setup.evaluate(()=>chrome.runtime.getManifest());
    const source=await context.newPage();await source.goto('http://127.0.0.1:5174/');
    await source.locator('#file').setInputFiles(path);await source.locator('#play').click();
    app=await context.newPage();app.on('pageerror',error=>result.errors.push(error.message));
    await app.goto('http://127.0.0.1:5173/');
    await app.waitForFunction(()=>window.candidate?.selected,null,{timeout:15000});
    const target=(await cdp.send('Target.getTargets',{filter:[{type:'tab'}]})).targetInfos.find(t=>t.url==='http://127.0.0.1:5174/');
    assert(target);await source.bringToFront();await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});
    await app.waitForFunction(()=>window.candidate?.selected?.syncState?.capability?.bufferEligible,null,{timeout:35000});
    await app.getByRole('button',{name:'Pause',exact:true}).click();
    await app.waitForFunction(()=>window.candidate.selected.paused);
    assert(await source.locator('audio').evaluate((audio,start)=>audio.currentTime<start,run.analysisStart),'Calibration passed the selected passage');
    for(const name of ['I have permission to use this audio in the buffered experiment.','I heard the captured output with no echo or second playback.',
      'I accept intentional audio delay for this experiment.','Show unverified instrument predictions during buffered playback.'])
      await app.getByRole('checkbox',{name,exact:true}).check();
    await app.getByRole('button',{name:'Enable calibrated 500 ms delay',exact:true}).click();
    await app.waitForFunction(()=>window.candidate.selected.syncState.capability.mode==='experimental-buffered');
    const worker=context.serviceWorkers().find(w=>w.url().endsWith('/background.js'));assert(worker);
    const before=await worker.evaluate(()=>chrome.runtime.sendMessage({target:'beat-offscreen',kind:'diagnostics'}));
    assert.equal(before.health.bufferMs,500);run.outputBefore=before.health;
    await app.evaluate(()=>{
      window.xoFlashLog=[];window.xoOpacityLog=[];window.xoHatVisibilityLog=[];const seen=new Set();
      const observe=()=>{
        const at=Date.now(),session=window.candidate?.selected;
        const songTime=session?session.currentTime+(session.playing&&!session.paused?(at-session.sampledAt)/1000*session.playbackRate:0):null;
        let hatOpacity=0;const hatIds=[];
        for(const cell of document.querySelectorAll('.semantic-beat-flash[data-beat-trace]')){
          const style=getComputedStyle(cell),rect=cell.getBoundingClientRect(),id=cell.dataset.beatTrace;
          if(Number(style.opacity)>=.5&&rect.width>0&&rect.top>=0&&rect.bottom<=innerHeight&&rect.left>=0&&rect.right<=innerWidth){
            if(!seen.has(id)){seen.add(id);window.xoFlashLog.push({id,at,targetPlaybackTime:Number(cell.dataset.targetPlaybackTime),visibleSongTime:songTime,row:cell.closest('[data-track]')?.dataset.track,opacity:Number(style.opacity)});}
            if(cell.closest('[data-track]')?.dataset.track==='Hi-hat / Cymbal'){
              window.xoOpacityLog.push({id,at,songTime,opacity:Number(style.opacity)});
              hatOpacity=Math.max(hatOpacity,Number(style.opacity));hatIds.push(id);
            }
          }
        }
        if(window.xoOpacityLog.length>6000)window.xoOpacityLog.splice(0,window.xoOpacityLog.length-6000);
        window.xoHatVisibilityLog.push({at,songTime,opacity:hatOpacity,ids:hatIds});
        if(window.xoHatVisibilityLog.length>6000)window.xoHatVisibilityLog.shift();
        requestAnimationFrame(observe);
      };requestAnimationFrame(observe);
    });
    await app.bringToFront();await app.getByRole('button',{name:'Play',exact:true}).click();
    await app.locator('.candidate-grid').scrollIntoViewIfNeeded();
    const processInfo=await cdp.send('SystemInfo.getProcessInfo');
    const cpuAt=processInfo.processInfo.reduce((sum,item)=>sum+item.cpuTime,0),wallAt=Date.now();
    const records=new Map();let clock;
    while(Date.now()-wallAt<100000){
      const observed=await app.evaluate(()=>({session:window.candidate.selected,beat:window.candidate.beat,records:window.candidate.telemetry.records}));
      clock=observed.session;
      if(clock.currentTime>=run.analysisStart-3){
        const offscreen=await worker.evaluate(()=>chrome.runtime.sendMessage({target:'beat-offscreen',kind:'diagnostics'}));
        for(const entry of [...observed.records,...(offscreen.telemetry?.records||[])]){
          const key=JSON.stringify(entry);records.set(key,entry);
        }
        run.samples.push({at:Date.now(),clock:{currentTime:clock.currentTime,sampledAt:clock.sampledAt,playing:clock.playing},
          mode:clock.syncState?.capability?.mode,bufferMs:offscreen.health?.bufferMs,onsets:observed.beat.onsets});
      }
      if(clock.currentTime>=run.analysisEnd+1)break;
      await new Promise(done=>setTimeout(done,250));
    }
    assert(clock.currentTime>=run.analysisEnd+1,'Playback did not reach the end of the selected passage');
    const diagnostic=await worker.evaluate(()=>chrome.runtime.sendMessage({target:'beat-offscreen',kind:'percussion-diagnostics'}));
    assert(diagnostic.frames?.length,'Packaged classifier diagnostics unavailable');
    run.classifier=diagnostic.classifier;
    assert.equal(run.classifier,variant==='B'?'local-prominence':'onset-guided','Wrong packaged classifier');
    run.frames=diagnostic.frames;run.predictions=diagnostic.predictions;run.evictedWarmupFrames=diagnostic.evictedFrames;
    run.clockAtSnapshot=clock;run.records=[...records.values()];
    Object.assign(run,await app.evaluate(()=>({flashes:window.xoFlashLog,opacitySamples:window.xoOpacityLog,hatVisibilitySamples:window.xoHatVisibilityLog})));
    const targets=new Map(run.records.filter(r=>Number.isFinite(r.targetPlaybackTime)).map(r=>[r.id,r.targetPlaybackTime]));
    run.passageFlashes=run.flashes.filter(f=>targets.get(f.id)>=run.analysisStart&&targets.get(f.id)<run.analysisEnd);
    assert(run.passageFlashes.some(f=>['Kick','Snare / Clap','Hi-hat / Cymbal'].includes(f.row)), 'No visible percussion flash in the selected passage');
    const processes=(await cdp.send('SystemInfo.getProcessInfo')).processInfo;
    run.cpu={seconds:processes.reduce((sum,item)=>sum+item.cpuTime,0)-cpuAt,wallSeconds:(Date.now()-wallAt)/1000};
    run.cpu.percentOfOneLogicalCore=run.cpu.seconds/run.cpu.wallSeconds*100;
    run.finalMode=clock.syncState.capability;assert.equal(run.finalMode.allowTypedPreview,true);assert.equal(run.finalMode.bufferMs,500);
    assert.equal(run.finalMode.detectorVersion,'xo-'+variant,'Wrong packaged detector version');
    assert(run.samples.every(s=>s.bufferMs===500&&s.mode==='experimental-buffered'),'Output or typed mode changed during the selected passage');
    await app.screenshot({path:resolve(folder,`actual-${channel}-${variant}-${input}.png`)});
    await source.locator('audio').evaluate(audio=>audio.pause());
    run.finishedAt=new Date().toISOString();await save();
    console.log(JSON.stringify({variant,input,frames:run.frames.length,predictions:run.predictions.length,flashes:run.flashes.length,cpu:run.cpu}));
  }catch(error){run.error=error.message;result.errors.push(`${variant}/${input}: ${error.message}`);
    if(app)run.failure=await app.evaluate(()=>({candidate:window.candidate,activation:[...document.querySelectorAll('[role=status]')].map(e=>e.textContent)})).catch(()=>null);
    await save();throw error;
  }finally{await context?.close();}
}
await save();
