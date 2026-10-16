import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {createServer} from 'node:http';
import {build} from 'vite';
import {chromium} from '@playwright/test';
import {installHatVisibilityObserver} from './hat-visibility-observer.js';
const root=process.cwd(),folder=resolve('scratch/hat-playback-discrepancy'),site=resolve(folder,'renderer');
await mkdir(folder,{recursive:true});
const entry=resolve(folder,'renderer-entry');await mkdir(entry,{recursive:true});
await writeFile(resolve(entry,'index.html'),'<title>Renderer-only Hat diagnostic</title><div id="root"></div><script type="module" src="../../../scripts/browser-hat-retrigger.tsx"></script>');
await build({root:entry,configFile:false,logLevel:'error',build:{outDir:site,emptyOutDir:true,minify:false}});
const server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://127.0.0.1').pathname;
  const file=resolve(site,'.'+(name==='/'?'/index.html':name));assert(file.startsWith(site+sep));
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
let browser;const result={rendererOnly:true,physicalVerified:false,humanPerceptionVerified:false,runs:[],errors:[]};
try{
 await new Promise((done,fail)=>{server.once('error',fail);server.listen(1433,'127.0.0.1',done);});
 console.log(JSON.stringify({pid:process.pid,port:1433,command:'node scripts/verify-hat-retrigger.mjs'}));
 browser=await chromium.launch({channel:'msedge',headless:true});result.browser=await browser.version();
 for(const reducedMotion of ['no-preference','reduce'])for(const mode of ['A','R'])for(const intervalMs of [20,30,50,80,125,200]){
  const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion});
  page.on('pageerror',e=>result.errors.push(e.message));await page.goto('http://127.0.0.1:1433/');
  await page.waitForFunction(()=>window.hatRenderer);await page.evaluate(m=>window.hatRenderer.setMode(m),mode);
  await page.waitForFunction(m=>document.querySelector('main').classList.contains('hat-transient-preview')===(m==='R'),mode);
  await page.evaluate(installHatVisibilityObserver);
  const run=await page.evaluate(gap=>window.hatRenderer.run(gap,0),intervalMs);
  run.samples=await page.evaluate(()=>window.hatSamples);Object.assign(run,{reducedMotion});
  const start=run.emitted[0].targetAt,end=run.emitted.at(-1).targetAt+250,samples=run.samples.filter(s=>s.at>=start&&s.at<=end);
  const visibleIds=new Set(samples.flatMap(s=>s.ids));let bright=false;
  run.visibleAttacks=[];for(const sample of samples){if(sample.level<=.3)bright=false;if(sample.level>=.5&&!bright){run.visibleAttacks.push(sample.at);bright=true;}}
  run.distinctVisibleIds=visibleIds.size;run.maxFrameGapMs=Math.max(...samples.slice(1).map((s,i)=>s.at-samples[i].at));
  assert.equal(run.emitted.length,6);assert(samples.length>10);
  result.runs.push(run);await writeFile(resolve(folder,'renderer-results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({mode,intervalMs,reducedMotion,ids:visibleIds.size,visibleRetriggers:run.visibleAttacks.length,maxFrameGapMs:run.maxFrameGapMs}));
  await page.close();
 }
 assert.deepEqual(result.errors,[]);
}finally{await browser?.close();if(server.listening)await new Promise(done=>server.close(done));}
