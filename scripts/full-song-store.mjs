// Loopback-only private uploads, one bounded preparation worker, source-bound caches.
import {mkdir,readFile,writeFile,rename,stat,open,unlink} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,extname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {frameCoverage} from './full-song-core.ts';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const feedbackTypes=['Missed Snare','Missed Hi-Hat','False Snare','False Hi-Hat','Flash too early','Flash too late','Consecutive hits visually merged','This passage seems correct','Unsure / needs review'];
export async function createFullSongStore(root){
 const {stdout}=await promisify(execFile)(resolve('scratch/beat-grid-v2/.venv/Scripts/python.exe'),['scripts/prepare-full-song.py','--identity'],{windowsHide:true,maxBuffer:1024*1024});const currentContract=JSON.parse(stdout).contractSha256;
 await mkdir(root,{recursive:true});const indexPath=resolve(root,'songs.json'),jobs=new Map(),queue=[];let running;
 const read=async path=>JSON.parse(await readFile(path,'utf8'));
 let index;try{index=await read(indexPath);}catch(error){if(error.code!=='ENOENT')throw error;index={version:1,slots:{rangem:null,hskt:null,local:null,fixture:null},sources:{}};}
 const atomic=async(path,value)=>{const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(value));for(let i=0;i<50;i++){try{await rename(temp,path);return;}catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||i===49)throw error;await new Promise(done=>setTimeout(done,40));}}};
 let indexWrite=Promise.resolve();const saveIndex=()=>{indexWrite=indexWrite.catch(()=>{}).then(()=>atomic(indexPath,index));return indexWrite;};
 const folder=id=>{if(!/^[a-f0-9]{64}$/.test(id)||!index.sources[id])throw Error('Unknown exact song identity');return resolve(root,id);};
 const status=async id=>{try{return await read(resolve(folder(id),'status.json'));}catch(error){if(error.code!=='ENOENT')throw error;return {state:'WAITING',models:{}};}};
 async function markStopped(id,state,error){const current=await status(id);current.state=state;current.error=error;for(const m of Object.values(current.models||{}))if(['RUNNING','WAITING'].includes(m.state))m.state=state;await atomic(resolve(folder(id),'status.json'),current);}
 // A crashed/restarted server never reports an abandoned worker as still running.
 for(const id of Object.keys(index.sources)){const s=await status(id);if(s.contractSha256&&s.contractSha256!==currentContract){for(const m of Object.values(s.models||{}))m.state='STALE';s.state='STALE';s.error='Source/model/preprocessing revision changed; retry required.';await writeFile(resolve(folder(id),'status.json'),JSON.stringify(s));}else if(['PREPARING','WAITING'].includes(s.state))await markStopped(id,'INTERRUPTED','Server restarted; retry to reuse completed model results.');}
 const persistWorker=async()=>writeFile(resolve(root,'worker-process.json'),JSON.stringify(running?{id:running.id,pid:running.child?.pid,command:'python scripts/prepare-full-song.py --job '+resolve(folder(running.id),'job.json'),worktree:process.cwd(),startedAt:running.startedAt}:{state:'IDLE'}));
 async function startNext(){
  if(running||!queue.length)return;const id=queue.shift(),dir=folder(id),job=resolve(dir,'job.json');
  // Reserve before the first await: concurrent uploads cannot launch two workers,
  // and cancellation can reach a job while its log file is still being opened.
  const reservation={id,child:null,startedAt:new Date().toISOString()};running=reservation;jobs.set(id,reservation);
  let log;try{log=await open(resolve(dir,'preparation.log'),'a');}catch(error){jobs.delete(id);running=undefined;await markStopped(id,'BLOCKED',error.message);void startNext();return;}
  if(reservation.cancelled){await log.close();jobs.delete(id);running=undefined;await markStopped(id,'CANCELLED','Cancelled before worker launch');await persistWorker();void startNext();return;}
  const child=spawn(resolve('scratch/beat-grid-v2/.venv/Scripts/python.exe'),['-u','scripts/prepare-full-song.py','--job',job],{cwd:process.cwd(),windowsHide:true,stdio:['ignore',log.fd,log.fd],env:{...process.env,OMP_NUM_THREADS:'4',OPENBLAS_NUM_THREADS:'4',PYTHONDONTWRITEBYTECODE:'1'}});
  reservation.child=child;let completed=false;
  const finish=async(code,error)=>{if(completed)return;completed=true;await log.close();const active=jobs.get(id);if(active?.cancelled)await markStopped(id,'CANCELLED','Preparation cancelled; successful model caches are retained.');else if(code!==0)await markStopped(id,'BLOCKED',error||`Worker exited ${code}. Inspect preparation.log; retry retains successful caches.`);jobs.delete(id);running=undefined;await persistWorker();void startNext();};
  child.once('error',e=>void finish(-1,e.message));child.once('exit',code=>void finish(code));
  await persistWorker();
 }
 const pendingEnqueues=new Map();
 async function enqueue(id){
  if(pendingEnqueues.has(id))return pendingEnqueues.get(id);
  const operation=(async()=>{
   if(queue.includes(id))return;
   if(jobs.has(id)){if((await status(id)).state==='READY'&&!queue.includes(id)){queue.push(id);void startNext();}return;}
   await markStopped(id,'WAITING','Queued for one preparation worker');if(!queue.includes(id)&&!jobs.has(id))queue.push(id);void startNext();
  })();pendingEnqueues.set(id,operation);try{await operation;}finally{if(pendingEnqueues.get(id)===operation)pendingEnqueues.delete(id);}
 }
 async function cancel(id){
  const queued=queue.indexOf(id);if(queued>=0){queue.splice(queued,1);await markStopped(id,'CANCELLED','Cancelled before preparation');return;}
  const job=jobs.get(id);if(!job)return;job.cancelled=true;
  if(!job.child)return;
  if(process.platform==='win32')await new Promise(done=>{const killer=spawn('taskkill',['/PID',String(job.child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.once('exit',done);killer.once('error',done);});else job.child.kill('SIGTERM');
 }
 async function register(path,filename,slot){
  if(!Object.hasOwn(index.slots,slot))throw Error('Unknown song entry');
  const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);const id=hash.digest('hex');
  const dir=resolve(root,id);await mkdir(dir,{recursive:true});const target=resolve(dir,'source'+extname(filename).toLowerCase());
  if(!index.sources[id]){await rename(path,target);index.sources[id]={id,filename,source:target,createdAt:new Date().toISOString()};}else await unlink(path);
  index.slots[slot]=id;await saveIndex();const entry=index.sources[id];await writeFile(resolve(dir,'job.json'),JSON.stringify({folder:dir,source:entry.source,filename:entry.filename}));await enqueue(id);return id;
 }
 const verifiedAudio=new Map();
 const verifiedCoverage=new Map();
 async function verifyAudio(id,s){
  if(!s.source)return;const path=resolve(folder(id),'canonical.wav'),before=await stat(path),stamp=[s.source.canonicalWavSha256,before.size,before.mtimeMs,before.ctimeMs].join(':');
  if(verifiedAudio.get(id)===stamp)return;
  const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);const after=await stat(path);
  if(hash.digest('hex')!==s.source.canonicalWavSha256||before.size!==after.size||before.mtimeMs!==after.mtimeMs){
   const invalid={...s,state:'STALE',error:'Canonical audio bytes changed. Retry preparation before listening.',models:Object.fromEntries(Object.entries(s.models||{}).map(([m,v])=>[m,{...v,state:'STALE'}]))};await atomic(resolve(folder(id),'status.json'),invalid);throw Error(invalid.error);
  }verifiedAudio.set(id,stamp);
 }
 async function clip(id){
  const dir=folder(id),s=await status(id);if(!s.source)return null;const source=s.source;
  await verifyAudio(id,s);
  // Ready results are accepted only when their exact persisted event hash and contract match.
  const predictions={A:null,B:null,C:null},coverage={};for(const m of ['A','B','C'])if(s.models[m]?.state==='READY'){
   const bytes=await readFile(resolve(dir,m+'.json')),record=JSON.parse(bytes);if(digest(bytes)!==s.models[m].resultSha256||record.cacheKey!==s.models[m].cacheKey||record.sourceSha256!==id||record.pcmSha256!==source.decodedPcmSha256||s.contractSha256!==currentContract)throw Error('Stale or changed prediction source/model binding');
   predictions[m]=record.events;
   const coverageKey=id+':'+m+':'+s.models[m].resultSha256;
   if(!verifiedCoverage.has(coverageKey)){
    if(!/^models\/[a-f0-9]{64}\/raw\.json$/.test(record.rawFile))throw Error('Invalid raw cache path');const rawBytes=await readFile(resolve(dir,record.rawFile));if(digest(rawBytes)!==record.rawSha256)throw Error('Raw activation cache changed; retry preparation');const raw=JSON.parse(rawBytes);const observed={...frameCoverage(raw.times,m==='B'?256/22050:.01,source.duration),derivedFromRawSha256:record.rawSha256,derivationVersion:1};verifiedCoverage.set(coverageKey,observed);await atomic(resolve(dir,'coverage-'+m+'.json'),observed);
   }coverage[m]=verifiedCoverage.get(coverageKey);
  }
  return {id:'full-'+id,title:index.sources[id].filename,originalSourceSha256:id,canonicalWavSha256:source.canonicalWavSha256,decodedPcmSha256:source.decodedPcmSha256,sampleRate:44100,duration:source.duration,sourceOffset:0,start:0,end:source.duration,natural:true,mapping:source.transforms,audioUrl:'/lab/full/audio/'+id,predictions,coverage,raw:{A:null,B:null,C:null},constructedReferences:[],fullSong:true,source};
 }
 async function handle(request,response,url){
  const path=url.pathname;if(!path.startsWith('/lab/full/'))return false;
  const json=value=>{response.setHeader('Content-Type','application/json');response.end(JSON.stringify(value));};
  if(request.method==='POST'&&!['http://127.0.0.1:5173','http://localhost:5173'].includes(request.headers.origin))throw Error('Same-origin local preparation required');
  if(path==='/lab/full/songs'&&request.method==='GET'){
   const songs={};for(const [slot,id] of Object.entries(index.slots))songs[slot]=id?{...index.sources[id],source:undefined,status:await status(id)}:null;json({version:1,songs,limits:{uploadMiB:256,maxDurationSeconds:720,workerGiB:6,concurrency:1}});return true;
  }
  if(path==='/lab/full/upload'&&request.method==='POST'){
   const filename=decodeURIComponent(String(request.headers['x-audio-filename']||''));if(!filename||filename.length>250||/[\\/\x00-\x1f]/.test(filename)||!['.mp3','.wav','.flac'].includes(extname(filename).toLowerCase()))throw Error('Choose a local MP3, WAV or FLAC file');
   const slot=url.searchParams.get('slot');if(!Object.hasOwn(index.slots,slot))throw Error('Unknown song entry');
   const temp=resolve(root,'upload-'+randomUUID()+'.tmp'),file=await open(temp,'wx');let size=0;
   try{for await(const chunk of request){size+=chunk.length;if(size>256*1024**2)throw Error('Upload exceeds 256 MiB private limit');await file.write(chunk);}}catch(error){await file.close();await unlink(temp).catch(()=>{});throw error;}await file.close();if(!size){await unlink(temp);throw Error('Empty file');}
   json({id:await register(temp,filename,slot)});return true;
  }
  const match=/^\/lab\/full\/(status|clip|waveform|raw|audio|cancel|retry|feedback)\/([a-f0-9]{64})$/.exec(path);if(!match)throw Error('Unknown full-song route');const [,action,id]=match,dir=folder(id);
  if(action==='status'&&request.method==='GET')json(await status(id));
  else if(action==='clip'&&request.method==='GET')json(await clip(id));
  else if(action==='waveform'&&request.method==='GET')json(await read(resolve(dir,'waveform.json')));
  else if(action==='raw'&&request.method==='GET'){
   const at=Number(url.searchParams.get('at')),radius=Number(url.searchParams.get('radius')||2);if(!Number.isFinite(at)||!Number.isFinite(radius)||radius<=0||radius>10)throw Error('Invalid bounded raw window');const s=await status(id),result={};
   await clip(id);
   for(const m of ['A','B','C']){result[m]=null;if(s.models[m]?.state!=='READY')continue;const record=await read(resolve(dir,m+'.json'));if(!/^models\/[a-f0-9]{64}\/raw\.json$/.test(record.rawFile))throw Error('Invalid raw cache path');const bytes=await readFile(resolve(dir,record.rawFile));if(digest(bytes)!==record.rawSha256)throw Error('Raw activation cache changed; retry preparation');const raw=JSON.parse(bytes),indices=raw.times.flatMap((t,i)=>Math.abs(t-at)<=radius?[i]:[]);result[m]={...raw,times:indices.map(i=>raw.times[i]),scores:indices.map(i=>raw.scores[i]),scope:raw.scope+' Requested bounded raw window only.'};}json(result);
  }else if(action==='audio'&&request.method==='GET'){
   const s=await status(id);if(!s.source)throw Error('Canonical audio is not prepared');const file=resolve(dir,'canonical.wav'),size=(await stat(file)).size;let start=0,end=size-1;const range=request.headers.range;
   await verifyAudio(id,s);
   if(range){const r=/^bytes=(\d+)-(\d*)$/.exec(range);if(!r){response.writeHead(416);response.end();return true;}start=Number(r[1]);end=r[2]?Math.min(Number(r[2]),end):end;if(start>end||start>=size){response.writeHead(416);response.end();return true;}}
   response.writeHead(range?206:200,{'Content-Type':'audio/wav','Content-Length':end-start+1,'Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});createReadStream(file,{start,end}).pipe(response);
  }else if(action==='cancel'&&request.method==='POST'){await cancel(id);json({state:'CANCEL_REQUESTED'});}
  else if(action==='retry'&&request.method==='POST'){await enqueue(id);json({state:'QUEUED'});}
  else if(action==='feedback'){
   const key=url.searchParams.get('review')||'listener';if(!/^[\w-]{1,80}$/.test(key))throw Error('Invalid feedback namespace');const file=resolve(dir,'feedback-'+key+'.json');let notes=[];try{notes=await read(file);}catch(error){if(error.code!=='ENOENT')throw error;}
   if(request.method==='GET')json(notes);
   else if(request.method==='POST'){
    let body='';for await(const chunk of request){body+=chunk;if(body.length>8000)throw Error('Feedback too large');}const note=JSON.parse(body),c=await clip(id);
    if(!c||note.sourceSha256!==id||!Number.isFinite(note.sourceTime)||note.sourceTime<0||note.sourceTime>c.end||!['A','B','C'].includes(note.model)||!['original','short'].includes(note.renderer)||!feedbackTypes.includes(note.type)||typeof note.note!=='string'||note.note.length>1000)throw Error('Invalid source-bound qualitative note');
    const entry={version:1,id:randomUUID(),sourceSha256:id,canonicalWavSha256:c.canonicalWavSha256,sourceTime:note.sourceTime,model:note.model,renderer:note.renderer,type:note.type,note:note.note,reviewer:key,provenance:'model-exposed-qualitative-feedback',referenceStatus:'NOT_ACOUSTIC_GROUND_TRUTH',createdAt:new Date().toISOString(),analysisRevision:c.source.analysisRevision,nearbyPredictions:Object.fromEntries(['A','B','C'].map(m=>[m,(c.predictions[m]||[]).filter(e=>Math.abs(e.sourceTime-note.sourceTime)<=2)]))};
    // Serialize appends per source/namespace so rapid clicks never overwrite notes.
    const prior=feedbackWrites.get(file)||Promise.resolve();const operation=prior.then(async()=>{let latest=[];try{latest=await read(file);}catch(error){if(error.code!=='ENOENT')throw error;}if(latest.length>=10000)throw Error('Feedback limit reached; export before starting a separate review');latest.push(entry);await atomic(file,latest);});const settled=operation.catch(()=>{});feedbackWrites.set(file,settled);try{await operation;}finally{if(feedbackWrites.get(file)===settled)feedbackWrites.delete(file);}json(entry);
   }else throw Error('Unsupported feedback method');
  }else throw Error('Unsupported full-song method');return true;
 }
 const feedbackWrites=new Map();
 return {handle,clip,register,status,cancel,stop:async()=>{queue.length=0;if(running)await cancel(running.id);},root};
}
