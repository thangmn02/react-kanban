// Isolated repository UI regression runner; never uses a user's browser profile.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const folder='scratch/acoustic-visual-lab';await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const result={startedAt:new Date().toISOString(),browser:await browser.version(),private:true,physicalVerified:false,humanListeningVerified:false,checks:[],repeatRuns:[],errors:[]};
const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',e=>result.errors.push(e.message));
await page.addInitScript(()=>{
 window.audioProbe={delayResume:false,pending:false,starts:0};
 const resume=AudioContext.prototype.resume,create=AudioContext.prototype.createBufferSource;
 AudioContext.prototype.resume=async function(){await resume.call(this);if(window.audioProbe.delayResume){window.audioProbe.pending=true;await new Promise(resolve=>setTimeout(resolve,350));window.audioProbe.pending=false;}};
 AudioContext.prototype.createBufferSource=function(){const node=create.call(this),start=node.start;node.start=function(...args){window.audioProbe.starts++;return start.apply(this,args);};return node;};
});
try{
 await page.goto('http://127.0.0.1:5173/lab/?mode=detail&review=automated-ui-'+Date.now());await page.getByText('WAV and browser-decoded float PCM hashes match.',{exact:false}).waitFor();
 assert.equal(await page.getByRole('button',{name:'A · Frozen ADTOF baseline',exact:true}).count(),0);result.checks.push('Initial acoustic review hides all model predictions');
 await page.evaluate(()=>{window.audioProbe.delayResume=true;});await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForFunction(()=>window.audioProbe.pending);
 await page.getByLabel('Passage',{exact:true}).selectOption('W1');await page.waitForFunction(()=>document.querySelector('[aria-label="Authoritative source time"]').dataset.audioSource==='W1'&&!window.audioProbe.pending);
 assert.equal(await page.evaluate(()=>window.audioProbe.starts),0);assert.equal(await page.getByRole('button',{name:'Play',exact:true}).count(),1);result.checks.push('Changing source cancels a pending native AudioContext resume without stale playback');
 await page.getByLabel('Passage',{exact:true}).selectOption('trap');await page.getByText('WAV and browser-decoded float PCM hashes match.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForFunction(()=>window.audioProbe.pending);await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForFunction(()=>!window.audioProbe.pending&&window.audioProbe.starts===1);
 await page.getByRole('button',{name:'Pause',exact:true}).click();await page.evaluate(()=>{window.audioProbe.delayResume=false;});await page.getByRole('button',{name:'Replay passage',exact:true}).click();await page.getByRole('button',{name:'Pause',exact:true}).click();result.checks.push('Repeated Play during native resume starts exactly one buffer source');
 await page.getByRole('button',{name:'Play',exact:true}).click();await page.getByRole('button',{name:'Reveal model predictions'}).click();
 const before=await page.getByLabel('Authoritative source time').evaluate(e=>({generation:e.dataset.audioGeneration,time:parseFloat(e.textContent)}));
 await page.getByRole('button',{name:'B · Frame-Level Drum CNN',exact:true}).click();await page.getByRole('button',{name:'C · Corrected OAF + HTDemucs',exact:true}).click();
 await page.waitForFunction(()=>parseFloat(document.querySelector('[aria-label="Authoritative source time"]').textContent)>46);
 const after=await page.getByLabel('Authoritative source time').evaluate(e=>({generation:e.dataset.audioGeneration,time:parseFloat(e.textContent)}));
 assert.equal(before.generation,after.generation);assert(after.time>before.time);result.clockSwitch={before,after};result.checks.push('A/B/C switching preserves source clock/generation');
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Diagnostic delivered counters"]').textContent.includes('Kick 0 · Snare 0 · shared row 0'));
 result.deliveryCounters=await page.getByLabel('Diagnostic delivered counters').innerText();
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 // Delay the real W1 WAV to force out-of-order completion; never synthesize audio.
 let releaseW1;const delayedW1=new Promise(resolve=>{releaseW1=resolve;});
 await page.route('**/lab/audio/W1.wav',async route=>{const response=await route.fetch();await new Promise(done=>setTimeout(done,450));await route.fulfill({response});releaseW1();});
 await page.getByLabel('Passage',{exact:true}).selectOption('W1');await page.getByLabel('Passage',{exact:true}).selectOption('W2');
 await page.waitForFunction(()=>document.querySelector('[aria-label="Authoritative source time"]').dataset.audioSource==='W2');await delayedW1;
 assert.equal(await page.getByLabel('Authoritative source time').getAttribute('data-audio-source'),'W2');result.checks.push('Out-of-order WAV completion retains newest source/clock binding');
 await page.unroute('**/lab/audio/W1.wav');await page.getByLabel('Passage',{exact:true}).selectOption('trap');await page.getByRole('button',{name:'Reveal model predictions',exact:true}).click();
 await page.getByRole('button',{name:'A · Frozen ADTOF baseline',exact:true}).click();
 for(const reducedMotion of ['no-preference','reduce'])for(const renderer of ['original','short'])for(const gap of [20,30,50,80,125,200]){
  await page.emulateMedia({reducedMotion});await page.getByLabel('Renderer',{exact:true}).selectOption(renderer);await page.getByLabel('Repeat spacing',{exact:true}).selectOption(String(gap));
  await page.getByRole('button',{name:'Run known renderer repeats',exact:true}).click();
  await page.waitForFunction(({gap,renderer})=>{try{const r=JSON.parse(document.querySelector('[aria-label="Renderer repeat result"]').textContent);return r.gap===gap&&r.renderer===renderer&&r.reducedMotion===matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return false;}},{gap,renderer});
  const run=JSON.parse(await page.getByLabel('Renderer repeat result').innerText());assert.equal(run.referenceHits,6);assert.equal(run.labDelivered,6);assert.equal(run.controllerAccepted,null);
  assert.equal(run.measurementStatus,'FRAME_PROXY_ONLY');if(reducedMotion==='no-preference')assert(run.frameObservedIds>0);
  result.repeatRuns.push(run);console.log(JSON.stringify(run));
 }
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.getByLabel('Passage',{exact:true}).selectOption('hat-only');await page.getByText('WAV and browser-decoded float PCM hashes match.',{exact:false}).waitFor();
 await page.getByLabel('Reviewer identifier',{exact:true}).fill('automated-ui-test-only');await page.getByLabel('Review cursor seconds',{exact:true}).fill('1');await page.getByRole('button',{name:'Mark attack at cursor',exact:true}).click();
 await page.getByLabel('Annotation instrument',{exact:true}).selectOption('hat');await page.getByRole('button',{name:'Keep mark',exact:true}).click();await page.getByRole('button',{name:'Save review locally',exact:true}).click();
 await page.getByText(/Saved annotation revision/).waitFor();await page.reload();await page.getByText('WAV and browser-decoded float PCM hashes match.',{exact:false}).waitFor();
 await page.getByLabel('Passage',{exact:true}).selectOption('hat-only');await page.getByRole('button',{name:'Edit',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Reveal model predictions',exact:true}).count(),1);result.checks.push('Blind provisional annotation saves and reloads with source identity');
 await page.getByRole('button',{name:'Remove mark',exact:true}).click();await page.getByLabel('Reviewer identifier',{exact:true}).fill('local-reviewer');await page.getByRole('button',{name:'Save review locally',exact:true}).click();await page.getByText(/Saved annotation revision/).waitFor();
 await page.getByRole('button',{name:'Reveal model predictions'}).click();await page.getByRole('button',{name:'Hide predictions / blind view'}).click();
 await page.getByRole('button',{name:'Mark attack at cursor'}).click();await page.getByText('Model predictions were visible when this mark was created;', {exact:false}).waitFor();await page.getByRole('button',{name:'Cancel edit'}).click();
 result.checks.push('Reveal/hide keeps new annotations model-exposed');
 await page.getByLabel('Passage',{exact:true}).selectOption('trap');await page.getByRole('button',{name:'Reveal model predictions'}).waitFor();
 await page.screenshot({path:folder+'/lab-blind.png',fullPage:false});assert.deepEqual(result.errors,[]);result.status='PASS';
}catch(error){result.status='FAIL';result.errors.push(error.stack);await page.screenshot({path:folder+'/verification-failure.png',fullPage:false});process.exitCode=1;}
finally{result.finishedAt=new Date().toISOString();await writeFile(folder+'/ui-verification.json',JSON.stringify(result,null,2));await browser.close();}
