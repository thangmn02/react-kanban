// Own isolated Edge profile. Private real-media replay, not a production route.
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
const { values } = parseArgs({ options: { bundle: { type: 'string' }, audio: { type: 'string' }, output: { type: 'string' }, throttle: { type: 'string' }, fixture: { type:'string' }, seconds: {type:'string'}, lifecycle:{type:'boolean'}, 'tab-switch': {type:'boolean'} } });
const root = resolve(import.meta.dirname, '..'), directory = join(root, 'src-tauri/target/percussion-latency');
const extension = resolve(root, values.bundle || 'src-tauri/target/percussion-latency/instrumented-baseline');
const fixtureDuration=values.fixture ? JSON.parse(await readFile(join(root,'src-tauri/target/percussion-closure/audio/manifest.json'),'utf8')).find(t=>t.input===values.fixture)?.duration : undefined;
await mkdir(directory, { recursive: true });
await writeFile(join(extension, 'timing-pcm-probe.js'), `
class TimingPCMProbe extends AudioWorkletProcessor {
 constructor(){super();this.data=new Float32Array(88200);this.used=0;this.start=undefined;}
 process(inputs){const channels=inputs[0];if(!channels?.length||this.used>=this.data.length)return true;
 this.start??=currentFrame/sampleRate;
 for(let i=0;i<channels[0].length&&this.used<this.data.length;i++){let value=0;for(const channel of channels)value+=channel[i]/channels.length;this.data[this.used++]=value;}
 if(this.used===88200){this.port.postMessage({start:this.start,data:this.data},[this.data.buffer]);this.used++;}return true;}
}registerProcessor('timing-pcm-probe',TimingPCMProbe);`);
const run = Date.now();
await writeFile(join(directory, 'harness.html'), `<html><body><div id="root" style="--pulse-delay:0s;--hue-delay:0s"></div><script type="module" src="./harness.tsx?run=${run}"></script></body></html>`);
await writeFile(join(directory, 'harness.tsx'), `
import React from 'react'; import {createRoot} from 'react-dom/client';
import SemanticBeatPattern from '../../../src/features/music/SemanticBeatPattern';
import {useMusicBeatSync} from '../../../src/features/music/useMusicBeatSync';
import {beatTelemetry} from '../../../extensions/kanban-music/beat-telemetry.js';
import '../../../src/components/focus/floatingFocus.css';
beatTelemetry.enable(); beatTelemetry.clear();
let sub, sequence=0; const traces=[]; const session={id:'fixture',title:'Private real-media timing check',artist:'',source:'',playing:true,paused:false};
const options={demand:${Boolean(values.fixture)},${values.fixture ? `asset:{provider:'soundcloud',id:${JSON.stringify('private-local/'+values.fixture)}},duration:${fixtureDuration},` : ''}capabilities:{tier:'tab-capture',captureClock:'output-clock-capable'}};
const clockListener=()=>{};
window.addEventListener('message',e=>{const r=e.data;if(e.source!==window||r?.direction!=='app-to-extension')return;sub=r.subscriptionId;
window.postMessage({channel:r.channel,direction:'extension-to-app',requestId:r.requestId,ok:true},location.origin);});
const root=createRoot(document.getElementById('root'));
function Harness(){return <SemanticBeatPattern session={session} beat={useMusicBeatSync(session.id,clockListener,options)} melodyEnabled={false}/>;}
window.__delivery=(event)=>{window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{channel:'kanban-music-v1',direction:'extension-event',event:'beat',sessionId:session.id,subscriptionId:sub,emittedAt:Date.now(),...event,...(event.kind==='onset'?{sequence:++sequence}:{})}}));};
const mutations=[];const frames=[];
const collect=node=>node.nodeType===1?[...(node.matches('[data-beat-trace]')?[node]:[]),...node.querySelectorAll('[data-beat-trace]')]:[];
new MutationObserver(records=>{for(const record of records)for(const node of record.removedNodes)for(const cell of collect(node))mutations.push({id:cell.dataset.beatTrace,at:Date.now()});}).observe(document.getElementById('root'),{subtree:true,childList:true});
let previous='';function painted(){const ids=[...document.querySelectorAll('[data-beat-trace]')].map(e=>e.dataset.beatTrace);const key=ids.join(',');if(key!==previous){frames.push({at:Date.now(),ids});previous=key;}requestAnimationFrame(painted);}requestAnimationFrame(painted);
window.__visual=()=>({mutations,frames});window.__trace=()=>traces.concat(beatTelemetry.snapshot().records);
setInterval(()=>{traces.push(...beatTelemetry.snapshot().records);beatTelemetry.clear();},250);
root.render(<Harness/>);window.__ready=()=>Boolean(sub);
`);
const context = await chromium.launchPersistentContext(join(directory, 'browser-profile'), {
  channel: 'msedge', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--autoplay-policy=no-user-gesture-required'],
});
const switchTimers = [], tabSwitches = [];
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
  const id = new URL(worker.url()).host;
  const ui = await context.newPage();
  ui.on('framenavigated', frame => { if (frame === ui.mainFrame()) console.log(JSON.stringify({uiNavigation:frame.url()})); });
  const uiMetrics = await context.newCDPSession(ui); await uiMetrics.send('Performance.enable');
  const errors=[]; ui.on('pageerror', error=>errors.push(error.message));
  await ui.goto(`http://127.0.0.1:5173/src-tauri/target/percussion-latency/harness.html?run=${run}`);
  await ui.waitForFunction(()=>window.__ready?.());
  const page = await context.newPage();
  const pageMetrics = await context.newCDPSession(page); await pageMetrics.send('Performance.enable');
  await page.exposeBinding('probeProgress',(_,progress)=>console.log(JSON.stringify({progress})));
  const bridgeDrops=[];
  await page.exposeBinding('deliver', async (_, event) => {
    try {
      const delivered=await ui.evaluate(e=>{if(typeof window.__delivery!=='function')return false;window.__delivery(e);return true;},event);
      if(!delivered)bridgeDrops.push({at:Date.now(),kind:event.kind,reason:'probe-ui-reloading'});
    }catch(error){bridgeDrops.push({at:Date.now(),kind:event.kind,reason:'probe-ui-context',message:String(error)});}
  });
  await page.goto(`chrome-extension://${id}/setup.html`);
  await ui.bringToFront();
  if (values.throttle) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(values.throttle) });
  }
  const audio = (await readFile(resolve(root, values.audio || 'src-tauri/target/learned-percussion/browser-control.wav'))).toString('base64');
  if (values['tab-switch']) for (const [delay, target] of [[8000, page], [14000, ui], [18000, page], [24000, ui]]) {
    switchTimers.push(setTimeout(() => {
      void (async () => {
        await target.bringToFront();
        tabSwitches.push({ at: Date.now(), target: target === ui ? 'grid' : 'audio',
          uiHidden: await ui.evaluate(() => document.hidden) });
      })().catch(error => tabSwitches.push({ at: Date.now(), error: String(error) }));
    }, delay));
  }
  const result = await page.evaluate(async ({audio,seconds,lifecycle}) => {
    const {createCaptureEngine}=await import('./capture-engine.js');
    const {createPercussionRuntime}=await import('./percussion-runtime.js');
    const {playbackTiming}=await import('./beat-timing.js');
    const {beatTelemetry}=await import('./beat-telemetry.js');beatTelemetry.enable();beatTelemetry.clear();
    const media=document.createElement('audio');media.controls=true;document.body.append(media);
    media.src=URL.createObjectURL(new Blob([Uint8Array.from(atob(audio),c=>c.charCodeAt(0))],{type:'audio/wav'}));
    await new Promise((resolve,reject)=>{media.onloadedmetadata=resolve;media.onerror=reject;});
    const diagnostics=[], raw=[], capture=[], pending=[]; let audioContext, resolveReady, probe, capturedPCM;
    const ready=new Promise(resolve=>resolveReady=resolve);
    let generation=0;
    media.addEventListener('seeking',()=>generation++);
    const clock=()=>({currentTime:media.currentTime,sampledAt:Date.now(),playbackRate:media.playbackRate,playing:!media.paused,paused:media.paused,seeking:media.seeking,buffering:false,generation});
    const forward=e=>{capture.push(...beatTelemetry.snapshot().records);beatTelemetry.clear();pending.push(window.deliver(e));};
    const engine=createCaptureEngine({monitorOnly:true,getUserMedia:async()=>media.captureStream(),
      createAudioContext:()=>audioContext=new AudioContext({sampleRate:44100}),
      createPercussion:async args=>{await args.context.audioWorklet.addModule('./timing-pcm-probe.js');
        probe=new AudioWorkletNode(args.context,'timing-pcm-probe');probe.port.onmessage=({data})=>capturedPCM={start:data.start,data:[...data.data]};args.source.connect(probe);probe.connect(args.context.destination);
        const runtime=await createPercussionRuntime({...args,onDiagnostic:batch=>diagnostics.push(batch),
        onEvent:e=>{raw.push({...e,producedAt:Date.now(),deliveredAudioTime:audioContext.currentTime});args.onEvent(e);}});resolveReady(Boolean(runtime));return runtime;},
      onAudible:id=>forward({kind:'sync.state',mode:'capture',captureId:id}),onStop:()=>{},
      onBeat:(captureId,bands,telemetry,timing)=>forward({kind:'onset',captureId,bands,telemetry,...playbackTiming(clock(),timing)}),
      onTempo:()=>{},onTempoTick:()=>{}});
    if(!await engine.start('fixture','fixture-capture')||!await ready)throw new Error('Learned capture unavailable');
    const bytes=Uint8Array.from(atob(audio),c=>c.charCodeAt(0));const buffer=await audioContext.decodeAudioData(bytes.buffer);
    const memory=[];const lease=setInterval(()=>engine.renew('fixture-capture'),1000);
    const tick=setInterval(()=>{forward({kind:'clock',clock:clock()});memory.push(performance.memory?.usedJSHeapSize??null);},50);
    const progress=seconds?setInterval(()=>void window.probeProgress({elapsedSeconds:Math.round((Date.now()-startClock.at)/1000),
      events:raw.length,queueMax:Math.max(0,...diagnostics.map(d=>d.queueDepth)),heapMB:(performance.memory?.usedJSHeapSize??0)/1048576}),60000):undefined;
    await media.play();const startClock={audioTime:audioContext.currentTime,mediaTime:media.currentTime,at:Date.now()};forward({kind:'clock',clock:clock()});forward({kind:'sync.state',mode:'capture',captureId:'fixture-capture'});
    const actions=[]; const timers=[];
    const action=(at,fn)=>timers.push(setTimeout(()=>{fn();actions.push({at:Date.now(),mediaTime:media.currentTime,generation,paused:media.paused});forward({kind:'clock',clock:clock()});},at));
    if(lifecycle){action(3000,()=>media.pause());action(3600,()=>void media.play());action(6000,()=>media.currentTime=2);
      action(8000,()=>media.currentTime=8);action(10000,()=>media.playbackRate=1.25);
      action(12000,()=>media.playbackRate=1);}
    if(seconds){media.loop=true;await new Promise(resolve=>setTimeout(resolve,seconds*1000));media.pause();}
    else await new Promise(resolve=>{media.onended=resolve;});
    timers.forEach(clearTimeout);await new Promise(resolve=>setTimeout(resolve,350));
    clearInterval(progress);clearInterval(tick);clearInterval(lease);probe?.disconnect();engine.stop();await Promise.all(pending);
    capture.push(...beatTelemetry.snapshot().records);const duration=seconds||buffer.duration;
    URL.revokeObjectURL(media.src);
    return {duration,mediaDuration:buffer.duration,actions,raw,diagnostics,capture,memory,startClock,capturedPCM,browser:navigator.userAgent,
      limitation:'Controlled local HTMLMediaElement.captureStream with bridge payload replay. Not physical speaker/display measurement or the user music tab.'};
  }, {audio,seconds:Number(values.seconds||0),lifecycle:Boolean(values.lifecycle)});
  await ui.waitForTimeout(100);
  result.ui=await ui.evaluate(()=>window.__trace());result.visual=await ui.evaluate(()=>window.__visual());result.errors=errors;
  result.performance={ui:await uiMetrics.send('Performance.getMetrics'),capture:await pageMetrics.send('Performance.getMetrics')};
  result.bridgeDrops=bridgeDrops; result.tabSwitches=tabSwitches;
  result.audioSha256=createHash('sha256').update(Buffer.from(audio,'base64')).digest('hex');
  result.modelSha256=JSON.parse(await readFile(join(extension,'generated/percussion/percussion.json'),'utf8')).sha256;
  const percentile=(a,p)=>a.length?[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))]:null;
  const stages=['EVENT_COMMITTED','EVENT_RENDERED'];
  const summary={events:result.raw.length, duration:result.duration, errors, throttle:Number(values.throttle||1),
    runtime:{median:percentile(result.diagnostics.map(d=>d.durationMs),.5),p95:percentile(result.diagnostics.map(d=>d.durationMs),.95)},
    queueMax:Math.max(0,...result.diagnostics.map(d=>d.queueDepth)),
    stages:Object.fromEntries(stages.map(stage=>{const rows=result.ui.filter(e=>e.stage===stage&&e.source==='onset'&&['kick','snare','hat'].includes(e.type));return [stage,{count:rows.length,median:percentile(rows.map(e=>e.offsetMs),.5),p95:percentile(rows.map(e=>e.offsetMs),.95)}];})),
    drops:result.ui.filter(e=>e.stage==='EVENT_DROPPED').reduce((out,e)=>(out[e.reason]=(out[e.reason]||0)+1,out),{}),
    workerBusyPercent:100*result.diagnostics.reduce((sum,d)=>sum+d.durationMs,0)/(result.duration*1000),
    heapMB:percentile(result.memory.filter(Number.isFinite),.95)/1048576};
  result.summary=summary;await writeFile(resolve(root,values.output||'src-tauri/target/percussion-latency/browser-delivery.json'),JSON.stringify(result));
  console.log(JSON.stringify(summary));if(errors.length||!summary.stages.EVENT_COMMITTED.count)throw new Error('Real media to DOM path failed');
}finally{switchTimers.forEach(clearTimeout);await context.close();}
