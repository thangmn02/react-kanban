// Real saved predictions and native playback in an isolated, owned browser profile.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const smoke=process.argv.includes('--smoke-only');
const root='scratch/hat-recovery',base='http://127.0.0.1:5173';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const data=await read(root+'/view-data.json'),result={startedAt:new Date().toISOString(),checks:[],runs:[],errors:[],physicalVerified:false,humanListeningVerified:false};
const response=await fetch(base+'/lab/hat-recovery/data');assert.equal(response.status,200);assert.equal((await response.json()).negative.counts.B.hat,21);
const s1=data.cases.find(c=>c.id==='S1');assert.equal(s1.source,'2693f11c0f6f605a25574e3a73032ef709ae6d64c0d8b7461fcff1a397c2e7bd');assert.equal(s1.start,200);assert.equal(s1.end,220);assert(data.sources[s1.source].source.duration>220);
const control=data.cases.find(c=>c.id==='S1-control'),controlPath=root+'/'+control.source+'.json',original=await readFile(controlPath);
try{await writeFile(controlPath,Buffer.concat([original,Buffer.from(' ')]));assert.equal((await fetch(base+'/lab/hat-recovery/clip/'+control.source)).status,400);}finally{await writeFile(controlPath,original);}
assert.equal((await fetch(base+'/lab/hat-recovery/clip/'+control.source)).status,200);
assert.equal((await fetch(base+'/lab/hat-recovery/data',{method:'POST',headers:{Origin:base},body:'{}'})).status,400);
assert.equal((await fetch(base+'/lab/hat-recovery/audio/'+control.source,{headers:{Range:'bytes=0-99'}})).status,206);
assert.equal((await fetch(base+'/lab/hat-recovery/clip/'+'0'.repeat(64))).status,400);result.checks.push('Frozen snapshot hashes, exact Chinese source bounds, read-only routes, opaque IDs and audio ranges are enforced');
const rawResponse=await fetch(base+'/lab/hat-recovery/raw/'+data.cases[0].source+'?at=26.05&radius=.1');assert.equal(rawResponse.status,200);const raw=await rawResponse.json();assert(raw.models.B.times.every(t=>Math.abs(t-26.05)<=.1));assert.equal((await fetch(base+'/lab/hat-recovery/raw/'+data.cases[0].source+'?at=26.05&radius=99')).status,400);result.checks.push('Frozen raw-score requests retain exact source time and bounded windows');
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',e=>result.errors.push(e.message));
await page.addInitScript(()=>{
 const Native=window.Audio;window.nativeHatProbe={play:0,load:0,seek:0};
 window.Audio=function(...args){const audio=new Native(...args),play=audio.play.bind(audio),load=audio.load.bind(audio),descriptor=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'currentTime');audio.play=(...p)=>{window.nativeHatProbe.play++;return play(...p);};audio.load=(...p)=>{window.nativeHatProbe.load++;return load(...p);};Object.defineProperty(audio,'currentTime',{get:()=>descriptor.get.call(audio),set:value=>{window.nativeHatProbe.seek++;descriptor.set.call(audio,value);}});window.hatNative=audio;return audio;};
});
const ready=async()=>page.getByRole('button',{name:'Play investigation',exact:true}).waitFor({state:'visible'}).then(()=>page.waitForFunction(()=>!document.querySelector('button')?.disabled));
const choose=async id=>{await page.getByLabel('Hat investigation case',{exact:true}).selectOption(id);await page.waitForFunction(source=>document.querySelector('[aria-label="Investigation source clock"]')?.dataset.source===source,data.cases.find(c=>c.id===id).source);await ready();};
const exportTrace=async()=>{const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export investigation trace',exact:true}).click()]);return JSON.parse(await readFile(await download.path(),'utf8'));};
const compact=events=>events.map(({id,instrument,sourceTime})=>({id,instrument,sourceTime}));
try{
 await page.goto(base+'/lab/?mode=hat-recovery');await ready();await page.waitForFunction(()=>Number(document.querySelector('[aria-label="Investigation source clock"]').textContent.split('/')[0])>=26);
 await page.getByRole('button',{name:'Play investigation',exact:true}).click();await page.waitForFunction(()=>window.hatNative.currentTime>26.2);const before=await page.evaluate(()=>({counts:{...window.nativeHatProbe},src:window.hatNative.src,time:window.hatNative.currentTime,rate:window.hatNative.playbackRate}));
 for(const track of ['A','B','cnn-hat-threshold-diagnostic-v1-70','cnn-hat-snare-dominance-v1','H0-frozen-routing-diagnostic-v1'])await page.getByLabel('Investigation track',{exact:true}).selectOption(track);
 await page.getByLabel('Investigation renderer',{exact:true}).selectOption('short');const after=await page.evaluate(()=>({counts:{...window.nativeHatProbe},src:window.hatNative.src,time:window.hatNative.currentTime,rate:window.hatNative.playbackRate}));assert.deepEqual(after.counts,before.counts);assert.equal(after.src,before.src);assert.equal(after.rate,1);assert(after.time>=before.time);await page.getByRole('button',{name:'Pause investigation',exact:true}).click();result.checks.push('A/B/experimental/H0 and renderer switches preserve native source, play/load/seek counts, position and speed');
 await choose('P1');assert.equal(await page.getByRole('table',{name:'Investigation events'}).locator('tbody tr').count()<=200,true);await choose('S1');assert.equal(await page.getByLabel('Investigation seek').getAttribute('min'),'200');assert.equal(await page.getByLabel('Investigation seek').getAttribute('max'),'220');
 // Delay a real source response, then switch to another source before it completes.
 let released;const pending=new Promise(resolve=>{released=resolve;});await page.route('**/lab/hat-recovery/clip/'+data.cases.find(c=>c.id==='P1').source,async route=>{const r=await route.fetch();await new Promise(done=>setTimeout(done,450));await route.fulfill({response:r});released();});
 await page.getByLabel('Hat investigation case').selectOption('P1');await page.getByLabel('Hat investigation case').selectOption('S1');await pending;await ready();assert.equal(await page.getByLabel('Investigation source clock').getAttribute('data-source'),s1.source);await page.unrouteAll();result.checks.push('Retained Nujabes/Chinese files are selectable without reupload, bounds are exact, source races are guarded and event DOM is bounded');
 await choose('S1-control');await page.getByLabel('Loop investigation case').check();await page.getByLabel('Investigation seek').press('End');await page.getByLabel('Investigation seek').press('ArrowLeft');await page.getByRole('button',{name:'Play investigation',exact:true}).click();await page.waitForFunction(start=>window.hatNative.currentTime<start+1,control.start);await page.getByRole('button',{name:'Pause investigation',exact:true}).click();await page.getByLabel('Loop investigation case').uncheck();result.checks.push('Native source-relative loop returns to the exact selected start without new inference');
 await choose('N1');
 for(const track of smoke?[]:['A','B'])for(const renderer of ['original','short']){
  await page.getByLabel('Investigation track',{exact:true}).selectOption(track);await page.getByLabel('Investigation renderer').selectOption(renderer);await page.getByRole('button',{name:'Replay selected case',exact:true}).click();await page.locator('.lab-grid').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>window.hatNative.paused&&window.hatNative.currentTime>=44,null,{timeout:25000});const trace=await exportTrace();assert.deepEqual(compact(trace.deliveries),compact(trace.predictions.filter(e=>['kick','snare','hat','cymbal','grouped-percussion'].includes(e.instrument))));assert.equal(trace.late.length,0);result.runs.push({case:'N1',track,renderer,...trace.counts,deliveries:compact(trace.deliveries),sharedRowBrightness:trace.sharedRowBrightness});console.log(JSON.stringify({finishedRun:'N1',track,renderer,counts:trace.counts}));
 }
 for(const renderer of smoke?[]:['original','short']){
  await choose('S1-control');await page.getByLabel('Investigation track',{exact:true}).selectOption('B');await page.getByLabel('Investigation renderer').selectOption(renderer);await page.getByRole('button',{name:'Replay selected case'}).click();await page.locator('.lab-grid').scrollIntoViewIfNeeded();
  const end=data.sequence.filter(c=>c.condition==='identical-cnn-frame-aligned').at(-1).end;await page.waitForFunction(end=>window.hatNative.currentTime>=end,end);await page.getByRole('button',{name:'Pause investigation',exact:true}).click();const trace=await exportTrace();const expected=trace.predictions.filter(e=>e.sourceTime<end);assert.deepEqual(compact(trace.deliveries),compact(expected));result.runs.push({case:'S1-control-first-six',track:'B',renderer,...trace.counts,deliveries:compact(trace.deliveries),sharedRowBrightness:trace.sharedRowBrightness});
 }
 for(const group of smoke?[]:[['N1','A'],['N1','B'],['S1-control-first-six','B']]){const runs=result.runs.filter(r=>r.case===group[0]&&r.track===group[1]);assert.deepEqual(runs[0].deliveries,runs[1].deliveries);}
 if(!smoke)result.checks.push('Original and Short Attack receive identical exact frozen IDs/classes/timestamps; N1 and six labeled CNN cycles have no lost lab deliveries. Frame proxies remain separate');
 assert.equal(result.errors.length,0);await choose('N1');await page.screenshot({path:root+'/investigation-ready.png',fullPage:false});result.status='PASS';
}catch(error){result.status='FAIL';result.errors.push(error.stack);throw error;}finally{result.finishedAt=new Date().toISOString();await writeFile(root+(smoke?'/browser-smoke-verification.json':'/browser-verification.json'),JSON.stringify(result,null,2));await browser.close();}
