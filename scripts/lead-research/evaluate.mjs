// Causal evaluation of the live Lead tracker against MedleyDB MELODY1 (human-corrected dominant melody f0).
// Audio is streamed in 128-sample render quanta, exactly as an AudioWorklet would deliver it; no look-ahead.
// Reference onsets are DERIVED from the f0 annotation (voicing starts and held pitch changes); same-pitch
// re-articulations are invisible in f0 annotations, so those detections count against precision here.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('=')));
const {createLeadTracker}=await import(pathToFileURL(process.cwd()+'/extensions/kanban-music/lead-tracker.js').href);
const CORPUS='C:/Users/thang/OneDrive/Documents/react-kanban/react-kanban/scratch/beat-grid-v2/corpus/';
const ANN='scratch/live-lead-261031/annotations/';
const manifest=JSON.parse(await readFile('C:/Users/thang/OneDrive/Documents/react-kanban/react-kanban/scratch/beat-grid-v2/corpus-manifest.json','utf8'));
const partition=Object.fromEntries(manifest.items.filter(i=>i.id.endsWith('-full-mix')).map(i=>[i.id.replace('-full-mix',''),i.partition]));
function wav(buffer){
  const view=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength);let p=12,fmt,data;
  while(p<view.byteLength){const id=buffer.toString('ascii',p,p+4),size=view.getUint32(p+4,true);
    if(id==='fmt ')fmt={format:view.getUint16(p+8,true),channels:view.getUint16(p+10,true),rate:view.getUint32(p+12,true),bits:view.getUint16(p+22,true)};
    if(id==='data')data={offset:p+8,size};p+=8+size+(size&1);}
  const frames=data.size/(fmt.bits/8)/fmt.channels,out=new Float32Array(frames);
  for(let i=0;i<frames;i++){let s=0;for(let c=0;c<fmt.channels;c++){const o=data.offset+(i*fmt.channels+c)*fmt.bits/8;
    s+=fmt.format===3?view.getFloat32(o,true):fmt.bits===16?view.getInt16(o,true)/32768:view.getInt32(o,true)/2147483648;}out[i]=s/fmt.channels;}
  return {rate:fmt.rate,samples:out};
}
import {referenceOnsets} from './lead-reference.mjs';
function match(refs,preds,tol){const pairs=[];for(const r of refs)for(const p of preds){const d=Math.abs(p-r);if(d<=tol)pairs.push([d,r,p]);}
  pairs.sort((a,b)=>a[0]-b[0]);const ur=new Set(),up=new Set(),errors=[];for(const [d,r,p] of pairs)if(!ur.has(r)&&!up.has(p)){ur.add(r);up.add(p);errors.push(p-r);}return {tp:errors.length,errors};}
const options=args.options?JSON.parse(args.options):{};
const select=args.set||'development';
const rows=[];
for(const [track,part] of Object.entries(partition)){
  if(select!=='all'&&part!==(select==='holdout'?'locked-holdout':select))continue;
  const {rate,samples}=wav(await readFile(CORPUS+track+'-full-mix.wav'));
  const ann=(await readFile(ANN+track+'_MELODY1.csv','utf8')).trim().split('\n').map(l=>l.split(',').map(Number));
  const end=samples.length/rate,refs=referenceOnsets(ann,end-.2);
  const tracker=createLeadTracker(rate,options),preds=[],latency=[];
  const started=performance.now();
  for(let i=0;i<samples.length;i+=128){const chunk=samples.subarray(i,Math.min(samples.length,i+128));
    for(const e of tracker.push(chunk,(i+chunk.length)/rate)){if(e.audioTime<end-.2){preds.push(e.audioTime);latency.push(e.decidedAt+tracker.windowDelay-e.audioTime);}}}
  const cpu=performance.now()-started;
  // Voiced fraction is the share of each prediction falling on annotated melody (any pitch).
  const voicedAt=t=>{const i=Math.round(t/(ann[1][0]-ann[0][0]));return ann.slice(Math.max(0,i-4),i+5).some(r=>r[1]>0);};
  const m=match(refs,preds,.05);
  // Chance control: the same predictions shifted by fixed offsets (keeps their density and rhythm).
  const shifted=[.37,.73,1.11].map(d=>match(refs,preds.map(t=>(t+d)%(end-.2)),.05).tp);
  rows.push({track,part,refs:refs.length,preds:preds.length,tp:m.tp,chanceTp:shifted.reduce((a,b)=>a+b,0)/shifted.length,inMelody:preds.filter(voicedAt).length,
    medianErrorMs:m.errors.length?m.errors.sort((a,b)=>a-b)[m.errors.length>>1]*1000:null,
    medianLatencyMs:latency.length?latency.sort((a,b)=>a-b)[latency.length>>1]*1000:null,realtimeFactor:cpu/1000/end});
}
const sum=k=>rows.reduce((a,r)=>a+r[k],0);
const tp=sum('tp'),refs=sum('refs'),preds=sum('preds');
const P=tp/preds,R=tp/refs;
const summary={set:select,options,tracks:rows.length,refs,preds,tp,precision:+P.toFixed(3),recall:+R.toFixed(3),f1:+(2*P*R/(P+R)).toFixed(3),
  chancePrecision:+(sum('chanceTp')/preds).toFixed(3),
  inMelodyShare:+(sum('inMelody')/preds).toFixed(3),
  medianLatencyMs:rows.map(r=>r.medianLatencyMs).filter(Number.isFinite).sort((a,b)=>a-b)[rows.length>>1],
  worstRealtimeFactor:Math.max(...rows.map(r=>r.realtimeFactor))};
if(args.out)await writeFile(args.out,JSON.stringify({summary,rows},null,1));
if(args.verbose)for(const r of rows)console.log(r.track.padEnd(24),`refs ${r.refs} preds ${r.preds} tp ${r.tp} inMelody ${r.inMelody} err ${r.medianErrorMs?.toFixed(1)}ms lat ${r.medianLatencyMs?.toFixed(0)}ms rtf ${r.realtimeFactor.toFixed(3)}`);
console.log(JSON.stringify(summary));
