// Actual tab-capture route in an isolated temporary Chrome profile, CC0 only.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {classifyTrace} from './acoustic-visual-lab-core.ts';
const folder=resolve('scratch/acoustic-visual-lab'),profile=await mkdtemp(resolve(folder,'live-test-profile-'));
const context=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,ignoreDefaultArgs:['--disable-extensions','--mute-audio'],args:['--enable-unsafe-extension-debugging','--no-first-run']});
const result={startedAt:new Date().toISOString(),actualTabCapture:false,sourceKind:'CC0 generated Hat-only fixture',humanOutputHeard:false,humanListeningVerified:false,physicalVerified:false,errors:[]};
let source,app;
try{
 const cdp=await context.browser().newBrowserCDPSession();result.browser=(await cdp.send('Browser.getVersion')).product;
 const {id}=await cdp.send('Extensions.loadUnpacked',{path:resolve('scratch/browser-first-candidate/extension')});
 const manifest=JSON.parse(await readFile('scratch/browser-first-candidate/extension/manifest.json','utf8'));assert(manifest.name.includes('Private'));
 result.extension={id,version:manifest.version};
 const data=JSON.parse(await readFile(resolve(folder,'lab-data.json'),'utf8')),clip=data.clips.find(c=>c.id==='hat-only');
 result.source={clipId:clip.id,canonicalWavSha256:clip.canonicalWavSha256,decodedPcmSha256:clip.decodedPcmSha256,sourceOffset:0};
 const actual=await(await fetch('http://127.0.0.1:5174/audio/hat-only.wav')).arrayBuffer();assert.equal(createHash('sha256').update(Buffer.from(actual)).digest('hex'),clip.canonicalWavSha256);
 app=await context.newPage();app.on('pageerror',e=>result.errors.push(e.message));await app.goto('http://127.0.0.1:5173/?musicDebug=1');
 source=await context.newPage();await source.goto('http://127.0.0.1:5174/');await source.locator('#clip').selectOption('hat-only');
 await source.locator('audio').evaluate(async a=>{await a.play();});
 await app.waitForFunction(()=>window.candidate?.selected?.title?.includes('hat-only'));
 const target=(await cdp.send('Target.getTargets',{filter:[{type:'tab'}]})).targetInfos.find(t=>t.url==='http://127.0.0.1:5174/');assert(target);
 await source.bringToFront();await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});
 await app.waitForFunction(()=>window.candidate?.selected?.syncState?.mode==='capture',null,{timeout:20000});result.actualTabCapture=true;
 const worker=context.serviceWorkers().find(w=>w.url().endsWith('/background.js'));assert(worker);
 await app.waitForFunction(()=>window.candidate?.selected?.syncState?.capability?.livePreviewEligible,null,{timeout:15000});
 // This generated-only automation exercises existing consent/config routing.
 // It is not a person attesting they heard the output.
 await app.evaluate(async()=>{const s=window.candidate.selected;await window.configureExperimentalSynchronization(s.id,{enabled:true,live:true,intentionalDelay:false,authorizedAudio:true,outputHeard:true,latencyAccepted:true,preview:true,captureId:s.syncState.captureId,generation:s.syncState.capability.generation});window.refreshCandidate();});
 await app.waitForFunction(()=>window.candidate?.selected?.syncState?.capability?.mode==='experimental-live');
 await app.bringToFront();await app.getByText('Private live pipeline trace',{exact:true}).click();
 result.sourceAtActivation=await source.locator('audio').evaluate(a=>({time:a.currentTime,paused:a.paused,rate:a.playbackRate}));
 await app.getByRole('button',{name:'Start fresh app trace',exact:true}).click();
 await app.locator('.candidate-grid').scrollIntoViewIfNeeded();
 await app.waitForFunction(()=>window.candidate?.telemetry?.records?.some(r=>r.stage==='EVENT_ACCEPTED'&&r.source==='onset'),null,{timeout:20000});
 await new Promise(done=>setTimeout(done,3500));
 result.app=await app.evaluate(()=>({session:window.candidate.selected,beat:window.candidate.beat,telemetry:window.candidate.telemetry,firstObservedFrames:window.candidate.firstObservedFrames}));
 result.offscreen=await worker.evaluate(()=>chrome.runtime.sendMessage({target:'beat-offscreen',kind:'diagnostics'}));
 result.sourceAtEnd=await source.locator('audio').evaluate(a=>({time:a.currentTime,paused:a.paused,rate:a.playbackRate}));
 const records=[...(result.offscreen?.telemetry?.records||[]),...(result.app.telemetry?.records||[])];
 const ids=[...new Set(records.filter(r=>r.source==='onset'&&r.id).map(r=>r.id))];
 result.perEvent=ids.map(id=>{const stages=records.filter(r=>r.id===id);return {id,type:stages[0].type,primaryFromExplicitStages:classifyTrace(records,id),stages};});
 result.stageCounts=Object.fromEntries(['EVENT_DETECTED','EVENT_SENT','EVENT_RECEIVED','EVENT_SCHEDULED','EVENT_ACCEPTED','EVENT_STATE_COMMITTED','EVENT_COMMITTED','EVENT_RENDERED','EVENT_LATE','EVENT_DROPPED'].map(stage=>[stage,new Set(records.filter(r=>r.stage===stage&&r.source==='onset').map(r=>r.id)).size]));
 result.scope='Actual generated-source baseline route, app + offscreen realms. Counts are unique trace IDs, not verified acoustic matches or perceived attacks. Bounded-log omissions remain UNKNOWN. No XO causal percentages.';
 assert.equal(result.app.session.syncState.capability.bufferMs,0);assert.equal(result.app.session.syncState.capability.mode,'experimental-live');assert(result.stageCounts.EVENT_ACCEPTED>0);assert.deepEqual(result.errors,[]);
 await app.screenshot({path:resolve(folder,'live-baseline-trace.png')});result.status='PASS';
}catch(error){result.status='FAIL';result.errors.push(error.stack);if(app)result.failureState=await app.evaluate(()=>({candidate:window.candidate})).catch(()=>undefined);process.exitCode=1;}
finally{await source?.locator('audio').evaluate(a=>a.pause()).catch(()=>{});result.finishedAt=new Date().toISOString();await writeFile(resolve(folder,'live-verification.json'),JSON.stringify(result,null,2));await context.close();console.log(JSON.stringify({status:result.status,actualTabCapture:result.actualTabCapture,stageCounts:result.stageCounts,errors:result.errors}));}
