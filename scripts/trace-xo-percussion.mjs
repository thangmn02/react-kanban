// Exact production feature/model/classifier evaluation on frozen private PCM.
// Accelerated inference is separate from real-time Companion delivery evidence.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from '@playwright/test';
import {temporalMatch} from './score-percussion-annotations.mjs';

const root=process.cwd(),folder=resolve(root,'scratch/xo-percussion-recovery');
const manifest=JSON.parse(await readFile(resolve(folder,'manifest.json'),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const config=JSON.parse(await readFile(resolve(root,'extensions/kanban-music/generated/percussion/percussion.json'),'utf8'));
assert.equal(digest(await readFile(resolve(root,'extensions/kanban-music/generated/percussion/percussion.onnx'))),config.sha256);
const ids=(process.env.KORA_XO_INPUTS||manifest.fixtures.map(f=>f.id).join(',')).split(',');
await mkdir(resolve(folder,'baseline-offline'),{recursive:true});
const server=createServer(async(request,response)=>{
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);let file;
    if(pathname==='/'){response.setHeader('Content-Type','text/html');response.end('<!doctype html><title>Private XO model trace</title>');return;}
    if(pathname.startsWith('/pcm/')){const fixture=manifest.fixtures.find(f=>f.id===pathname.slice(5));assert(fixture);file=resolve(folder,fixture.pcm);}
    else{file=resolve(root,'.'+pathname);assert(file.startsWith(resolve(root,'extensions/kanban-music')+sep));}
    response.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream');
    response.end(await readFile(file));
  }catch{response.writeHead(404);response.end();}
});
let browser;
try{
  await new Promise((done,fail)=>{server.once('error',fail);server.listen(1433,'127.0.0.1',done);});
  console.log(JSON.stringify({pid:process.pid,port:1433,command:'node scripts/trace-xo-percussion.mjs',root}));
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
  await page.goto('http://127.0.0.1:1433/');
  await page.evaluate(async()=>{
    const base='/extensions/kanban-music/';
    const ort=await import(base+'vendor/percussion/ort.wasm.min.mjs');ort.env.wasm.numThreads=1;
    ort.env.wasm.wasmPaths={mjs:new URL(base+'vendor/percussion/ort-wasm-simd-threaded.mjs',location.href).href,
      wasm:new URL(base+'vendor/percussion/ort-wasm-simd-threaded.wasm',location.href).href};
    const config=await (await fetch(base+'generated/percussion/percussion.json')).json();
    const session=await ort.InferenceSession.create(base+'generated/percussion/percussion.onnx',{executionProviders:['wasm']});
    const {PercussionFeatures}=await import(base+'percussion-features.js'),{PercussionClassifier}=await import(base+'percussion-classifier.js');
    window.tracePcm=async id=>{
      const pcm=new Float32Array(await (await fetch('/pcm/'+id)).arrayBuffer());
      const extractor=new PercussionFeatures(config),blocks=[],frames=[],activations=[],events=[],decisions=[],costs=[];
      const classifier=new PercussionClassifier(config.thresholds,{onsetGuided:true,diagnostics:true});
      const began=performance.now();
      for(let offset=0;offset<pcm.length/2;offset+=128){
        const length=Math.min(128,pcm.length/2-offset),left=new Float32Array(length),right=new Float32Array(length);
        for(let i=0;i<length;i++){left[i]=pcm[(offset+i)*2];right[i]=pcm[(offset+i)*2+1];}
        extractor.push([left,right],offset/config.sampleRate,block=>blocks.push(block));
      }
      const featureMs=performance.now()-began;let count=0;
      for(const block of blocks)for(let i=0;i<block.times.length;i++){
        frames.push({data:block.data.slice(i*config.bins,(i+1)*config.bins),time:block.times[i]});
        if(frames.length>config.windowFrames)frames.shift();if(++count%config.stepFrames)continue;
        const input=new Float32Array(config.windowFrames*config.bins),offset=config.windowFrames-frames.length;
        for(let j=0;j<frames.length;j++)input.set(frames[j].data,(offset+j)*config.bins);
        const inferenceAt=performance.now();const result=await session.run({[config.input]:new ort.Tensor('float32',input,[1,config.windowFrames,config.bins,1])});
        costs.push(performance.now()-inferenceAt);
        const from=config.windowFrames-config.rightContext-config.stepFrames,scores=result[config.output].data;
        for(let j=from;j<from+config.stepFrames;j++){
          const source=frames[j-offset];if(!source)continue;
          const values=Array.from(scores.slice(j*5,(j+1)*5)),decision=classifier.push(values,source.time);
          activations.push({audioTime:source.time,scores:values});
          events.push(...decision.events.map(event=>({...event,decisionAudioTime:source.time})));
          decisions.push(...(decision.decisions||[]));
        }
      }
      return {id,featureMs,inferenceMs:costs.reduce((sum,value)=>sum+value,0),inferenceCalls:costs.length,
        inferenceMaxMs:Math.max(...costs),features:blocks.length*config.stepFrames,activations,events,decisions};
    };
  });
  const summary=[];
  for(const id of ids){
    const fixture=manifest.fixtures.find(f=>f.id===id);assert(fixture);assert.equal(digest(await readFile(resolve(folder,fixture.pcm))),fixture.pcmSha256);
    const result=await page.evaluate(id=>window.tracePcm(id),id);
    result.sourceSha256=fixture.sourceSha256||null;result.pcmSha256=fixture.pcmSha256;result.modelSha256=config.sha256;
    const start=fixture.analysisStart||0,end=fixture.analysisEnd||fixture.duration;
    result.selectedEvents=result.events.filter(e=>e.audioTime>=start&&e.audioTime<end);
    const rows=Object.fromEntries(['kick','snare','hat'].map(row=>[row,result.selectedEvents.filter(e=>e.band===(row==='snare'?'clap':row)).length]));
    const controlled=fixture.kind==='controlled-acoustic'?(fixture.segments||[{start:0,end:fixture.duration,matchingToleranceMs:10}]).map(segment=>({
      ...segment,rows:Object.fromEntries(['kick','snare','hat'].map(row=>[row,temporalMatch((fixture.events||[]).filter(e=>e.row===row&&e.time>=segment.start&&e.time<segment.end).map(e=>e.time),
        result.events.filter(e=>e.band===(row==='snare'?'clap':row)&&e.audioTime>=segment.start&&e.audioTime<segment.end).map(e=>e.audioTime),segment.matchingToleranceMs/1000)]))})):null;
    const encoded=JSON.stringify(result);await writeFile(resolve(folder,'baseline-offline',id+'.json'),encoded);
    summary.push({id,rows,controlled,activations:result.activations.length,featureMs:result.featureMs,inferenceMs:result.inferenceMs,
      inferenceCalls:result.inferenceCalls,pcmSha256:fixture.pcmSha256,traceSha256:digest(Buffer.from(encoded)),referenceStatus:fixture.referenceStatus,officialNaturalMetricsCalculated:false});
    await writeFile(resolve(folder,'baseline-offline','summary.json'),JSON.stringify({browser:await browser.version(),modelSha256:config.sha256,fixtures:summary},null,2));
    console.log(JSON.stringify({id,rows,featureMs:Math.round(result.featureMs),inferenceMs:Math.round(result.inferenceMs)}));
  }
}finally{await browser?.close();if(server.listening)await new Promise(done=>server.close(done));}
