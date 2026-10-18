import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'vite';
import {validateReview,validateReviewTransition,blankReview} from './acoustic-visual-lab-core.ts';
import {createFullSongStore} from './full-song-store.mjs';
import {createHatRecoveryRoutes} from './hat-recovery-routes.mjs';
const folder=resolve('scratch/acoustic-visual-lab');
const fullSongs=await createFullSongStore(resolve(folder,'full-songs'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=await readFile(resolve(folder,'lab-data.json'));
const reuse=JSON.parse(await readFile(resolve(folder,'reuse-verification.json'),'utf8'));
if(hash(bytes)!==reuse.derivedDataSha256)throw Error('Derived data changed; inspect reuse receipt');
const data=JSON.parse(bytes),manifest=JSON.parse(await readFile('scratch/beat-grid-v2/corpus-manifest.json','utf8'));
const audio=new Map();
for(const clip of data.clips){
 const file=manifest.items.find(i=>i.id===clip.id).path;
 if(hash(await readFile(file))!==clip.canonicalWavSha256)throw Error('Changed canonical audio: '+clip.id);
 audio.set(clip.id,file);
}
const sites={};
for(const [name,source,base] of [['lab','acoustic-visual-lab.tsx','/lab/'],['grid','browser-beat-candidate.tsx','/']]){
 const entry=resolve(folder,name+'-entry'),site=resolve(folder,name+'-site');await mkdir(entry,{recursive:true});
 await writeFile(resolve(entry,'index.html'),`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Private ${name==='lab'?'Listening Lab':'Beat Grid'}</title></head><body><div id="root"></div><script type="module" src="../../../scripts/${source}"></script></body></html>`);
 await build({root:entry,base,configFile:false,logLevel:'error',build:{outDir:site,emptyOutDir:true,minify:false}});sites[name]=site;
}
await mkdir(resolve(folder,'annotations'),{recursive:true});
const htmlEscape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const sourceHtml=`<!doctype html><html><meta charset="utf-8"><title>Private diagnostic source</title><body style="background:#171820;color:#eee;font:18px system-ui;max-width:900px;margin:40px auto"><h1>Authorized diagnostic audio</h1><p>This is the exact canonical local PCM used in the saved benchmark. No video or external provider.</p><label>Passage <select id="clip">${data.clips.map(c=>`<option value="${c.id}">${htmlEscape(c.id+' — '+c.title)}</option>`).join('')}</select></label><p id="identity"></p><audio controls></audio><p><a href="http://127.0.0.1:5173/?musicDebug=1" style="color:#b9a5ff" target="_blank">Open live baseline trace grid</a></p><p>Play here, click the private Companion toolbar icon on this tab, then enable unverified live preview in the grid. The offline lab and this live source are separate sessions; stop one before playing the other.</p><script src="/source.js"></script></body></html>`;
const sourceJs=`const clips=${JSON.stringify(data.clips.map(c=>({id:c.id,title:c.title,sha:c.canonicalWavSha256,start:c.start-c.sourceOffset,end:c.end-c.sourceOffset,offset:c.sourceOffset}))).replaceAll('<','\\u003c')};const select=document.querySelector('#clip'),audio=document.querySelector('audio');function load(){audio.pause();const c=clips.find(c=>c.id===select.value);document.title='Kora diagnostic · '+c.id+' · '+c.sha;document.querySelector('#identity').textContent='Canonical WAV SHA-256: '+c.sha+'; source time = player time + '+c.offset+' s.';audio.src='/audio/'+c.id+'.wav';audio.onloadedmetadata=()=>audio.currentTime=c.start;}select.onchange=load;load();`;
const servers=[],reviewWrites=new Map();
const hatRecovery=createHatRecoveryRoutes(sendFile);
async function sendFile(request,response,file,type){
 const size=(await stat(file)).size;const range=request.headers.range;
 let start=0,end=size-1;
 if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);if(!match){response.writeHead(416,{'Content-Range':`bytes */${size}`});response.end();return;}
  start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;if(start>end||start>=size){response.writeHead(416,{'Content-Range':`bytes */${size}`});response.end();return;}}
 response.writeHead(range?206:200,{'Content-Type':type,'Content-Length':end-start+1,'Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
 response.end((await readFile(file)).subarray(start,end+1));
}
for(const port of [5173,5174]){
 const server=createServer(async(request,response)=>{
  response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');
  try{
   if(!['127.0.0.1:'+port,'localhost:'+port].includes(request.headers.host))throw Error('Local host required');
   const url=new URL(request.url,'http://127.0.0.1:'+port),path=decodeURIComponent(url.pathname);
   if(port===5173&&await hatRecovery(request,response,url))return;
   if(port===5173&&await fullSongs.handle(request,response,url))return;
   if(port===5173&&path.startsWith('/lab/review/')){
    const id=path.slice('/lab/review/'.length),clip=data.clips.find(c=>c.id===id)||(id.startsWith('full-')?await fullSongs.clip(id.slice(5)):null);if(!clip)throw Error('Unknown source');
    const reviewKey=url.searchParams.get('review')||'listener';if(!/^[a-zA-Z0-9_-]{1,80}$/.test(reviewKey))throw Error('Invalid review namespace');
    const exposedReview=id.startsWith('full-')&&reviewKey.startsWith('full-exposed-');
    const protectExposure=review=>exposedReview?{...review,modelsRevealed:true,referenceSelectionExposed:true,frozen:false,referenceStatus:'provisional-human-reference'}:review;
    const file=resolve(folder,'annotations',id+'-'+reviewKey+'.json');
    if(request.method==='POST'){
     if(request.headers.origin!=='http://127.0.0.1:5173'&&request.headers.origin!=='http://localhost:5173')throw Error('Same-origin review required');
     let body='';for await(const chunk of request){body+=chunk;if(body.length>2000000)throw Error('Review too large');}
     const submitted=validateReview(JSON.parse(body),clip);
     if(exposedReview&&(!submitted.modelsRevealed||!submitted.referenceSelectionExposed||submitted.frozen))throw Error('Feedback-linked review must remain model-exposed and provisional');
     const operation=(reviewWrites.get(file)||Promise.resolve()).then(async()=>{
      let prior;try{prior=validateReview(protectExposure(JSON.parse(await readFile(file,'utf8'))),clip);}catch(error){if(error.code!=='ENOENT')throw error;prior=protectExposure(blankReview(clip));}
      if(submitted.revision!==prior.revision){const conflict=Error('Annotation revision conflict. Reload the latest review before saving.');conflict.status=409;throw conflict;}
      validateReviewTransition(prior,submitted);
      submitted.revision=prior.revision+1;
      await writeFile(resolve(folder,'annotations',`${id}-${reviewKey}-${Date.now()}-${crypto.randomUUID()}.json`),JSON.stringify(submitted,null,2));
      await writeFile(file,JSON.stringify(submitted,null,2));return submitted;
     });
     const settled=operation.catch(()=>{});reviewWrites.set(file,settled);
     let review;try{review=await operation;}finally{if(reviewWrites.get(file)===settled)reviewWrites.delete(file);}
     response.setHeader('Content-Type','application/json');response.end(JSON.stringify(review));return;
    }
    if(request.method!=='GET')throw Error('Unsupported method');
    let review;try{review=validateReview(protectExposure(JSON.parse(await readFile(file,'utf8'))),clip);}catch(error){if(error.code!=='ENOENT')throw error;review=protectExposure(blankReview(clip));}
    response.setHeader('Content-Type','application/json');response.end(JSON.stringify(review));return;
   }
   if(request.method!=='GET')throw Error('Read-only route');
   const match=/^\/(?:lab\/)?audio\/([a-zA-Z0-9_-]+)\.wav$/.exec(path);
   if(match&&audio.has(match[1])){await sendFile(request,response,audio.get(match[1]),'audio/wav');return;}
   if(port===5174){if(path==='/'){response.setHeader('Content-Type','text/html');response.end(sourceHtml);return;}if(path==='/source.js'){response.setHeader('Content-Type','text/javascript');response.end(sourceJs);return;}throw Error('Unknown source route');}
   if(path==='/lab/data.json'){response.setHeader('Content-Type','application/json');response.end(bytes);return;}
   if(path==='/lab/reuse.json'){response.setHeader('Content-Type','application/json');response.end(JSON.stringify(reuse));return;}
   if(path==='/lab') {response.writeHead(302,{Location:'/lab/'});response.end();return;}
   const lab=path.startsWith('/lab/'),site=lab?sites.lab:sites.grid,relative=lab?path.slice(4):path;
   const file=resolve(site,'.'+(relative==='/'?'/index.html':relative));if(!file.startsWith(site+sep))throw Error('Path outside private build');
   await sendFile(request,response,file,({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(file)]||'application/octet-stream');
  }catch(error){if(!response.headersSent)response.writeHead(error.status||400,{'Content-Type':'text/plain'});response.end(String(error.message));}
 });
 try{await new Promise((done,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',done);});servers.push(server);}catch(error){await Promise.all(servers.map(s=>new Promise(done=>s.close(done))));throw error;}
}
const processReceipt={pid:process.pid,ports:[5173,5174],command:'node scripts/serve-acoustic-visual-lab.mjs',worktree:process.cwd(),startedAt:new Date().toISOString()};
await writeFile(resolve(folder,'server-process.json'),JSON.stringify(processReceipt,null,2));console.log(JSON.stringify(processReceipt));
const stop=async()=>{await fullSongs.stop();await Promise.all(servers.map(s=>new Promise(done=>s.close(done))));};process.once('SIGINT',stop);process.once('SIGTERM',stop);
