import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=process.cwd(),folder=resolve(root,'scratch/xo-percussion-recovery');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
try{await access(resolve(folder,'manifest.json'));throw Error('Private benchmark exists; preserve it rather than overwrite evidence');}
catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(folder,{recursive:true});
const rate=44100,leading=1,trailing=1,intervals=[20,30,50,80,125,200];
const existing=JSON.parse(await readFile(resolve(root,'scratch/whiplash-benchmark/manifest.json'),'utf8'));
const downloads=process.env.KORA_MUSIC_DOWNLOADS||resolve(process.env.USERPROFILE,'Downloads');
const xo=existing.files.find(file=>file.id==='trap');
assert.equal(xo.sha256,'98f15c28fc0a4641c358a9f2e728cb66f83ce74e4ebb21828a7961dfcb46ea05');
assert.equal(digest(await readFile(resolve(downloads,xo.filename))),xo.sha256,'XO source differs from the accepted recording');
const fixtures=[];
function wave(samples,stereo){
  const bytes=Buffer.alloc(44+samples.length*4);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);
  bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(2,22);bytes.writeUInt32LE(rate,24);
  bytes.writeUInt32LE(rate*4,28);bytes.writeUInt16LE(4,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(bytes.length-44,40);
  samples.forEach((value,i)=>{const left=stereo?stereo[i*2]:value,right=stereo?stereo[i*2+1]:value;
    bytes.writeInt16LE(Math.round(Math.max(-1,Math.min(1,left))*32767),44+i*4);
    bytes.writeInt16LE(Math.round(Math.max(-1,Math.min(1,right))*32767),46+i*4);});return bytes;
}
async function save(id,mono,metadata,originalStereo){
  const stereo=originalStereo||new Float32Array(mono.length*2);if(!originalStereo)mono.forEach((sample,i)=>{stereo[i*2]=sample;stereo[i*2+1]=sample;});
  const pcm=Buffer.from(stereo.buffer),wav=wave(mono,stereo);
  await writeFile(resolve(folder,id+'.f32'),pcm);await writeFile(resolve(folder,id+'.wav'),wav);
  fixtures.push({id,pcm:id+'.f32',wav:id+'.wav',duration:mono.length/rate,sampleRate:rate,channels:2,
    pcmSha256:digest(pcm),wavSha256:digest(wav),...metadata});
}
function synth(events,seconds,seed){
  const samples=new Float32Array(Math.round(seconds*rate));
  const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296*2-1;};
  for(const {row,time,level=1} of events){
    const start=Math.round(time*rate),duration=row==='kick'?.25:row==='snare'?.14:.06;let previous=0;
    for(let i=0;i<duration*rate&&start+i<samples.length;i++){
      const t=i/rate,noise=random(),high=noise-previous;previous=noise;
      const signal=row==='kick'?Math.sin(2*Math.PI*(55*t+70*.025*(1-Math.exp(-t/.025))))*Math.exp(-t/.055)
        :row==='snare'?(noise*.6+Math.sin(2*Math.PI*180*t)*.25)*Math.exp(-t/.035)
        :(high*.3+(.04*Math.sin(2*Math.PI*4400*t)+.04*Math.sin(2*Math.PI*6200*t)+.04*Math.sin(2*Math.PI*8100*t)))*Math.exp(-t/.012);
      samples[start+i]+=signal*.55*level;
    }
  }
  const peak=samples.reduce((maximum,value)=>Math.max(maximum,Math.abs(value)),0);
  if(peak>.95)for(let i=0;i<samples.length;i++)samples[i]*=.95/peak;
  return samples;
}
for(const [pattern,seed] of [['hat-only',4101],['snare-only',4102],['alternating-snare-hat',4103],['simultaneous-kick-snare-hat',4104],['weak-strong-hat',4105]]){
  const events=[],segments=[];
  for(const [index,intervalMs] of intervals.entries()){
    const start=1+index*2,end=start+1.3;
    segments.push({intervalMs,start:start-.15,end,matchingToleranceMs:Math.min(40,intervalMs/4)});
    for(let hit=0;hit<6;hit++){
      const time=Math.round((start+hit*intervalMs/1000)*rate)/rate;
      const rows=pattern==='simultaneous-kick-snare-hat'?['kick','snare','hat']
        :pattern==='alternating-snare-hat'?[hit%2?'hat':'snare']:[pattern==='snare-only'?'snare':'hat'];
      for(const row of rows)events.push({row,time,intervalMs,level:pattern==='weak-strong-hat'?[.2,1,.35,.9,.25,1][hit]:1});
    }
  }
  await save(pattern,synth(events,14,seed),{kind:'controlled-acoustic',referenceStatus:'deterministic-synthetic-reference',
    referenceCoverage:'complete-by-construction',license:'CC0 generated signals',seed,segments,events});
}
await save('silence',new Float32Array(rate*14),{kind:'controlled-acoustic',referenceStatus:'deterministic-synthetic-reference',referenceCoverage:'complete-by-construction',events:[],license:'CC0 generated signal'});
const tone=new Float32Array(rate*14);
for(let i=0;i<tone.length;i++){const t=i/rate,envelope=Math.min(1,t/.3,(14-t)/.3);tone[i]=envelope*(.18*Math.sin(2*Math.PI*220*t)+.09*Math.sin(2*Math.PI*440*t));}
await save('sustained-tones',tone,{kind:'controlled-acoustic',referenceStatus:'deterministic-synthetic-reference',referenceCoverage:'complete-by-construction',events:[],license:'CC0 generated signal'});
const old=JSON.parse(await readFile(resolve(root,'scratch/browser-first-corpus/manifest.json'),'utf8')).fixtures.find(f=>f.id==='rapid-test');
const oldBytes=await readFile(resolve(root,'scratch/browser-first-corpus/rapid-test.f32'));assert.equal(digest(oldBytes),old.pcmSha256);
const oldPcm=new Float32Array(oldBytes.buffer,oldBytes.byteOffset,oldBytes.length/4),oldMono=Float32Array.from({length:oldPcm.length/2},(_,i)=>oldPcm[i*2]);
await save('legacy-snare-only',oldMono,{kind:'controlled-acoustic',referenceStatus:old.referenceStatus,referenceCoverage:'complete-by-construction',events:old.events,license:'CC0 generated signals',originalPcmSha256:old.pcmSha256});
for(const id of ['trap','mono','W1','W2','W3','levels','rock','pop','piano']){
  const entry=existing.excerpts.find(f=>f.input===id),source=existing.files.find(file=>file.id===entry.source);
  assert.equal(digest(await readFile(resolve(downloads,source.filename))),entry.sourceSha256,'Natural source identity changed');
  const bytes=await readFile(resolve(root,'scratch/whiplash-benchmark',entry.pcm));assert.equal(digest(bytes),entry.pcmSha256);
  // Padding is diagnostic context, not a change to the selected source window.
  const pcm=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4),mono=new Float32Array(Math.round((leading+entry.duration+trailing)*rate));
  const stereo=new Float32Array(mono.length*2);stereo.set(pcm,Math.round(leading*rate)*2);
  assert.equal(digest(Buffer.from(stereo.buffer,leading*rate*8,bytes.length)),entry.pcmSha256);
  for(let i=0;i<pcm.length/2;i++)mono[Math.round(leading*rate)+i]=(pcm[i*2]+pcm[i*2+1])/2;
  await save(id,mono,{kind:'natural-music',referenceStatus:'provisional-human-reference',scoringEligible:false,
    sourceFilename:source.filename,sourceSha256:entry.sourceSha256,sourcePcmSha256:entry.pcmSha256,
    sourceStart:entry.sourceStart,sourceEnd:entry.sourceEnd,analysisStart:leading,analysisEnd:leading+entry.duration,
    leadingSilenceSeconds:leading,trailingSilenceSeconds:trailing,
    limitation:'Original stereo PCM is preserved exactly inside silence padding; the review WAV uses 16-bit quantization.'},stereo);
}
const manifest={version:1,sampleRate:rate,intervalsMs:intervals,sourceSha256:xo.sha256,baselineRevision:'d5b28b1',
  modelSha256:JSON.parse(await readFile(resolve(root,'extensions/kanban-music/generated/percussion/percussion.json'),'utf8')).sha256,
  naturalAccuracyGate:'BLOCKED: no independent complete natural reference',officialNaturalMetricsCalculated:false,fixtures};
await writeFile(resolve(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({folder,fixtures:fixtures.length,xoSha256:xo.sha256,manifestSha256:digest(Buffer.from(JSON.stringify(manifest,null,2)+'\n'))}));
