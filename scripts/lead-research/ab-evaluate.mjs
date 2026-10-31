// Candidate-5 vs candidate-6 on identical audio, streamed causally in 128-sample quanta.
// References: MedleyDB MELODY1 f0 (human-corrected dominant melody) + INTERVALS/metadata (which source carries it).
// Usage: node ab-evaluate.mjs --set=development|holdout|all [--model=path.json] [--cues=out.json] [--out=summary.json] [--options={}]
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {referenceOnsets} from './lead-reference.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));
const root=process.cwd()+'/extensions/kanban-music/';
const {createLeadTracker}=await import(pathToFileURL(root+'lead-tracker.js').href);
const {createLeadContourTracker}=await import(pathToFileURL(root+'lead-contour-tracker.js').href);
const CORPUS='C:/Users/thang/OneDrive/Documents/react-kanban/react-kanban/scratch/beat-grid-v2/corpus/',ANN='scratch/live-lead-261031/annotations/';
const manifest=JSON.parse(await readFile('C:/Users/thang/OneDrive/Documents/react-kanban/react-kanban/scratch/beat-grid-v2/corpus-manifest.json','utf8'));
const partition=Object.fromEntries(manifest.items.filter(i=>i.id.endsWith('-full-mix')).map(i=>[i.id.replace('-full-mix',''),i.partition]));
const labels=JSON.parse(await readFile('scratch/live-lead-261031/source-labels.json','utf8'));
const model=args.model?JSON.parse(await readFile(args.model,'utf8')):null;
const options=args.options?JSON.parse(args.options):{};
export function readWav(buffer){const v=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength);let p=12,f,d;
  while(p<v.byteLength){const id=buffer.toString('ascii',p,p+4),s=v.getUint32(p+4,true);if(id==='fmt ')f={fmt:v.getUint16(p+8,true),ch:v.getUint16(p+10,true),rate:v.getUint32(p+12,true),bits:v.getUint16(p+22,true)};if(id==='data')d={o:p+8,s};p+=8+s+(s&1);}
  const n=d.s/(f.bits/8)/f.ch,x=new Float32Array(n);for(let i=0;i<n;i++){let s=0;for(let c=0;c<f.ch;c++){const o=d.o+(i*f.ch+c)*f.bits/8;s+=f.fmt===3?v.getFloat32(o,true):f.bits===16?v.getInt16(o,true)/32768:v.getInt32(o,true)/2147483648;}x[i]=s/f.ch;}
  return {rate:f.rate,x};}
const match=(refs,preds,tol)=>{const pairs=[];for(const r of refs)for(const q of preds){const d=Math.abs(q-r);if(d<=tol)pairs.push([d,r,q]);}pairs.sort((a,b)=>a[0]-b[0]);
  const ur=new Set(),up=new Set(),err=[];for(const [,r,q] of pairs)if(!ur.has(r)&&!up.has(q)){ur.add(r);up.add(q);err.push(q-r);}return {tp:err.length,err,matched:up};};

