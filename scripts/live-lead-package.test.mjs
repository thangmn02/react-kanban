import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
let root;
const build=(name,...flags)=>{const out=spawnSync(process.execPath,['scripts/package-music-extension.mjs','--source-audio-delay',...flags,'--output-root='+join(root,name)],{encoding:'utf8',timeout:30000});
  assert.equal(out.status,0,out.stderr);};
before(async()=>{root=await mkdtemp(resolve('scratch/live-lead-test-'));build('base');build('lead','--live-lead');});
after(async()=>{if(root){assert.ok(root.startsWith(resolve('scratch')+sep));await rm(root,{recursive:true,force:true});}});

test('only the live Lead candidate carries the tracker, and it ships no model weights',async()=>{
  const files=async name=>JSON.parse(await readFile(join(root,name,'package-files.json'),'utf8')).map(path=>path.replace(/^extension\//,''));
  const base=await files('base'),lead=await files('lead');
  for(const name of ['lead-tracker.js','lead-tracker-worklet.js','lead-runtime.js']){assert.ok(!base.includes(name));assert.ok(lead.includes(name));}
  assert.deepEqual(lead.filter(name=>!base.includes(name)).sort(),['lead-runtime.js','lead-tracker-worklet.js','lead-tracker.js']);
  const provenance=JSON.parse(await readFile(join(root,'lead/extension/SOURCE-AUDIO-DELAY-PROVENANCE.json'),'utf8'));
  assert.equal(provenance.liveLead.causal,true);assert.equal(provenance.liveLead.modelChanged,false);
  assert.match(JSON.parse(await readFile(join(root,'lead/extension/manifest.json'),'utf8')).version_name,/live lead/);
  assert.match(await readFile(join(root,'base/extension/beat-sync.js'),'utf8'),/new Set\(\['kick', 'bass', 'clap', 'hat'\]\)/);
  assert.match(await readFile(join(root,'lead/extension/beat-sync.js'),'utf8'),/new Set\(\['kick', 'bass', 'clap', 'hat', 'melody'\]\)/);
});

test('captured Lead attacks wait for the typed-preview gate, follow the epoch and reach the melody row transport',async()=>{
  const nodes=[];
  globalThis.AudioWorkletNode=class{constructor(_context,name,options){this.name=name;this.options=options;this.port={postMessage:message=>this.port.sent.push(message),sent:[],close(){},onmessage:null};nodes.push(this);}connect(){}disconnect(){}};
  const {createCaptureEngine}=await import(pathToFileURL(join(root,'lead/extension/capture-engine.js')));
  let now=1000,tick;const beats=[];
  const track={stop(){},addEventListener(){},readyState:'live'};
  const context={sampleRate:44100,state:'running',destination:{},baseLatency:0,outputLatency:0,currentTime:10,
    resume:async()=>{},close:async()=>{},audioWorklet:{addModule:async()=>{}},
    createMediaStreamSource:()=>({connect(){},disconnect(){}}),createGain:()=>({gain:{value:1},connect(){},disconnect(){}}),
    createAnalyser:()=>({frequencyBinCount:1024,getFloatFrequencyData:array=>array.fill(-60),disconnect(){}})};
  const engine=createCaptureEngine({getUserMedia:async()=>({getTracks:()=>[track],getAudioTracks:()=>[track],getVideoTracks:()=>[]}),
    createAudioContext:()=>context,onBeat:(captureId,bands,trace)=>beats.push({captureId,bands,trace}),onStop(){},
    createPercussion:async()=>({stop(){}}),now:()=>now,schedule:callback=>{tick=callback;return 1;},cancel(){}});
  try{
    assert.equal(await engine.start('stream','capture',{candidate:true}),true);
    await new Promise(done=>setTimeout(done,0));
    const lead=nodes.find(node=>node.name==='kora-lead-tracker');assert.ok(lead,'Lead worklet attached to the captured source');
    assert.equal(engine.health.leadLive,true);
    const send=(epoch,audioTime)=>lead.port.onmessage({data:{kind:'events',ownership:{captureId:'capture',epoch},version:'kora-lead-salience-v1',
      events:[{audioTime,decidedAt:audioTime+.08,kind:'start',confidence:.8,midiPitch:64}]}});
    const first=lead.options.processorOptions.ownership.epoch;
    send(first,9.9);tick();
    assert.equal(beats.filter(beat=>beat.bands.includes('melody')).length,0,'unqualified preview stays dark');
    assert.equal(engine.health.droppedSemanticEvents,1);
    assert.equal(engine.configureSynchronization('capture',{live:true,bufferMs:0,eligible:true,allowTypedPreview:true,epoch:'epoch-2'}),true);
    assert.deepEqual(lead.port.sent.at(-1),{kind:'reset',ownership:{captureId:'capture',epoch:'epoch-2'}});
    send(first,10.2);send('epoch-2',10.3);now+=16;tick();
    const melody=beats.filter(beat=>beat.bands.includes('melody'));
    assert.equal(melody.length,1,'only the current epoch reaches transport');
    assert.deepEqual(melody[0].bands,['melody']);
    engine.stop();
    assert.deepEqual(lead.port.sent.at(-1),{kind:'stop'});
  }finally{engine.stop();delete globalThis.AudioWorkletNode;}
});
