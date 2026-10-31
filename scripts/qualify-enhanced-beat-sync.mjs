// Usage: build the isolated qualification app first (see plans/261101-0030-release-0.1.33/enhanced-beat-sync-contract.md),
// close any running Kora (port 47635), then: node scripts/qualify-enhanced-beat-sync.mjs → scratch/ebs/qualification.json
// Enhanced Beat Sync real-playback qualification.
// Owned processes (all closed in finally): a song server (5174), an isolated qualification Kora (debug build, own
// identifier/data, WebView2 debug port 9224) and one Playwright Chromium with a temporary profile and Companion 0.3.31.
// The Companion's offscreen output is tapped passively (an AnalyserNode beside every connection to the speakers).
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chromium} from '@playwright/test';

const seconds=90,rate=44100;
// A steady 440 Hz tone with a 1 kHz click every 500 ms; B is 660 Hz so a track change is visible.
function wav(freq){const n=seconds*rate,b=Buffer.alloc(44+n*2);b.write('RIFF',0);b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);
  b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);
  for(let i=0;i<n;i++){const t=i/rate,click=(t%0.5)<0.004?0.5*Math.sin(2*Math.PI*1000*t):0;b.writeInt16LE(Math.round(32767*(0.3*Math.sin(2*Math.PI*freq*t)+click)),44+i*2);}return b;}
