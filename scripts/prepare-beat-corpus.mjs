import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const folder=resolve('scratch/browser-first-corpus'),rate=44100,seconds=12;
await mkdir(folder,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function synth(events,seed) {
  const samples=new Float32Array(rate*seconds);
  const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296*2-1;};
  for(const {row,time,level=1} of events) {
    const start=Math.round(time*rate),duration=row==='kick'?.25:row==='snare'?.14:.06;
    let previous=0;
    for(let i=0;i<duration*rate&&start+i<samples.length;i++) {
      const t=i/rate,noise=random(),high=noise-previous;previous=noise;
      const signal=row==='kick'?Math.sin(2*Math.PI*(55*t+70*.025*(1-Math.exp(-t/.025))))*Math.exp(-t/.055)
        :row==='snare'?(noise*.6+Math.sin(2*Math.PI*180*t)*.25)*Math.exp(-t/.035)
        :high*.3*Math.exp(-t/.012);
      samples[start+i]+=signal*.55*level;
    }
  }
  return samples;
}
function wave(mono) {
  const bytes=Buffer.alloc(44+mono.length*4);
  bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);
  bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(2,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*4,28);
  bytes.writeUInt16LE(4,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(bytes.length-44,40);
  mono.forEach((value,index)=>{const n=Math.round(Math.max(-1,Math.min(1,value))*32767);bytes.writeInt16LE(n,44+index*4);bytes.writeInt16LE(n,46+index*4);});
  return bytes;
}
const spaced=[];for(let i=0;i<18;i++)spaced.push({row:['kick','snare','hat'][i%3],time:.5+i*.5});
const rapid=[];for(const [i,gap] of [.02,.03,.05,.1].entries())for(const time of [1+i*2,1+i*2+gap])rapid.push({row:'snare',time});
const mixed=[];for(let i=0;i<18;i++)for(const row of ['kick','snare','hat'])mixed.push({row,time:.5+i*.5,level:i%3===0?.25:.65});
const fixtures=[];
for(const [id,split,events,seed] of [['spaced-dev','development',spaced,12345],['rapid-test','frozen-test',rapid,56789],
  ['mixed-test','frozen-test',mixed,98765],['silence-test','frozen-test',[],11223]]) {
  const mono=synth(events,seed),stereo=new Float32Array(mono.length*2);
  mono.forEach((value,index)=>{stereo[index*2]=value;stereo[index*2+1]=value;});
  const pcm=Buffer.from(stereo.buffer),wav=wave(mono);
  await writeFile(resolve(folder,id+'.f32'),pcm);await writeFile(resolve(folder,id+'.wav'),wav);
  fixtures.push({id,split,seed,sampleRate:rate,channels:2,duration:seconds,pcmSha256:hash(pcm),wavSha256:hash(wav),
    referenceStatus:'deterministic-synthetic-reference',coverage:'complete-by-construction',
    events:events.map((event,index)=>({...event,id:`${id}-${index}`,time:Math.round(event.time*rate)/rate}))});
}
const manifest={version:1,license:'CC0-1.0 generated signals',purpose:'controlled-timing-and-resolution-only',
  naturalAccuracyQualified:false,fixtures};
await writeFile(resolve(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(fixtures.map(({id,split,pcmSha256,events})=>({id,split,pcmSha256,events:events.length}))));
