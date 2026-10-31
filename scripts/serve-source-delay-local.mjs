/** Kora Local (mock data, no database) frontend for the Enhanced Beat Sync owner test. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createServer} from 'node:http';
import {build} from 'vite';

const arg=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const root=arg('output');assert.match(root??'',/^scratch\/[a-z0-9/_-]+$/,'--output=scratch/... is required');
await mkdir(root,{recursive:false});const site=resolve(root,'site');
// Explicit values win over any .env file; no Supabase URL or key reaches the build.
Object.assign(process.env,{VITE_AUTH_MODE:'mock',VITE_SUPABASE_URL:'',VITE_SUPABASE_ANON_KEY:'',VITE_ENABLE_SOURCE_AUDIO_DELAY:'true',
  VITE_PRIVATE_NATIVE_COMPANION_CAPTURE:'false',VITE_PRIVATE_BEAT_CANDIDATE:'false',VITE_ENABLE_BEAT_GRID_PREVIEW:'false',
  VITE_OWNER_PREVIEW_LOOPBACK:'true'});
await build({logLevel:'error',build:{outDir:site}});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.onnx':'application/octet-stream','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://127.0.0.1:1420').pathname;
    const file=resolve(site,'.'+(extname(path)?decodeURIComponent(path):'/index.html'));assert.ok(file.startsWith(site+sep));
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end();}
});
let timer;
try{
  await new Promise((done,fail)=>{server.once('error',fail);server.listen(1420,'127.0.0.1',done);});
  await writeFile(resolve(root,'server-process.json'),JSON.stringify({pid:process.pid,command:process.argv,createdAt:new Date().toISOString(),port:1420,
    worktree:process.cwd(),authMode:'mock',database:false,sourceAudioDelay:true},null,2));
  console.log('Kora Local frontend ready on http://127.0.0.1:1420 (mock data). Create '+root+'/stop-server to stop.');
  await new Promise(done=>{process.once('SIGINT',done);process.once('SIGTERM',done);timer=setInterval(()=>{void access(resolve(root,'stop-server')).then(done,()=>{});},500);});
}finally{clearInterval(timer);if(server.listening)await new Promise(done=>server.close(done));await writeFile(resolve(root,'server-cleanup.json'),JSON.stringify({at:new Date().toISOString(),closed:true}));}