const tracks={'/a.wav':wav(440),'/b.wav':wav(660)};
const server=createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Qualification tone</title><audio id="a" src="/a.wav" preload="auto"></audio><button id="play">Play</button><script>play.onclick=()=>a.play()</script>');return;}
  const body=tracks[req.url];if(!body){res.statusCode=404;res.end();return;}
  const m=/bytes=(\d+)-(\d*)/.exec(req.headers.range||''),s=m?+m[1]:0,e=m&&m[2]?+m[2]:body.length-1;
  res.writeHead(m?206:200,{'Content-Type':'audio/wav','Accept-Ranges':'bytes','Content-Length':e-s+1,...(m?{'Content-Range':`bytes ${s}-${e}/${body.length}`}:{})});res.end(body.subarray(s,e+1));
});
const log=[];const note=(stage,detail={})=>{const row={at:Date.now(),stage,...detail};log.push(row);console.log(JSON.stringify(row));};
let kora,context,profile;
try{
  await new Promise(done=>server.listen(5174,'127.0.0.1',done));
  kora=spawn(resolve('src-tauri/target/debug/kora.exe'),[],{env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9224'},stdio:'ignore'});
  note('kora-started',{pid:kora.pid});
  profile=await mkdtemp(join(tmpdir(),'kora-ebs-'));
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:false,ignoreDefaultArgs:['--disable-extensions','--mute-audio'],
    args:['--enable-unsafe-extension-debugging','--no-first-run','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9333']});
  const cdp=await context.browser().newBrowserCDPSession();
  // Tap the offscreen document before its audio graph exists, over a raw flat CDP connection.
  const version=await (await fetch('http://127.0.0.1:9333/json/version')).json();
  const raw=new WebSocket(version.webSocketDebuggerUrl);await new Promise((done,fail)=>{raw.onopen=done;raw.onerror=fail;});
  let rawId=100;const waiters=new Map();
  const rawSend=(method,params={},sessionId)=>new Promise(done=>{const id=++rawId;waiters.set(id,done);raw.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  let tap;
  const tapSource=`(()=>{if(window.__tapInstalled)return 'already';window.__tapInstalled=true;window.__rms=[];const taps=[];const connect=AudioNode.prototype.connect;
    AudioNode.prototype.connect=function(target,...rest){if(target instanceof AudioDestinationNode){const a=this.context.createAnalyser();a.fftSize=512;connect.call(this,a);taps.push({a,buf:new Float32Array(512)});}return connect.call(this,target,...rest);};
    setInterval(()=>{let e=0,n=0;for(const t of taps){t.a.getFloatTimeDomainData(t.buf);for(const v of t.buf)e+=v*v;n=t.buf.length;}window.__rms.push([Date.now(),n?Math.sqrt(e/n):0,taps.length]);if(window.__rms.length>60000)window.__rms.shift();},10);return 'installed';})()`;
  raw.onmessage=async({data})=>{const m=JSON.parse(data);if(m.id&&waiters.has(m.id)){waiters.get(m.id)(m.result);waiters.delete(m.id);return;}
    if(m.method==='Target.attachedToTarget'){const {sessionId,targetInfo}=m.params;note('attached',{type:targetInfo.type,url:targetInfo.url.slice(0,80)});
      if(targetInfo.type==='other'){tap=sessionId;setTimeout(async()=>{const r=await rawSend('Runtime.evaluate',{expression:tapSource,returnByValue:true},sessionId);note('offscreen-tap',{result:r?.result?.value??JSON.stringify(r).slice(0,120)});},400);}
      if(targetInfo.type==='service_worker'){await rawSend('Runtime.enable',{},sessionId);workerSession=sessionId;}
      await rawSend('Runtime.runIfWaitingForDebugger',{},sessionId);}
    if(m.sessionId&&m.sessionId===workerSession&&m.method==='Runtime.exceptionThrown')note('worker-exception',{text:JSON.stringify(m.params.exceptionDetails).slice(0,300)});
    if(m.sessionId&&m.sessionId===workerSession&&m.method==='Runtime.consoleAPICalled'&&(['error','warning'].includes(m.params.type)||String(m.params.args?.[0]?.value||'').startsWith('EBS')))note('worker-console',{type:m.params.type,text:m.params.args.map(a=>a.value??a.description).join(' ').slice(0,300)});};
  let workerSession;
  await rawSend('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true,filter:[{type:'tab',exclude:true},{type:'browser',exclude:true},{type:'page',exclude:true},{}]});
  const {id}=await cdp.send('Extensions.loadUnpacked',{path:resolve('src-tauri/generated/music-companion/extension')});
  note('companion-loaded',{id});
  const source=await context.newPage();await source.exposeFunction('__media',(type,t)=>note('media-'+type,{t}));await source.goto('http://127.0.0.1:5174/');
  await source.evaluate(()=>{for(const type of ['play','pause','seeking','seeked','emptied'])a.addEventListener(type,()=>window.__media(type,a.currentTime.toFixed(2)));});await source.click('#play');note('source-playing');
  // Kora: connect over WebView2 CDP, open the Beat grid and turn the setting on through the dock UI.
  let app;
  for(let i=0;i<60&&!app;i++){try{const b=await chromium.connectOverCDP('http://127.0.0.1:9224');app={browser:b,page:b.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('http://tauri.localhost'))};if(!app.page){await b.close();app=undefined;}}catch{}if(!app)await new Promise(d=>setTimeout(d,1000));}
  if(!app)throw Error('Qualification Kora did not expose its window.');
  const page=app.page;note('kora-connected');
  // Start every run from the default: Enhanced Beat Sync off.
  await page.evaluate(()=>{localStorage.removeItem('kora.music.enhancedBeatSync.v1');window.dispatchEvent(new Event('kora:enhanced-beat-sync'));});
  await page.getByRole('tab',{name:'Beat grid',exact:true}).click();
  const target=(await cdp.send('Target.getTargets',{filter:[{type:'tab'}]})).targetInfos.find(t=>t.url==='http://127.0.0.1:5174/');
  await source.bringToFront();await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});note('companion-clicked');
  await page.waitForTimeout(1500);await page.getByRole('button',{name:'Dock settings'}).click();await page.waitForTimeout(500);
  await page.getByRole('checkbox',{name:/Line the Beat Grid up/}).click();await page.waitForTimeout(500);await page.screenshot({path:'scratch/ebs/settings.png'});
  await page.getByRole('button',{name:'Turn on',exact:true}).click();note('setting-on');
  await page.getByRole('button',{name:'Dock settings'}).click();
  await page.getByRole('tab',{name:'Music',exact:true}).click();
  const status=()=>page.getByRole('status',{name:'Enhanced Beat Sync status'}).innerText({timeout:1500}).catch(()=>'?');
  const until=async(test,ms)=>{const end=Date.now()+ms;while(Date.now()<end){if(await test())return true;await new Promise(d=>setTimeout(d,100));}return false;};
  const samples=[];const pull=async()=>{if(!tap)return;const r=await rawSend('Runtime.evaluate',{expression:'JSON.stringify((window.__rms||[]).splice(0))',returnByValue:true},tap);if(!pull.logged){pull.logged=true;note('pull-debug',{r:JSON.stringify(r).slice(0,200)});}try{samples.push(...JSON.parse(r?.result?.value||'[]'));}catch(e){note('pull-error',{e:String(e)});}};
  const puller=setInterval(()=>void pull(),1000);
  const waitOn=async(label,ms)=>{const ok=await until(async()=>(await status())==='On',ms);note(label,{on:ok,value:await status()});return ok;};
  const pauseFor=ms=>new Promise(d=>setTimeout(d,ms));
  await waitOn('activated',30000);await pauseFor(3000);
  await source.evaluate(()=>{a.currentTime=40;});note('seek');await waitOn('after-seek',8000);await pauseFor(3000);
  await source.evaluate(()=>{a.src='/b.wav';a.play();});note('track-change');await waitOn('after-track',10000);await pauseFor(3000);
  await source.evaluate(()=>a.pause());note('pause');await pauseFor(2000);await source.evaluate(()=>a.play());note('resume');await waitOn('after-resume',8000);await pauseFor(3000);
  await page.getByRole('button',{name:'Dock settings'}).click();await page.waitForTimeout(400);await page.getByRole('checkbox',{name:/Line the Beat Grid up/}).uncheck();note('setting-off');
  await pauseFor(3000);await pull();clearInterval(puller);
  const worker=context.serviceWorkers().find(w=>w.url().endsWith('/background.js'));
  note('captured-tabs',{tabs:await worker?.evaluate(async()=>(await chrome.tabCapture.getCapturedTabs()).map(t=>t.status)).catch(()=>null)});
  const rms=JSON.stringify(samples);
  raw.close();
  await writeFile((await import('node:fs')).mkdirSync('scratch/ebs',{recursive:true})||'scratch/ebs/qualification.json',JSON.stringify({log,rms:JSON.parse(rms||'[]')}));
  note('saved',{samples:JSON.parse(rms||'[]').length});
  await app.browser.close();
}finally{
  await context?.close().catch(()=>{});
  if(profile)await rm(profile,{recursive:true,force:true}).catch(()=>{});
  if(kora&&kora.exitCode===null){spawnSync('taskkill',['/PID',String(kora.pid)]);await new Promise(d=>setTimeout(d,3000));if(kora.exitCode===null)kora.kill();}
  server.close();
}
