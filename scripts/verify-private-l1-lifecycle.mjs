import assert from 'node:assert/strict';

// Actual controlled source + existing UI/Companion. No fabricated event feed.
export async function verifyPrivateL1Lifecycle({app,source,context,cdp,extensionId,target,diagnostics}) {
  const checks=[],clock=()=>source.locator('audio').evaluate(a=>({time:a.currentTime,src:a.currentSrc,paused:a.paused,rate:a.playbackRate}));
  const live=app.getByRole('region',{name:'Live instrument preview'});
  const openControls=async()=>{
    await app.getByRole('tab',{name:'Music',exact:true}).click();
    const details=app.locator('details[aria-label="Private Beat Grid candidate"]');
    await details.waitFor({timeout:15000});
    if(!await details.evaluate(d=>d.open))await details.locator('summary').click();
  };
  const enable=async()=>{
    await openControls();
    await live.getByRole('combobox',{name:'Live detector',exact:true}).selectOption('L1-gap0');
    for(const name of ['I have permission to analyze this captured tab audio.','I can hear the captured tab normally.',
      'I accept late or incorrect instrument flashes in this private test.'])await live.getByRole('checkbox',{name,exact:true}).check();
    await live.getByRole('button',{name:'Enable live preview (no audio delay)',exact:true}).click({timeout:30000});
    await live.getByText(/LIVE SEMANTIC CANDIDATE/).waitFor({timeout:15000});
  };
  const quiet=async(reason)=>{
    await app.waitForTimeout(1200);const boundary=Date.now();await app.waitForTimeout(1000);
    const records=await app.evaluate(()=>window.__koraBeatTelemetry?.snapshot().records||[]);
    assert.equal(records.filter(r=>r.at>=boundary&&r.stage==='EVENT_ACCEPTED'&&r.source==='onset').length,0,reason);
  };
  await openControls();
  const before=await clock();
  await live.getByRole('combobox',{name:'Live detector',exact:true}).selectOption('L0');
  await app.getByText(/unverified-late-preview · adtof-onset-valley/).waitFor();
  const rolledBack=await clock();
  assert(rolledBack.time>=before.time);assert.equal(rolledBack.src,before.src);assert.equal(rolledBack.rate,1);assert.equal(rolledBack.paused,false);
  await live.getByRole('combobox',{name:'Live detector',exact:true}).selectOption('L1-gap0');
  await live.getByText(/LIVE SEMANTIC CANDIDATE/).waitFor();
  checks.push('Live L1 → L0 → L1 switches preserve the same audible source URL, advancing clock and 1x rate');
  await source.locator('audio').evaluate(a=>a.pause());
  await live.getByRole('button',{name:'Enable live preview (no audio delay)',exact:true}).waitFor();
  await quiet('No semantic accepts while paused');
  checks.push('Pause revokes preview and stops semantic acceptance after the clock settles');
  await source.locator('audio').evaluate(a=>a.play());
  await enable();await app.waitForTimeout(1500);
  checks.push('Resume requires a fresh source-bound preview activation');
  for(const time of [70,110]) {
    await source.locator('audio').evaluate((a,t)=>{a.currentTime=t;},time);
    await live.getByRole('button',{name:'Enable live preview (no audio delay)',exact:true}).waitFor({timeout:10000});
    await quiet('No old semantic accepts after seek before reactivation');
    await cdp.send('Extensions.triggerAction',{id:extensionId,targetId:target.targetId});
    await enable();await app.waitForTimeout(1200);
  }
  checks.push('Two seeks revoke preview, clear stale events, and reacquire capture through the existing toolbar grant');
  await source.locator('audio').evaluate(async a=>{const url=new URL(a.currentSrc);url.searchParams.set('l1-source-replacement','1');a.src=url.href;await a.play();});
  // A new media identity remounts the source-bound disclosure in its closed state.
  await app.waitForTimeout(500);await openControls();
  await live.getByRole('button',{name:'Enable live preview (no audio delay)',exact:true}).waitFor({timeout:10000});
  await quiet('Source replacement must not retain old typed preview');
  await cdp.send('Extensions.triggerAction',{id:extensionId,targetId:target.targetId});
  await enable();await app.waitForTimeout(1500);
  checks.push('Replacing the real controlled audio URL invalidates the previous preview and source generation');
  const visibilityBefore=await app.evaluate(()=>document.visibilityState);
  const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();
  await app.waitForTimeout(1500);const visibilityAway=await app.evaluate(()=>document.visibilityState);
  await app.bringToFront();await other.close();
  const visibilityAfter=await app.evaluate(()=>document.visibilityState);
  checks.push('Browser tab change exercised; recorded actual visibility states without claiming physical/minimized qualification');
  await app.screenshot({path:'scratch/low-latency-semantic/l1/private-l1-controls.png'});
  await app.getByRole('tab',{name:'Beat grid',exact:true}).click();await app.waitForTimeout(1800);
  await app.screenshot({path:'scratch/low-latency-semantic/l1/private-l1-grid.png'});
  const records=await app.evaluate(()=>window.__koraBeatTelemetry?.snapshot().records||[]);
  const accepted=records.filter(r=>r.stage==='EVENT_ACCEPTED'&&r.source==='onset'),ids=accepted.map(r=>r.id);
  assert.equal(ids.length,new Set(ids).size,'Duplicate accepted event IDs');
  assert(accepted.some(r=>r.type==='bass'),'Independent Bass must remain responsive');
  const background=await diagnostics();
  return {status:'PASS',checks,visibility:{before:visibilityBefore,away:visibilityAway,after:visibilityAfter},
    recentAccepted:accepted.length,duplicateAcceptedIds:0,independentBassObserved:true,
    lifecycleRecords:background.records.filter(r=>['CAPTURE_START','CAPTURE_STOP','CAPTURE_REPLACED','PREVIEW_REVOKED'].includes(r.stage)),
    finalClock:await clock(),scope:'Actual private Chrome/Kora controlled source. Functional consent routing only; no human hearing, provider-rights, acoustic or physical certification.'};
}
