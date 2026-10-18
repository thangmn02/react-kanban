import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const root='scratch/hybrid-beta',registry=JSON.parse(await readFile(root+'/saved-lead-registry.json','utf8'));
const receipt={checks:[],errors:[],recognitionAccuracy:'UNVERIFIED',physicalSynchronization:'UNVERIFIED'};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({acceptDownloads:true,viewport:{width:1280,height:1000}});page.on('pageerror',e=>receipt.errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:1420/music?musicDebug=1');await page.getByRole('checkbox',{name:'Beat Grid Hybrid — Beta',exact:true}).check();
 for(const fixtureId of ['lead-gymnopedie','lead-lee_hi_hskt']){
  const entry=registry.entries.find(e=>e.fixtureId===fixtureId);
  if(await page.getByLabel('Beta local recording',{exact:true}).isHidden())await page.getByText('Local recording and visual envelope',{exact:true}).click();
  await page.getByLabel('Beta local recording',{exact:true}).selectOption(entry.id);
  const lead=page.getByRole('checkbox',{name:'Melody / Lead (saved analysis)',exact:true});await lead.check();
  await page.getByRole('button',{name:'Play music',exact:true}).click();await page.getByRole('tab',{name:'Beat grid',exact:true}).click();
  await page.waitForTimeout(6500);
  await page.getByText('Developer / research diagnostics',{exact:true}).click();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export Hybrid technical trace',exact:true}).click();const download=await pending,trace=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(trace.source.originalSourceSha256,entry.id);assert.equal(trace.source.lead.state,'READY');assert.equal(trace.source.predictions.H,null);assert.equal(await page.locator('[data-channel="melody"]').count(),1);
  const commits=trace.telemetry.records.filter(r=>r.stage==='EVENT_COMMITTED'&&r.type==='melodic');assert(commits.length>0,'actual Melody row committed');
  await writeFile(root+'/'+fixtureId+'-trace.json',JSON.stringify(trace,null,2));receipt.checks.push({fixtureId,id:entry.id,melodyNotes:trace.controller.melody?.note,commits:commits.length,kinds:[...new Set(trace.source.lead.events.map(e=>e.lead.kind))]});
  await page.getByRole('button',{name:'Pause music',exact:true}).click();await page.getByRole('tab',{name:'Music',exact:true}).click();await page.getByText('Developer / research diagnostics',{exact:true}).click();
 }
 if(await page.getByLabel('Beta local recording',{exact:true}).isHidden())await page.getByText('Local recording and visual envelope',{exact:true}).click();await page.getByLabel('Beta local recording',{exact:true}).selectOption('349b0b80a4e8f7f206d3fed48ccb6bc938b179a171bbff9ecaf9ec6171145f9f');
 await page.waitForTimeout(500);assert(await page.getByRole('checkbox',{name:'Melody / Lead (saved analysis)',exact:true}).isDisabled());receipt.checks.push('Similarly titled full song has no eligible Lead cache; no title-based substitution');
 assert.deepEqual(receipt.errors,[]);receipt.status='PASS';
}catch(e){receipt.status='FAIL';receipt.errors.push(e.stack);await page.screenshot({path:root+'/lead-failure.png'});process.exitCode=1;}
finally{await browser.close();await writeFile(root+'/lead-verification.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));}
