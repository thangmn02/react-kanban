/** Isolated staging frontend; never reads production configuration. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {build} from 'vite';
import {qualificationTarget} from './qualification-target.mjs';
import {handleNoteImages} from '../server/note-images.ts';

const {config,root,staging}=await qualificationTarget('scratch/final-completion-261029/native-delay/native');assert.ok(staging);
const runtime=resolve(root,'runtime');await mkdir(runtime,{recursive:false});const site=resolve(runtime,'site');
Object.assign(process.env,{VITE_AUTH_MODE:'supabase',VITE_ENABLE_NOTES_PREVIEW:'true',VITE_SUPABASE_URL:config.API_URL,VITE_SUPABASE_ANON_KEY:config.ANON_KEY,VITE_PRIVATE_NATIVE_COMPANION_CAPTURE:'true'});
await build({logLevel:'error',build:{outDir:site}});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://127.0.0.1:1420').pathname;
    if(path==='/api/note-images'){
      const headers=new Headers();for(const[key,value]of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
      const request=new Request('http://127.0.0.1:1420/api/note-images',{method:req.method,headers,...(req.method==='POST'?{body:Readable.toWeb(req),duplex:'half'}:{})});
      const reply=await handleNoteImages(request,{supabaseUrl:config.API_URL,anonKey:config.ANON_KEY,serviceRoleKey:config.SERVICE_ROLE_KEY});
      res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()));return;
    }
    const file=resolve(site,'.'+(extname(path)?decodeURIComponent(path):'/index.html'));assert.ok(file.startsWith(site+sep));
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end();}
});
let timer;
try{
  await new Promise((done,fail)=>{server.once('error',fail);server.listen(1420,'127.0.0.1',done);});
  await writeFile(resolve(runtime,'server-process.json'),JSON.stringify({pid:process.pid,command:process.argv,createdAt:new Date().toISOString(),port:1420,worktree:process.cwd(),target:'authorized staging only',privateCompanionCapture:true}));
  console.log('Isolated native-delay frontend ready on loopback 1420. Server credentials stay outside the build.');
  await new Promise(done=>{process.once('SIGINT',done);process.once('SIGTERM',done);timer=setInterval(()=>{void access(resolve(runtime,'stop-server')).then(done,()=>{});},500);});
}finally{clearInterval(timer);if(server.listening)await new Promise(done=>server.close(done));await writeFile(resolve(runtime,'server-cleanup.json'),JSON.stringify({at:new Date().toISOString(),closed:true}));}
