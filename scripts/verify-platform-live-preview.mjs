import assert from 'node:assert/strict';
import {resolve} from 'node:path';

// This helper runs only in the verification harness's owned browser profile.
export async function verifyPlatformLivePreview({context,cdp,app,sourcePage,extensionId,worker,folder,result,save}) {
  await app.evaluate(()=>{
    window.platformVisuals={visible:0};
    document.addEventListener('animationstart',event=>{
      const cell=event.target;if(!cell.classList.contains('semantic-beat-flash'))return;
      const style=getComputedStyle(cell),rect=cell.getBoundingClientRect();
      if(Number(style.opacity)>.1&&rect.top>=0&&rect.bottom<=innerHeight&&rect.width>0&&rect.left>=0&&rect.right<=innerWidth)
        window.platformVisuals.visible++;
    });
  });
  const enable=async()=>{
    const control=app.getByRole('region',{name:'Live instrument preview'});
    for(const name of ['I have permission to analyze this captured tab audio.','I can hear the captured tab normally.',
      'I accept late or incorrect instrument flashes in this private test.'])
      await control.getByRole('checkbox',{name,exact:true}).check();
    await control.getByRole('button',{name:'Enable live preview (no audio delay)',exact:true}).click();
    await app.waitForFunction(()=>window.candidate?.selected?.syncState?.capability?.mode==='experimental-live',null,{timeout:15000});
    await app.locator('.candidate-grid').scrollIntoViewIfNeeded();
  };
  const snapshot=async(captureRequired=true)=>{
    const value=await app.evaluate(()=>({status:window.candidate.selected.syncState.capability,
      onsets:window.candidate.beat.onsets,visible:window.platformVisuals.visible}));
    const diagnostics=await worker.evaluate(()=>chrome.runtime.sendMessage({target:'beat-offscreen',kind:'diagnostics'}));
    assert.equal(value.status.bufferMs,0);
    if(captureRequired)assert(diagnostics.health,'Expected an active captured output');
    if(diagnostics.health)assert.equal(diagnostics.health.bufferMs,0);
    assert.equal(value.status.allowSemantic,false);value.outputBufferMs=diagnostics.health?.bufferMs??null;return value;
  };
  assert.equal((await snapshot()).status.allowTypedPreview,false);
  await app.bringToFront();await enable();
  await app.waitForFunction(()=>window.platformVisuals.visible>=3,null,{timeout:20000});
  result.liveAudio=await snapshot();assert.equal(result.liveAudio.status.mode,'experimental-live');
  await app.screenshot({path:resolve(folder,'platform-live-audio.png')});await save();
  await app.getByRole('button',{name:'Disable live preview',exact:true}).click();
  await app.waitForFunction(()=>!window.candidate.selected.syncState.capability.allowTypedPreview);
  result.liveDisabled=await snapshot();
  await enable();
  await sourcePage.locator('audio').evaluate(audio=>{audio.currentTime+=2;});
  await app.waitForFunction(()=>!window.candidate.selected.syncState.capability.allowTypedPreview);
  result.liveSeekRevoked=await snapshot(false);await save();
  await sourcePage.close();
  await app.waitForFunction(()=>!window.candidate?.selected,null,{timeout:15000});

  const video=await context.newPage();
  await video.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw',{timeout:30000,waitUntil:'domcontentloaded'});
  await video.locator('video').first().waitFor({timeout:20000});
  // This public video is a short real capture/routing check, not accuracy data.
  await video.locator('video').first().evaluate(async media=>{media.muted=false;media.volume=1;media.currentTime=0;await media.play();});
  await video.waitForFunction(()=>{const media=document.querySelector('video');return media&&!media.paused&&media.currentTime>.2&&media.readyState>=3;},null,{timeout:15000});
  await app.waitForFunction(()=>window.candidate?.selected?.source?.endsWith('youtube.com')&&window.candidate.selected.syncState?.capability?.clockHealthy,null,{timeout:15000});
  const target=(await cdp.send('Target.getTargets',{filter:[{type:'tab'}]})).targetInfos.find(item=>item.url.startsWith('https://www.youtube.com/watch'));
  assert(target,'YouTube tab unavailable');await video.bringToFront();
  await cdp.send('Extensions.triggerAction',{id:extensionId,targetId:target.targetId});
  await app.waitForFunction(()=>window.candidate.selected.syncState?.mode==='capture',null,{timeout:20000});
  result.youtubeBefore=await snapshot();assert.equal(result.youtubeBefore.status.allowTypedPreview,false);
  assert.equal(result.youtubeBefore.status.bufferEligible,false);
  await app.bringToFront();const before=await app.evaluate(()=>window.platformVisuals.visible);
  await enable();await new Promise(resolve=>setTimeout(resolve,1500));
  result.youtubeLive=await snapshot();assert.equal(result.youtubeLive.status.mode,'experimental-live');
  assert.equal(result.youtubeLive.status.sourceKind,'video');assert.equal(result.youtubeLive.status.bufferEligible,false);
  result.youtubeLive.newVisibleFlashes=result.youtubeLive.visible-before;
  result.youtubeLive.media=await video.locator('video').first().evaluate(media=>({playing:!media.paused,currentTime:media.currentTime,readyState:media.readyState,muted:media.muted}));
  assert(result.youtubeLive.media.playing);await app.screenshot({path:resolve(folder,'platform-live-youtube.png')});await save();
  await video.locator('video').first().evaluate(media=>media.pause());
  await app.waitForFunction(()=>!window.candidate.selected.syncState.capability.allowTypedPreview);
  result.youtubePauseRevoked=await app.evaluate(()=>window.candidate.selected.syncState.capability);
  assert.equal(result.youtubePauseRevoked.bufferMs,0);await save();await video.close();
}
