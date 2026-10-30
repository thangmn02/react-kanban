/** Observe the real owned Kora window. Never generate media/events or control playback. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,appendFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';

const arg=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const output=arg('output');assert.match(output,/^scratch\/[a-z0-9/_-]+$/);
await mkdir(output,{recursive:false});
const owner=JSON.parse(await readFile(arg('native-owner'),'utf8'));
assert.equal(owner.identity,'app.kanthangboard.ownerpreview');assert.ok(Number.isInteger(owner.ProcessId));
const inspect=spawnSync('powershell.exe',['-NoProfile','-Command',`$all=Get-CimInstance Win32_Process;$app=$all|Where-Object ProcessId -eq ${owner.ProcessId};$port=Get-NetTCPConnection -State Listen -LocalPort 9223|Where-Object LocalAddress -eq '127.0.0.1';$ancestor=[int]$port.OwningProcess;$owned=$false;for($i=0;$i -lt 16;$i++){if($ancestor -eq ${owner.ProcessId}){$owned=$true;break};$row=$all|Where-Object ProcessId -eq $ancestor;if(-not $row){break};$ancestor=[int]$row.ParentProcessId};@{owned=$owned;path=$app.ExecutablePath;created=$app.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress`],{encoding:'utf8',timeout:15000});
assert.equal(inspect.status,0,'Native ownership inspection failed: '+inspect.stderr.slice(0,1000));const live=JSON.parse(inspect.stdout);
assert.ok(live.owned);assert.equal(live.path.toLowerCase(),owner.ExecutablePath.toLowerCase());assert.equal(Date.parse(live.created),Date.parse(owner.CreationDate));assert.equal(createHash('sha256').update(await readFile(live.path)).digest('hex').toUpperCase(),owner.sha256.toUpperCase());
let browser,page,stopping=false;const observationId=randomUUID(),result={startedAt:new Date().toISOString(),observationId,nativePid:owner.ProcessId,applicationSha256:owner.sha256,physicalVerified:false,productionWrites:false,playbackControlled:false,samples:0};
process.once('SIGINT',()=>stopping=true);process.once('SIGTERM',()=>stopping=true);
try{
  browser=await chromium.connectOverCDP('http://127.0.0.1:9223');
  page=browser.contexts().flatMap(context=>context.pages()).find(page=>page.url().startsWith('http://127.0.0.1:1420/')&&!page.url().includes('native-note'));assert.ok(page);
  result.companions=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('native_music_request',{action:'companion.status'}));
  await page.evaluate(observationId=>{
    if(window.__koraOwnerObservation)throw Error('Another owner observation is active.');
    const telemetry=window.__koraBeatTelemetry;if(!telemetry)throw Error('Application telemetry unavailable.');
    const state={observationId,records:[],flashes:[],frames:[],overflow:0,priorEnabled:telemetry.enabled};telemetry.enable();
    const add=(array,value)=>{if(array.length<20000)array.push(value);else state.overflow++;};
    state.unsubscribe=telemetry.subscribe(record=>add(state.records,record));
    state.animation=event=>{const element=event.target;if(!(element instanceof HTMLElement)||!element.dataset.beatTrace)return;add(state.flashes,{at:Date.now(),traceId:element.dataset.beatTrace,eventId:element.dataset.eventId,type:element.dataset.eventType,semantic:element.dataset.semantic==='true',origin:element.dataset.detectorOrigin,targetPlaybackTime:element.dataset.targetPlaybackTime,animation:event.animationName});};
    state.roots=new Set();state.findRoots=()=>{const roots=[document];for(const root of roots)for(const element of root.querySelectorAll('*'))if(element.shadowRoot)roots.push(element.shadowRoot);for(const root of roots)if(!state.roots.has(root)){state.roots.add(root);root.addEventListener('animationstart',state.animation);}return roots;};
    state.findRoots();
    const frame=time=>{
      if(state.lastFrame===undefined||time-state.lastFrame>=16){
        state.lastFrame=time;
        const cells=[...state.roots].filter(root=>root===document||root.host.isConnected).flatMap(root=>[...root.querySelectorAll('.motion-body[data-beat-trace],.semantic-beat-flash[data-beat-trace]')]);
        for(const cell of cells.slice(0,24)){
          const opacity=Number(getComputedStyle(cell).opacity);
          if(opacity>.001&&cell.getClientRects().length)add(state.frames,{at:Date.now(),traceId:cell.dataset.beatTrace,type:cell.dataset.eventType,semantic:cell.dataset.semantic==='true',opacity,
            originalDeadline:Number(cell.dataset.originalDeadline)||undefined,presentationTime:Number(cell.dataset.presentationTime)||undefined,lateLivePreview:cell.dataset.lateLivePreview==='true'});
        }
      }
      state.raf=requestAnimationFrame(frame);
    };state.raf=requestAnimationFrame(frame);window.__koraOwnerObservation=state;
  },observationId);
  await writeFile(output+'/process.json',JSON.stringify({pid:process.pid,command:process.argv,worktree:process.cwd(),startedAt:result.startedAt,nativeOwner:owner.ProcessId}));
  console.log('Owner observation ready. Actual native telemetry only; no audio, credentials or signed URLs are recorded.');
  const started=Date.now();
  while(!stopping&&Date.now()-started<45*60*1000){
    if(await access(output+'/stop-observation').then(()=>true,()=>false))break;
    const sample=await page.evaluate(async({observationId,companionCapture})=>{
      const state=window.__koraOwnerObservation;if(state?.observationId!==observationId)throw Error('Owner observation ended or window reloaded.');
      const response=await window.__TAURI_INTERNALS__.invoke('native_music_request',{action:'sessions.get',...(companionCapture?{companionCapture:true}:{})});
      const sessions=(response.sessions||[]).map(session=>({id:session.id,title:session.title,source:session.source,currentTime:session.currentTime,paused:session.paused,playing:session.playing}));
      const roots=state.findRoots();
      const picker=roots.flatMap(root=>[...root.querySelectorAll('.music-sessions')])[0];
      const selectedSessionId=picker?.value||(sessions.length===1?sessions[0].id:null);
      return {at:Date.now(),selectedSessionId,sessions,records:state.records.splice(0),flashes:state.flashes.splice(0),frames:state.frames.splice(0),overflow:state.overflow,status:roots.flatMap(root=>[...root.querySelectorAll('[role="status"]')]).map(element=>element.textContent).filter(Boolean).slice(0,25)};
    },{observationId,companionCapture:owner.privateNativeCompanionCapture===true});
    await appendFile(output+'/observations.private.jsonl',JSON.stringify(sample)+'\n');result.samples++;await writeFile(output+'/result.json',JSON.stringify(result,null,2));
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  result.status='OBSERVATION_ENDED';
}catch(error){result.status='INCOMPLETE';result.reason=error.message;process.exitCode=1;}
finally{
  await page?.evaluate(observationId=>{const state=window.__koraOwnerObservation;if(state?.observationId!==observationId)return;state.unsubscribe();cancelAnimationFrame(state.raf);for(const root of state.roots)root.removeEventListener('animationstart',state.animation);window.__koraBeatTelemetry.enable(state.priorEnabled);delete window.__koraOwnerObservation;},observationId).catch(()=>{});
  await browser?.close();result.finishedAt=new Date().toISOString();await writeFile(output+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,samples:result.samples}));
}
