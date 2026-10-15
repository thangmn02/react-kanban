import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createServer} from 'node:http';
import {build} from 'vite';
import {chromium} from '@playwright/test';
import {createHash} from 'node:crypto';
import {verifyPlatformLivePreview} from './verify-platform-live-preview.mjs';
const root=process.cwd(),folder=resolve(root,'scratch/browser-first-candidate'),built=resolve(folder,'listening');
const channel=process.env.KORA_CANDIDATE_BROWSER||'chrome';
assert(['chrome','msedge'].includes(channel));
const duration=Number(process.env.KORA_CANDIDATE_SECONDS||90),serve=process.argv.includes('--serve');
const reuseServer=process.env.KORA_CANDIDATE_REUSE_SERVER==='1';
const lifecycle=process.env.KORA_CANDIDATE_LIFECYCLE==='1';
const music=process.env.KORA_CANDIDATE_MUSIC==='1';
const review=process.env.KORA_CANDIDATE_REVIEW==='1';
const live=process.env.KORA_CANDIDATE_LIVE==='1';
assert(Number.isFinite(duration)&&duration>=0&&duration<=1900);
await mkdir(folder,{recursive:true});
await writeFile(resolve(folder,'index.html'),'<html><head><meta charset="utf-8"><title>Private Beat Grid</title></head><body style="margin:0"><div id="root"></div><script type="module" src="../../scripts/browser-beat-candidate.tsx"></script></body></html>');
if(!reuseServer)await build({root:folder,configFile:false,logLevel:'error',build:{outDir:built,emptyOutDir:true,minify:false}});
const source=await readFile(resolve(root,'scratch/browser-first-corpus/spaced-dev.wav'));
const audioData=source.subarray(44),audioBytes=44100*4*1900,header=Buffer.from(source.subarray(0,44));
header.writeUInt32LE(audioBytes+36,4);header.writeUInt32LE(audioBytes,40);
const servers=[];
for(const port of reuseServer?[]:[5173,5174]) {
  const server=createServer(async(request,response)=>{
    try {
      const path=new URL(request.url,`http://127.0.0.1:${port}`).pathname;
      if(port===5174&&path==='/') {
        response.setHeader('Content-Type','text/html');response.end(`<!doctype html><meta charset="utf-8"><title>Authorized audio-only review</title>
          <h1>Private audio-only review</h1><p>Generated percussion is CC0. You may also choose authorized local audio; the file stays in this browser.</p>
          <label>Choose local audio <input type="file" accept="audio/*" id="file"></label><br>
          <audio controls src="/endurance.wav"></audio><button id="play">Play generated audio</button>
          <script>const audio=document.querySelector('audio');let previous;
          document.querySelector('#play').onclick=()=>audio.play();
          document.querySelector('#file').onchange=event=>{const file=event.target.files[0];if(!file)return;
            audio.pause();if(previous)URL.revokeObjectURL(previous);previous=URL.createObjectURL(file);audio.src=previous;
            document.querySelector('#play').textContent='Play selected audio';};</script>`);return;
      }
      if(port===5174&&path==='/endurance.wav') {
        const total=44+audioBytes,range=/bytes=(\d+)-(\d*)/.exec(request.headers.range||'');
        let start=range?Number(range[1]):0;const end=range&&range[2]?Math.min(total-1,Number(range[2])):total-1;
        response.writeHead(range?206:200,{'Content-Type':'audio/wav','Accept-Ranges':'bytes','Content-Length':end-start+1,
          ...(range?{'Content-Range':`bytes ${start}-${end}/${total}`}:{})});
        const send=()=>{while(start<=end&&!response.destroyed) {
          const bytes=start<44?header.subarray(start,Math.min(44,end+1))
            :audioData.subarray((start-44)%audioData.length,Math.min(audioData.length,(start-44)%audioData.length+Math.min(65536,end-start+1)));
          start+=bytes.length;if(!response.write(bytes)){response.once('drain',send);return;}
        }if(!response.destroyed)response.end();};send();return;
      }
      if(port!==5173)throw Error('Unknown source');
      const file=resolve(built,'.'+(path==='/'?'/index.html':decodeURIComponent(path)));
      if(!file.startsWith(built+sep))throw Error('Outside private build');
      response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(file)]||'application/octet-stream');
      response.end(await readFile(file));
    }catch{response.writeHead(404);response.end();}
  });
  await new Promise((done,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',done);});servers.push(server);
}
console.log(JSON.stringify({pid:process.pid,ports:[5173,5174],command:'node scripts/verify-private-companion.mjs',channel,serve}));
let context,app;
let interrupted=false;
process.once('SIGINT',()=>{interrupted=true;});process.once('SIGTERM',()=>{interrupted=true;});
const result={channel,startedAt:new Date().toISOString(),physicalVerified:false,listeningAccepted:false,steps:[],samples:[],errors:[]};
const save=()=>writeFile(resolve(folder,`real-${channel}${live?'-live-preview':review?'-review':lifecycle?'-lifecycle':music?'-music':''}.json`),JSON.stringify(result,null,2));
try {
  if(serve)await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
  else {
    const profile=await mkdtemp(resolve(folder,`real-${channel}-`));
    context=await chromium.launchPersistentContext(profile,{channel,headless:true,
      ignoreDefaultArgs:['--disable-extensions','--mute-audio'],args:['--enable-unsafe-extension-debugging','--no-first-run']});
    const cdp=await context.browser().newBrowserCDPSession();
    result.browser=(await cdp.send('Browser.getVersion')).product;
    for(const extension of (await cdp.send('Extensions.getExtensions')).extensions)
      if(extension.path===resolve(folder,'extension'))await cdp.send('Extensions.uninstall',{id:extension.id});
    const {id}=await cdp.send('Extensions.loadUnpacked',{path:resolve(folder,'extension')});result.extensionId=id;
    const setup=await context.newPage();await setup.goto(`chrome-extension://${id}/setup.html`);
    result.manifest=await setup.evaluate(()=>{const m=chrome.runtime.getManifest();return {id:chrome.runtime.id,version:m.version,versionName:m.version_name};});
    const sourcePage=await context.newPage();await sourcePage.goto('http://127.0.0.1:5174');await sourcePage.getByRole('button',{name:'Play generated audio'}).click();
    app=await context.newPage();app.on('pageerror',error=>result.errors.push(error.message.slice(0,200)));
    await app.goto('http://127.0.0.1:5173');
    await app.waitForFunction(()=>window.candidate?.selected,{timeout:15000});
    await app.waitForFunction(()=>window.candidate?.selected?.syncState?.reason==='capture-permission'||window.candidate?.selected?.syncState?.mode==='capture');
    if(review) {
      assert.match(await app.getByRole('region',{name:'Capture and preview status'}).innerText(),/Capture is not enabled/);
      await app.evaluate(()=>{
        window.privateVisualCheck={semantic:0,decorative:0};
        document.addEventListener('animationstart',event=>{
          const cell=event.target;
          const visible=()=>{const style=getComputedStyle(cell),rect=cell.getBoundingClientRect();
            return cell.isConnected&&style.display!=='none'&&style.visibility==='visible'&&Number(style.opacity)>.1
              &&rect.width>0&&rect.height>0&&rect.top>=0&&rect.bottom<=innerHeight&&rect.left>=0&&rect.right<=innerWidth;};
          if(cell.classList.contains('semantic-beat-flash')&&visible()) {
            const style=getComputedStyle(cell),rect=cell.getBoundingClientRect();
            window.privateVisualCheck.semantic++;
            window.privateVisualCheck.semanticStyle={background:style.backgroundColor,width:rect.width,height:rect.height};
          }
          if(cell.classList.contains('decorative-tempo-pulse')) {
            const started=performance.now();
            const inspect=()=>{
              if(visible())window.privateVisualCheck.decorative++;
              else if(cell.isConnected&&performance.now()-started<220)requestAnimationFrame(inspect);
            };requestAnimationFrame(inspect);
          }
        });
      });
      await app.waitForFunction(()=>window.candidate.beat.tickCount>1);
      assert.equal(await app.evaluate(()=>window.privateVisualCheck.decorative),0);
      assert.equal(await app.evaluate(()=>window.privateVisualCheck.semantic),0);
      result.reviewBeforeCapture=await app.getByRole('region',{name:'Capture and preview status'}).innerText();
      await app.screenshot({path:resolve(folder,`review-${channel}-before.png`)});
    }
    const targets=await cdp.send('Target.getTargets',{filter:[{type:'tab'}]});
    const targetId=targets.targetInfos.find(target=>target.url==='http://127.0.0.1:5174/')?.targetId;
    assert(targetId,'Source tab target unavailable');
    await sourcePage.bringToFront();
    await cdp.send('Extensions.triggerAction',{id,targetId});
    await app.waitForFunction(()=>window.candidate?.selected?.syncState?.mode==='capture',{timeout:20000});
    if(review) {
      await app.bringToFront();await app.locator('.candidate-grid').scrollIntoViewIfNeeded();
      await app.waitForFunction(()=>window.privateVisualCheck.decorative>1);
      assert.equal(await app.evaluate(()=>window.privateVisualCheck.semantic),0);
    }
    result.steps.push({stage:'actual-tab-capture',at:new Date().toISOString(),status:await app.evaluate(()=>window.candidate.selected.syncState)});await save();
    const worker=context.serviceWorkers().find(worker=>worker.url().endsWith('/background.js'));
    result.captureStatus=await worker.evaluate(async()=> (await chrome.tabCapture.getCapturedTabs()).map(({status})=>({status})));
    await save();
    if(live)await verifyPlatformLivePreview({context,cdp,app,sourcePage,extensionId:id,worker,folder,result,save});
    else {
    await app.waitForFunction(()=>window.candidate?.selected?.syncState?.capability?.bufferEligible,{timeout:60000});
    if(review) {
      assert.match(await app.getByRole('region',{name:'Capture and preview status'}).innerText(),/Instrument preview is off/);
      assert(await app.getByLabel('Private Beat Grid candidate',{exact:true}).evaluate(details=>details.open));
      assert.equal(await app.evaluate(()=>window.privateVisualCheck.semantic),0);
    }
    // Automation opts into a generated CC0 signal to exercise routing only.
    // This does not certify human hearing, listening acceptance or speaker timing.
    if(review) {
      for(const name of ['I have permission to use this audio in the buffered experiment.','I heard the captured output with no echo or second playback.',
        'I accept intentional audio delay for this experiment.','Show unverified instrument predictions during buffered playback.'])
        await app.getByRole('checkbox',{name,exact:true}).check();
      assert(await app.getByRole('button',{name:/Enable calibrated/}).isDisabled());
      assert.match(await app.getByRole('status',{name:'Delay activation status'}).innerText(),/Pause the selected source/);
      await app.getByRole('button',{name:'Pause',exact:true}).click();
      await app.waitForFunction(()=>window.candidate.selected.paused&&window.candidate.selected.syncState?.captureId,null,{timeout:10000});
      // Cover multiple six-second capture leases while a person reads the form.
      const captureId=await app.evaluate(()=>window.candidate.selected.syncState.captureId);
      await new Promise(resolve=>setTimeout(resolve,15000));
      result.reviewActivation={captureRetained:await app.evaluate(id=>window.candidate.selected.syncState?.captureId===id,captureId),
        status:await app.getByRole('status',{name:'Delay activation status'}).innerText()};
      assert(result.reviewActivation.captureRetained,'Paused capture expired while completing consent');
      assert(await app.getByRole('button',{name:/Enable calibrated/}).isEnabled(),result.reviewActivation.status);
      await app.getByRole('button',{name:/Enable calibrated/}).click();
    } else {
      await sourcePage.locator('audio').evaluate(audio=>audio.pause());
      await app.waitForFunction(()=>window.candidate.selected.paused&&window.candidate.selected.syncState?.captureId,{timeout:10000});
      await app.evaluate(async()=>{const session=window.candidate.selected;await window.configureExperimentalSynchronization(session.id,
      {enabled:true,captureId:session.syncState.captureId,generation:session.syncState.capability.generation,
        intentionalDelay:true,authorizedAudio:true,outputHeard:true,preview:true});window.refreshCandidate();});
    }
    await app.waitForFunction(()=>window.candidate.selected.syncState?.capability?.mode==='experimental-buffered');
    await sourcePage.locator('audio').evaluate(audio=>audio.play());
    if(review) {
      await app.locator('.candidate-grid').scrollIntoViewIfNeeded();
      await app.waitForFunction(()=>window.privateVisualCheck.semantic>=3,null,{timeout:20000});
      result.reviewVisuals=await app.evaluate(()=>({...window.privateVisualCheck,
        mode:window.candidate.selected.syncState.capability.mode,onsets:window.candidate.beat.onsets,
        gridWidth:document.querySelector('.music-pattern').getBoundingClientRect().width,
        reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches}));
      assert(result.reviewVisuals.gridWidth<=760);
      assert.equal(result.reviewVisuals.mode,'experimental-buffered');
      await app.screenshot({path:resolve(folder,`review-${channel}-preview.png`)});
      await save();
    }
    result.steps.push({stage:'automation-routing-consent-generated-signal',at:new Date().toISOString(),status:await app.evaluate(()=>window.candidate.selected.syncState)});
    const started=Date.now();let baseline;
    while(!interrupted&&Date.now()-started<duration*1000) {
      const processes=(await cdp.send('SystemInfo.getProcessInfo')).processInfo;
      const cpu=processes.reduce((sum,p)=>sum+p.cpuTime,0);baseline??={cpu,time:Date.now()};
      const sample=await app.evaluate(()=>({status:window.candidate?.selected?.syncState,
        playbackTime:window.candidate?.selected?.currentTime,mode:window.candidate?.beat?.eventPath,
        telemetry:window.candidate?.telemetry,heap:performance.memory?.usedJSHeapSize,
        semanticVisible:document.querySelectorAll('.semantic-beat-flash').length}));
      const offscreen=await worker.evaluate(()=>chrome.runtime.sendMessage({target:'beat-offscreen',kind:'diagnostics'}));
      if(offscreen?.telemetry?.records)offscreen.telemetry.records=offscreen.telemetry.records.slice(-256);
      if(sample.telemetry?.records)sample.telemetry.records=sample.telemetry.records.slice(-256);
      result.samples.push({elapsedMs:Date.now()-started,cpuSeconds:cpu-baseline.cpu,offscreen,...sample});
      await save();console.log(JSON.stringify({channel,elapsedSeconds:Math.round((Date.now()-started)/1000),mode:sample.status?.capability?.mode,delayMs:sample.status?.capability?.bufferMs,heap:sample.heap}));
      await new Promise(resolve=>setTimeout(resolve,10000));
    }
    result.enduranceSeconds=(Date.now()-started)/1000;
    result.enduranceCompleted=!interrupted&&result.enduranceSeconds>=duration;
    result.source=await sourcePage.locator('audio').evaluate(audio=>({currentTime:audio.currentTime,paused:audio.paused,readyState:audio.readyState}));
    result.steps.push({stage:'pause-flush',at:new Date().toISOString()});await sourcePage.locator('audio').evaluate(audio=>audio.pause());
    await app.waitForFunction(()=>window.candidate.selected.paused);
    result.finalStatus=await app.evaluate(()=>window.candidate.selected.syncState);
    if(music) {
      const benchmark=resolve(root,'scratch/whiplash-benchmark'),manifest=JSON.parse(await readFile(resolve(benchmark,'manifest.json')));
      result.music=[];
      for(const fixture of manifest.excerpts) {
        const file=resolve(benchmark,fixture.file),bytes=await readFile(file);
        assert.equal(createHash('sha256').update(bytes).digest('hex'),fixture.reviewWavSha256);
        const previous=await app.evaluate(()=>window.candidate?.selected?.syncState?.captureId);
        await sourcePage.locator('#file').setInputFiles(file);await sourcePage.locator('#play').click();
        const observations=[],started=Date.now();
        await app.waitForFunction(previous=>{const id=window.candidate?.selected?.syncState?.captureId;return id&&id!==previous;},previous,{timeout:8000});
        while(Date.now()-started<(fixture.duration+.5)*1000) {
          const state=await app.evaluate(()=>({status:window.candidate?.selected?.syncState,onsets:window.candidate?.beat?.onsets}));
          const health=await worker.evaluate(()=>chrome.runtime.sendMessage({target:'beat-offscreen',kind:'diagnostics'})).catch(()=>undefined);
          observations.push({elapsedMs:Date.now()-started,...state,health:health?.health});
          assert(!state.status?.capability?.bufferMs,'Source change retained an old audio buffer');
          assert(!Object.values(state.onsets||{}).some(count=>count>0),'Unqualified music emitted typed events');
          await new Promise(resolve=>setTimeout(resolve,2000));
        }
        result.music.push({input:fixture.input,wavSha256:fixture.reviewWavSha256,referenceStatus:'provisional-human-reference',
          officialMetricsCalculated:false,observations});await save();
        console.log(JSON.stringify({channel,music:fixture.input,snapshots:observations.length,mode:'degraded'}));
      }
    }
    if(lifecycle) {
      const check=async(stage,operation)=>{
        try{await operation();result.steps.push({stage,ok:true,status:await app.evaluate(()=>window.candidate?.selected?.syncState)});}
        catch(error){result.steps.push({stage,ok:false,error:error.message});result.errors.push(`${stage}: ${error.message}`);process.exitCode=1;}
        await save();
      };
      const capture=()=>app.waitForFunction(()=>window.candidate?.selected?.syncState?.mode==='capture',null,{timeout:15000});
      await check('pause-resume',async()=>{
        await sourcePage.locator('audio').evaluate(audio=>audio.play());await capture();
        await app.waitForFunction(()=>window.candidate.selected.syncState?.capability?.mode==='experimental-buffered');
      });
      const reenable=async()=>{
        await sourcePage.locator('audio').first().evaluate(audio=>audio.pause());
        await app.waitForFunction(()=>window.candidate.selected.paused&&window.candidate.selected.syncState?.capability?.bufferEligible);
        await app.evaluate(async()=>{const session=window.candidate.selected;await window.configureExperimentalSynchronization(session.id,
          {enabled:true,captureId:session.syncState.captureId,generation:session.syncState.capability.generation,
            intentionalDelay:true,authorizedAudio:true,outputHeard:true,preview:true});window.refreshCandidate();});
        await sourcePage.locator('audio').first().evaluate(audio=>audio.play());
      };
      await check('frame-appearance-flushes-output',async()=>{
        await sourcePage.evaluate(()=>{const frame=document.createElement('iframe');frame.id='unsafe-frame';frame.src='about:blank';document.body.append(frame);});
        await app.waitForFunction(()=>window.candidate.selected.syncState?.capability?.noFrames===false&&window.candidate.selected.syncState.capability.bufferMs===0);
        const diagnostic=await worker.evaluate(()=>chrome.runtime.sendMessage({target:'beat-offscreen',kind:'diagnostics'}));assert.equal(diagnostic.health.bufferMs,0);
        await sourcePage.locator('#unsafe-frame').evaluate(frame=>frame.remove());
      });
      await check('second-media-flushes-output',async()=>{
        await reenable();
        await sourcePage.evaluate(()=>{const audio=document.createElement('audio');audio.id='second-media';audio.src='/endurance.wav?secondary=1';document.body.append(audio);return audio.play();});
        await app.waitForFunction(()=>window.candidate.selected.syncState?.capability?.singleSource===false&&window.candidate.selected.syncState.capability.bufferMs===0);
        const diagnostic=await worker.evaluate(()=>chrome.runtime.sendMessage({target:'beat-offscreen',kind:'diagnostics'}));assert.equal(diagnostic.health.bufferMs,0);
        await sourcePage.locator('#second-media').evaluate(audio=>{audio.pause();audio.remove();});
      });
      await check('seek-revokes-buffer',async()=>{
        await sourcePage.locator('audio').evaluate(audio=>{audio.currentTime+=3;});
        await app.waitForFunction(()=>window.candidate.selected.syncState?.capability?.bufferMs===0);await capture();
      });
      await check('rate-change-revokes-buffer',async()=>{
        await sourcePage.locator('audio').evaluate(audio=>{audio.playbackRate=1.25;});
        await app.waitForFunction(()=>window.candidate.selected.syncState?.capability?.bufferEligible===false);
        await sourcePage.locator('audio').evaluate(audio=>{audio.playbackRate=1;});await capture();
      });
      await check('offscreen-restart',async()=>{
        await worker.evaluate(()=>chrome.offscreen.closeDocument());await new Promise(resolve=>setTimeout(resolve,2500));
        await capture();assert.equal((await app.evaluate(()=>window.candidate.selected.syncState.capability)).bufferMs,0);
      });
      await check('detector-worker-failure',async()=>{
        await app.waitForFunction(()=>window.candidate.selected.syncState?.capability?.latencySamples>0,null,{timeout:15000});
        await cdp.send('Target.setDiscoverTargets',{discover:true});
        const targets=(await cdp.send('Target.getTargets',{filter:[{type:'worker'}]})).targetInfos;
        result.workerTargets=targets.map(target=>({type:target.type,script:target.url.split('/').at(-1)}));
        let terminated=false;
        for(const target of targets) {
          const {sessionId}=await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
          let command=0;
          const evaluate=expression=>new Promise((done,fail)=>{
            const id=++command;
            const timer=setTimeout(()=>{cdp.off('Target.receivedMessageFromTarget',receive);fail(Error('Worker inspection timed out'));},3000);
            const receive=event=>{
              if(event.sessionId!==sessionId)return;const message=JSON.parse(event.message);if(message.id!==id)return;
              clearTimeout(timer);cdp.off('Target.receivedMessageFromTarget',receive);
              if(message.error)fail(Error(message.error.message));else done(message.result?.result?.value);
            };
            cdp.on('Target.receivedMessageFromTarget',receive);
            void cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true}})}).catch(fail);
          });
          const location=await evaluate('self.location.href');
          if(typeof location==='string'&&location.endsWith('/percussion-worker.js')) {
            await evaluate('setTimeout(()=>self.close(),0); true');terminated=true;break;
          }
          await cdp.send('Target.detachFromTarget',{sessionId});
        }
        assert(terminated,'Actual detector worker could not be identified safely');
        await new Promise(resolve=>setTimeout(resolve,4500));await capture();
        const health=await worker.evaluate(()=>chrome.runtime.sendMessage({target:'beat-offscreen',kind:'diagnostics'}));
        assert.equal(health.health?.context,'running');
        result.workerRecovery=health;
      });
      await check('app-reload',async()=>{await app.reload();await capture();});
      await check('network-stall-recovery',async()=>{
        await context.setOffline(true);
        await sourcePage.locator('audio').evaluate(audio=>{audio.src='/endurance.wav?offline=1';audio.load();void audio.play().catch(()=>{});});
        await sourcePage.waitForFunction(()=>document.querySelector('audio').readyState<3);
        await app.waitForFunction(()=>!window.candidate?.selected||window.candidate.selected.paused||window.candidate.selected.syncState?.capability?.bufferMs===0);
        await context.setOffline(false);
        await sourcePage.locator('audio').evaluate(audio=>{audio.src='/endurance.wav';audio.load();return audio.play();});await capture();
      });
      await check('competing-app-ownership',async()=>{
        const competing=await context.newPage();await competing.goto('http://127.0.0.1:5173/?competing=1');
        try {
        await competing.waitForFunction(()=>window.candidate?.selected?.syncState?.mode==='capture');
        const counts=[];
        for(let i=0;i<3;i++){
          counts.push(await worker.evaluate(async()=>(await chrome.tabCapture.getCapturedTabs()).filter(capture=>capture.status==='active').length));
          await new Promise(resolve=>setTimeout(resolve,1200));
        }
        result.competingCaptureCounts=counts;assert(counts.every(count=>count<=1));
        }finally{await competing.close();}
        await capture();
      });
      await check('source-tab-switch',async()=>{
        const previous=await app.evaluate(()=>window.candidate.selected.id),second=await context.newPage();
        await second.goto('http://127.0.0.1:5174/?second=1');await second.getByRole('button',{name:'Play generated audio'}).click();
        await app.waitForFunction(()=>document.querySelector('select[aria-label="Source"]').options.length>=2);
        const next=await app.locator('select[aria-label="Source"] option').evaluateAll((options,previous)=>options.map(option=>option.value).find(value=>value!==previous),previous);
        await app.getByRole('combobox',{name:'Source'}).selectOption(next);
        await app.waitForFunction(()=>window.candidate?.selected?.syncState?.reason==='capture-permission');
        const target=(await cdp.send('Target.getTargets',{filter:[{type:'tab'}]})).targetInfos.find(target=>target.url.endsWith('/?second=1'));
        await second.bringToFront();await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});await capture();
        assert.equal(await worker.evaluate(async()=>(await chrome.tabCapture.getCapturedTabs()).filter(capture=>capture.status==='active').length),1);
        await second.close();await app.waitForFunction(previous=>window.candidate?.selected?.id===previous,previous);await capture();
      });
      await check('source-navigation',async()=>{
        await sourcePage.goto('http://127.0.0.1:5174/?navigation=1');await sourcePage.getByRole('button',{name:'Play generated audio'}).click();await capture();
      });
      await check('source-tab-closure',async()=>{
        await sourcePage.close();await app.waitForFunction(()=>!window.candidate?.selected,null,{timeout:15000});
      });
      await check('youtube-video-degraded',async()=>{
        const video=await context.newPage();await video.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw',{timeout:25000,waitUntil:'domcontentloaded'});
        await video.locator('video').first().waitFor({timeout:20000});
        const play=video.locator('.ytp-play-button');if(await play.count())await play.click();
        await video.waitForFunction(()=>{const media=document.querySelector('video');return media&&!media.paused&&media.currentTime>.2&&media.readyState>=3;},null,{timeout:15000});
        await app.waitForFunction(()=>{const c=window.candidate;return c?.selected?.source?.endsWith('youtube.com')
          &&c.beat.sessionId===c.selected.id&&c.beat.eventPath==='degraded'&&c.selected.syncState?.capability?.clockHealthy;},null,{timeout:15000});
        const target=(await cdp.send('Target.getTargets',{filter:[{type:'tab'}]})).targetInfos.find(target=>target.url.startsWith('https://www.youtube.com/watch'));
        await video.bringToFront();await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});
        await capture();await new Promise(resolve=>setTimeout(resolve,2000));
        const state=await app.evaluate(()=>window.candidate.selected.syncState.capability);
        assert.equal(state.bufferMs,0);assert.equal(state.allowTypedPreview,false);assert.equal(state.allowSemantic,false);
        result.youtube={actualCapture:true,media:await video.locator('video').first().evaluate(media=>({playing:!media.paused,currentTime:media.currentTime,muted:media.muted,volume:media.volume,readyState:media.readyState})),capability:state,
          captureDiagnostics:await worker.evaluate(()=>chrome.runtime.sendMessage({target:'beat-offscreen',kind:'diagnostics'}))};
        await video.close();
      });
    }
    }
  }
}catch(error){result.errors.push(error.message);
  if(app)result.failureState=await app.evaluate(()=>({status:window.candidate?.selected?.syncState,error:window.candidate?.error,beat:window.candidate?.beat})).catch(()=>undefined);
  const worker=context?.serviceWorkers().find(worker=>worker.url().endsWith('/background.js'));
  if(worker)result.permissionDiagnostic=await worker.evaluate(async()=>{
    const tab=(await chrome.tabs.query({url:'http://127.0.0.1:5174/'}))[0];
    const captures=await chrome.tabCapture.getCapturedTabs();
    return {captures:captures.map(capture=>({selected:capture.tabId===tab.id,status:capture.status}))};
  }).catch(error=>error.message);
  process.exitCode=1;}
finally {
  result.finishedAt=new Date().toISOString();if(!serve)await save();
  await context?.close();for(const server of servers)await new Promise(resolve=>server.close(resolve));
}
