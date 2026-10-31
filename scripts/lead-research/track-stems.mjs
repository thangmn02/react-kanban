// Runs Kora's Lead trackers over separated stems (and the mix) of one excerpt; writes frame pitches and note events.
// Usage: node track-stems.mjs <stemDir>  →  <stemDir>/tracks.json
import {readFile,writeFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
const ext=process.cwd()+'/extensions/kanban-music/';
const {createLeadTracker}=await import(pathToFileURL(ext+'lead-tracker.js').href);
const {createLeadContourTracker}=await import(pathToFileURL(ext+'lead-contour-tracker.js').href);
function readWav(buffer){const v=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength);let p=12,f,d;
  while(p<v.byteLength){const id=buffer.toString('ascii',p,p+4),s=v.getUint32(p+4,true);if(id==='fmt ')f={fmt:v.getUint16(p+8,true),ch:v.getUint16(p+10,true),rate:v.getUint32(p+12,true),bits:v.getUint16(p+22,true)};if(id==='data')d={o:p+8,s};p+=8+s+(s&1);}
  const n=d.s/(f.bits/8)/f.ch,x=new Float32Array(n);for(let i=0;i<n;i++){let s=0;for(let c=0;c<f.ch;c++){const o=d.o+(i*f.ch+c)*f.bits/8;s+=f.fmt===3?v.getFloat32(o,true):v.getInt16(o,true)/32768;}x[i]=s/f.ch;}return {rate:f.rate,x};}
const dir=process.argv[2],out={};
for(const stem of ['mix','vocals','other']){
  const {rate,x}=readWav(await readFile(`${dir}/${stem}.wav`));
  // Stems are quieter than mixes; normalise so the tracker's silence floor means the same thing.
  let peak=0;for(const v of x)peak=Math.max(peak,Math.abs(v));const gain=peak>1e-4?.5/peak:1;for(let i=0;i<x.length;i++)x[i]*=gain;
  const frames=[],events=[],tracker=createLeadTracker(rate,{onFrame:f=>frames.push([+f.time.toFixed(4),f.voiced?+f.pitch.toFixed(2):null,+f.strength.toFixed(3)])});
  const started=performance.now();
  for(let i=0;i<x.length;i+=128)for(const e of tracker.push(x.subarray(i,i+128),Math.min(x.length,i+128)/rate))events.push(e);
  out[stem]={gain,frames,events:events.map(e=>({t:+e.audioTime.toFixed(4),pitch:e.midiPitch??null,kind:e.kind})),cpuSeconds:(performance.now()-started)/1000};
  if(stem==='mix'){const c6=[],tr=createLeadContourTracker(rate);for(let i=0;i<x.length;i+=128)for(const e of tr.push(x.subarray(i,i+128).map(v=>v/gain),Math.min(x.length,i+128)/rate))c6.push(+e.audioTime.toFixed(4));out.mixC6=c6;}
}
await writeFile(`${dir}/tracks.json`,JSON.stringify(out));
console.log(dir,Object.fromEntries(['mix','vocals','other'].map(s=>[s,out[s].events.length])));
