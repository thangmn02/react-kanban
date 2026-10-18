// Read-only private investigation snapshots; no upload, model tuning or annotation route.
import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
export function createHatRecoveryRoutes(sendFile){
 const root=resolve('scratch/hat-recovery'),verified=new Map();
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
 async function snapshot(name,manifest){const bytes=await readFile(resolve(root,name));if(digest(bytes)!==manifest.files[name])throw Error('Investigation snapshot changed; rerun its verified analysis');return bytes;}
 async function verifyAudio(path,expected){
  const before=await stat(path),stamp=[expected,before.size,before.mtimeMs,before.ctimeMs].join(':');if(verified.get(path)===stamp)return;
  const hash=createHash('sha256');for await(const part of createReadStream(path))hash.update(part);const after=await stat(path);
  if(hash.digest('hex')!==expected||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('Investigation audio identity changed; playback unavailable');verified.set(path,stamp);
 }
 return async(request,response,url)=>{
  if(!url.pathname.startsWith('/lab/hat-recovery/'))return false;
  if(request.method!=='GET')throw Error('Investigation is read-only');
  const manifest=JSON.parse(await readFile(resolve(root,'view-manifest.json'),'utf8'));
  const bytes=await snapshot('view-data.json',manifest),data=JSON.parse(bytes);
  const json=value=>{response.setHeader('Content-Type','application/json');response.end(value);};
  if(url.pathname==='/lab/hat-recovery/data'){json(bytes);return true;}
  const match=/^\/lab\/hat-recovery\/(clip|raw|audio)\/([a-f0-9]{64})$/.exec(url.pathname);if(!match)throw Error('Unknown investigation route');
  const [,action,id]=match,source=data.sources[id];if(!source)throw Error('Unknown frozen investigation source');
  await verifyAudio(source.audioPath,source.source.canonicalWavSha256);
  if(action==='clip')json(await snapshot(id+'.json',manifest));
  else if(action==='raw'){
   const at=Number(url.searchParams.get('at')),radius=Number(url.searchParams.get('radius'));
   if(!Number.isFinite(at)||at<0||at>source.source.duration||!Number.isFinite(radius)||radius<=0||radius>2)throw Error('Invalid bounded raw-score window');
   const raw=JSON.parse(await snapshot('raw-'+id+'.json',manifest)),window={sourceSha256:id,at,radius,models:{}};
   for(const [m,r] of Object.entries(raw)){const indices=r.times.flatMap((time,i)=>Math.abs(time-at)<=radius?[i]:[]);window.models[m]={classes:r.classes,times:indices.map(i=>r.times[i]),scores:indices.map(i=>r.scores[i]),scope:'Frozen uncalibrated activations; A threshold applies to novelty, not its raw score.'};}json(JSON.stringify(window));
  }else await sendFile(request,response,source.audioPath,'audio/wav');
  return true;
 };
}
