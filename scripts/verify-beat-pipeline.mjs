import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { chromium } from '@playwright/test';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const folder=resolve(repo,'scratch/whiplash-pipeline-proof'),built=resolve(folder,'built');
const benchmark=resolve(repo,'scratch/whiplash-benchmark');
const manifest=JSON.parse(await readFile(resolve(benchmark,'manifest.json'),'utf8'));
const inputs=(process.env.KORA_BEAT_PIPELINE_INPUTS||'W1,W2,W3,mono,trap').split(',');
const delaySeconds=Number(process.env.KORA_BEAT_PIPELINE_DELAY_SECONDS||0);
assert(Number.isFinite(delaySeconds)&&delaySeconds>=0&&delaySeconds<=.5);
const resultName=delaySeconds?'result-buffered.json':'result.json';
const model=JSON.parse(await readFile(resolve(repo,'extensions/kanban-music/generated/percussion/percussion.json'),'utf8'));
assert.equal(createHash('sha256').update(await readFile(resolve(repo,'extensions/kanban-music/generated/percussion/percussion.onnx'))).digest('hex'),model.sha256);
await mkdir(folder,{recursive:true});
await writeFile(resolve(folder,'index.html'),'<!doctype html><title>Private production pipeline diagnostic</title><div id="grid" style="width:520px"></div><script type="module" src="../../scripts/beat-pipeline-proof.tsx"></script>');
await build({root:folder,configFile:resolve(repo,'vite.config.ts'),logLevel:'error',
  build:{outDir:built,copyPublicDir:false,emptyOutDir:true}});
const server=createServer(async(request,response)=>{
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    let file;
    if(pathname.startsWith('/pcm/')) {
      const excerpt=manifest.excerpts.find(e=>e.input===pathname.slice(5));
      if(!excerpt)throw Error('Unknown excerpt');file=resolve(benchmark,excerpt.pcm);
    }else{
      file=resolve(built,'.'+(pathname==='/'?'/index.html':pathname));
      if(!file.startsWith(built+sep))throw Error('Outside diagnostic root');
    }
    response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
      '.css':'text/css','.json':'application/json','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream');
    response.end(await readFile(file));
  }catch{response.writeHead(404);response.end();}
});
let browser;
try{
  await new Promise((done,fail)=>{server.once('error',fail);server.listen(1432,'127.0.0.1',done);});
  console.log(JSON.stringify({pid:process.pid,port:1432,project:repo,command:'node scripts/verify-beat-pipeline.mjs'}));
  browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
  const results=[],pageErrors=[];
  for(const input of inputs) {
    const fixture=manifest.excerpts.find(e=>e.input===input);assert(fixture,'Unknown input');
    assert.equal(createHash('sha256').update(await readFile(resolve(benchmark,fixture.pcm))).digest('hex'),fixture.pcmSha256);
    const page=await browser.newPage();page.on('pageerror',error=>pageErrors.push(error.message));
    try{
      await page.goto('http://127.0.0.1:1432/');
      const result=await page.evaluate(([input,delaySeconds])=>window.provePipeline('/pcm/'+input,true,delaySeconds),[input,delaySeconds]);
      result.input=input;result.pcmSha256=fixture.pcmSha256;result.sourceSha256=fixture.sourceSha256;
      results.push(result);
      await writeFile(resolve(folder,resultName),JSON.stringify({browser:await browser.version(),modelSha256:model.sha256,results,pageErrors},null,2));
      console.log(JSON.stringify({input,events:result.events.length,visible:result.events.filter(e=>Number.isFinite(e.visibleAudioTime)).length,
        drops:result.events.filter(e=>e.firstDrop).length,untraced:result.events.filter(e=>!e.traceId).length,failures:result.failures,evicted:result.telemetryEvicted}));
      assert.equal(result.telemetryEvicted,0,'Trace ring overflow: stage attribution incomplete');
      assert.deepEqual(result.failures,[]);
    }finally{await page.close();}
  }
  assert.deepEqual(pageErrors,[]);
}finally{await browser?.close();if(server.listening)await new Promise(done=>server.close(done));}
