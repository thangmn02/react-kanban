// Loopback-only server for the Lead Annotation Editor. Serves the editor, the candidate modules for
// comparison lanes, and (read-only) the owner's original Downloads audio and draft labels by manifest slug.
import {createServer} from 'node:http';
import {readFile,writeFile,access} from 'node:fs/promises';
import {extname} from 'node:path';
const port=Number(process.argv[2]||5175),root='scratch/live-lead-261031/',editor='scripts/lead-research/annotation-editor/';
const manifest=JSON.parse(await readFile(root+'downloads/manifest.json','utf8'));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    let file;
    if(path==='/'||path==='/annotate/')file=editor+'index.html';
    else if(/^\/(annotate\/)?[a-z]+\.js$/.test(path))file=editor+path.split('/').pop();
    else if(/^\/ext\/(lead-tracker|lead-contour-tracker|lead-source-model)\.js$/.test(path))file='extensions/kanban-music/'+path.slice(5);
    else if(/^\/owner-audio\/[0-9a-f]{10}$/.test(path)){const m=manifest.find(x=>x.slug===path.slice(13));if(m)file='C:/Users/thang/Downloads/'+m.file;}
    else if(/^\/owner-draft\/[^/]+\.lead-labels\.json$/.test(path))file='C:/Users/thang/Downloads/'+path.slice(13);
    if(!file)throw new Error('not served');
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end();}
});
let timer;
try{
  await new Promise((done,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',done);});
  await writeFile(root+'annotate-server.json',JSON.stringify({pid:process.pid,port,createdAt:new Date().toISOString(),worktree:process.cwd()}));
  console.log(`Lead Annotation Editor on http://127.0.0.1:${port}/ ; create ${root}stop-annotate to stop.`);
  await new Promise(done=>{process.once('SIGINT',done);process.once('SIGTERM',done);timer=setInterval(()=>{void access(root+'stop-annotate').then(done,()=>{});},500);});
}finally{clearInterval(timer);server.close();}