async function evaluateTrack(track,kind){
  const {rate,x}=readWav(await readFile(CORPUS+track+'-full-mix.wav')),end=x.length/rate-.2;
  const ann=(await readFile(ANN+track+'_MELODY'+(args.melody||'2')+'.csv','utf8')).trim().split('\n').map(l=>l.split(',').map(Number)),hop=ann[1][0]-ann[0][0];
  const refAt=t=>{const r=ann[Math.round(t/hop)];return r&&r[1]>0?69+12*Math.log2(r[1]/440):NaN;};
  const segs=labels[track].melody,classAt=t=>segs.find(s=>t>=s.start&&t<s.end)?.class;
  const frames=[],events=[],cues=[];
  const tracker=kind==='c5'?createLeadTracker(rate,{onFrame:f=>frames.push({time:f.time,pitch:f.voiced?f.pitch:NaN,owner:f.voiced?1:null})})
    :createLeadContourTracker(rate,{...options,sourceModel:model,onFrame:f=>frames.push({time:f.time,pitch:f.owner?.present?f.owner.pitch:NaN,owner:f.owner?.id??null,
      source:f.owner?.sourceConfidence>=(options.sourceConfidence??.6)?f.owner.source:'unknown',features:f.owner?.features})});
  const started=performance.now();
  for(let i=0;i<x.length;i+=128)for(const e of tracker.push(x.subarray(i,i+128),Math.min(x.length,i+128)/rate))if(e.audioTime<end)events.push(e);
  const cpu=performance.now()-started;
  const m={track,frames:0,octaveUp:0,octaveDown:0,runs:[],run:0,refVoiced:0,ownerOnMelody:0,ownerOnMelodyChroma:0,abstainCorrect:0,refUnvoiced:0,missedVoiced:0,switches:0,confusion:{},
    events:events.length,eventsWrongLine:0,eventsMelodySilent:0,acquisitionMs:[],handoffMs:[],latencyMs:events.map(e=>(e.decidedAt-e.audioTime)*1000+(tracker.windowDelay*1000)),rtf:cpu/1000/(x.length/rate)};
  let prevOwner=null;
  for(const f of frames){if(f.time<0||f.time>=end)continue;m.frames++;const ref=refAt(f.time),cls=classAt(f.time);
    if(f.owner!==null&&prevOwner!==null&&f.owner!==prevOwner)m.switches++;if(f.owner!==null)prevOwner=f.owner;
    if(Number.isFinite(ref)){m.refVoiced++;const d=Math.abs(f.pitch-ref);
      const signed=f.pitch-ref;if(Math.abs(signed-12)<.5)m.octaveUp++;if(Math.abs(signed+12)<.5)m.octaveDown++;
      if(d<.5){m.ownerOnMelody++;m.run++;}else if(m.run){m.runs.push(m.run);m.run=0;}
      if(d<.5)void 0;if(Number.isFinite(d)&&Math.abs(d-12*Math.round(d/12))<.5)m.ownerOnMelodyChroma++;if(!Number.isFinite(f.pitch))m.missedVoiced++;
      if(kind==='c6'&&d<.5&&cls){const key=cls+'→'+(f.source||'unknown');m.confusion[key]=(m.confusion[key]||0)+1;
        if(f.features?.notes>=3&&m.frames%10===0)cues.push({track,class:cls,...f.features});}}
    else{m.refUnvoiced++;if(!Number.isFinite(f.pitch))m.abstainCorrect++;}}
  // Acquisition: melody (re)entry after >=0.5 s of silence until the owner first sits on it.
  for(let i=0;i<ann.length;i++){const t=ann[i][0];if(t>=end-1)break;
    const entry=ann[i][1]>0&&ann.slice(Math.max(0,i-Math.round(.5/hop)),i).every(r=>!(r[1]>0))&&i>0;
    if(!entry&&!(i===0&&ann[0][1]>0))continue;
    const hit=frames.find(f=>f.time>=t&&f.time<t+2&&Math.abs(f.pitch-refAt(f.time))<.5);m.acquisitionMs.push(hit?(hit.time-t)*1000:2000);}
  // Handoff: a reference source change until the owner sits on the new source's line.
  for(const s of segs.slice(1)){const hit=frames.find(f=>f.time>=s.start&&f.time<s.start+3&&Math.abs(f.pitch-refAt(f.time))<.5);m.handoffMs.push(hit?(hit.time-s.start)*1000:3000);}
  const refs=referenceOnsets(ann,end),times=events.map(e=>e.audioTime),mt=match(refs,times,.05);
  if(m.run)m.runs.push(m.run);m.singleSource=segs.length<=1;m.tp25=match(refs,times,.025).tp;
  m.refs=refs.length;m.tp=mt.tp;m.onsetErrorMs=mt.err.map(e=>e*1000);
  for(const e of events){if(mt.matched.has(e.audioTime))continue;const ref=refAt(e.audioTime+.03);
    if(!Number.isFinite(ref))m.eventsMelodySilent++;else if(Number.isInteger(e.midiPitch)&&Math.abs(e.midiPitch-ref)>1.5&&Math.abs(Math.abs(e.midiPitch-ref)-12)>1.5)m.eventsWrongLine++;}
  return {m,cues};
}
const select=args.set||'development';
const tracks=Object.keys(partition).filter(t=>select==='all'||partition[t]===(select==='holdout'?'locked-holdout':select));
const result={set:select,options,model:args.model||null},allCues=[];
for(const kind of ['c5','c6']){
  const rows=[];for(const t of tracks){const {m,cues}=await evaluateTrack(t,kind);rows.push(m);if(kind==='c6')allCues.push(...cues);}
  const sum=k=>rows.reduce((a,r)=>a+r[k],0),q=(a,p)=>{const s=a.flat().sort((x,y)=>x-y);return s.length?+s[Math.min(s.length-1,Math.floor(p*s.length))].toFixed(1):null;};
  const minutes=sum('frames')*0.01161/60,P=sum('tp')/sum('events'),R=sum('tp')/sum('refs');
  const confusion={};for(const r of rows)for(const [k,v] of Object.entries(r.confusion))confusion[k]=(confusion[k]||0)+v;
  result[kind]={tracks:rows.length,ownershipOnMelody:+(sum('ownerOnMelody')/sum('refVoiced')).toFixed(3),ownershipChroma:+(sum('ownerOnMelodyChroma')/sum('refVoiced')).toFixed(3),
    correctAbstention:+(sum('abstainCorrect')/sum('refUnvoiced')).toFixed(3),missedVoicedFrames:+(sum('missedVoiced')/sum('refVoiced')).toFixed(3),
    octaveErrors:{up:+(sum('octaveUp')/sum('refVoiced')).toFixed(3),down:+(sum('octaveDown')/sum('refVoiced')).toFixed(3)},
    onMelodyRunMs:{p50:q(rows.map(r=>r.runs.map(n=>n*11.61)),.5),p90:q(rows.map(r=>r.runs.map(n=>n*11.61)),.9)},
    falseSwitchesPerMinute:+(rows.filter(r=>r.singleSource).reduce((a,r)=>a+r.switches,0)/(rows.filter(r=>r.singleSource).reduce((a,r)=>a+r.frames,0)*0.01161/60)).toFixed(1),
    f1At25ms:+(2*sum('tp25')/(sum('events')+sum('refs'))).toFixed(3),
    events:sum('events'),precision:+P.toFixed(3),recall:+R.toFixed(3),f1:+(2*P*R/(P+R)).toFixed(3),
    falseOnWrongLine:sum('eventsWrongLine'),falseWhileMelodySilent:sum('eventsMelodySilent'),
    switchesPerMinute:+(sum('switches')/minutes).toFixed(1),acquisitionMs:{p50:q(rows.map(r=>r.acquisitionMs),.5),p90:q(rows.map(r=>r.acquisitionMs),.9)},
    handoffMs:rows.flatMap(r=>r.handoffMs).map(v=>Math.round(v)),onsetErrorMs:{p50:q(rows.map(r=>r.onsetErrorMs.map(Math.abs)),.5)},
    detectionLatencyMs:{p50:q(rows.map(r=>r.latencyMs),.5),p95:q(rows.map(r=>r.latencyMs),.95)},worstRealtimeFactor:+Math.max(...rows.map(r=>r.rtf)).toFixed(4),
    ...(kind==='c6'?{sourceConfusionFrames:confusion}:{}),perTrack:rows.map(r=>({track:r.track.replace('MusicDelta_',''),own:+(r.ownerOnMelody/r.refVoiced).toFixed(2),tp:r.tp,events:r.events,refs:r.refs,switches:r.switches}))};
}
if(args.cues)await writeFile(args.cues,JSON.stringify(allCues));
if(args.out)await writeFile(args.out,JSON.stringify(result,null,1));
const brief=k=>{const {perTrack,handoffMs,...rest}=result[k];return rest;};
console.log(JSON.stringify({set:select,c5:brief('c5'),c6:brief('c6')},null,1));
if(args.verbose)for(const k of ['c5','c6'])console.log(k,JSON.stringify(result[k].perTrack),'handoff',JSON.stringify(result[k].handoffMs));
