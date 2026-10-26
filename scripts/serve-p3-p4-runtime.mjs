import {createServer} from 'node:http';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('scratch/p3-p4-261026-1706');
const receiptName=process.argv.find(a=>a.startsWith('--receipt='))?.slice(10)||'runtime-build.json';
if(!/^[a-z0-9.-]+$/.test(receiptName))throw Error('Invalid receipt name');
const receipt=JSON.parse(await readFile(resolve(root,receiptName),'utf8'));
const assets=new Map();
for(const [path,hash]of Object.entries(receipt.assets)){
  const bytes=await readFile(resolve(receipt.output,'.'+path));
  if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('Changed app asset '+path);
  assets.set(path,bytes);
}
const audio=new Map();
for(const sha of ['7d0d14b2da7ac6e1fbf48d70e66c1083182b07f6cc7a820b5effd52a39db9f8c','df2173a39346b36c188e086d4d5c301c5356832267c048e3e2d39917042da108']){
  const path=`/scratch/acoustic-visual-lab/full-songs/${sha}/canonical.wav`;
  audio.set(path,await readFile(resolve('.'+path)));
}
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.wav':'audio/wav','.png':'image/png','.svg':'image/svg+xml'};
const controlReceipt=JSON.parse(await readFile(resolve(root,'endurance-source.json'),'utf8'));
const control=await readFile(controlReceipt.controlPath),controlData=control.subarray(44),controlHeader=Buffer.from(control.subarray(0,44));
if(createHash('sha256').update(control).digest('hex')!==controlReceipt.originalSha256)throw Error('Changed endurance control');
controlHeader.writeUInt32LE(controlReceipt.totalBytes-8,4);controlHeader.writeUInt32LE(controlReceipt.totalBytes-44,40);
const server=createServer(async(request,response)=>{
  try{
    if(!['GET','HEAD'].includes(request.method))throw Error('Read-only qualification');
    const path=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    if(path===controlReceipt.audioUrl){
      let start=0,end=controlReceipt.totalBytes-1,status=200;
      if(request.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(request.headers.range);if(!match)throw Error('Invalid range');start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;status=206;}
      if(start>end||start>=controlReceipt.totalBytes){response.writeHead(416);response.end();return;}
      response.writeHead(status,{'Content-Type':'audio/wav','Content-Length':end-start+1,'Accept-Ranges':'bytes',...(status===206?{'Content-Range':`bytes ${start}-${end}/${controlReceipt.totalBytes}`}:{})});
      if(request.method==='HEAD'){response.end();return;}
      const send=()=>{
        while(start<=end&&!response.destroyed){
          const offset=(start-44)%controlData.length;
          const bytes=start<44?controlHeader.subarray(start,Math.min(44,end+1)):controlData.subarray(offset,Math.min(controlData.length,offset+Math.min(65536,end-start+1)));
          start+=bytes.length;if(!response.write(bytes)){response.once('drain',send);return;}
        }
        if(!response.destroyed)response.end();
      };send();return;
    }
    let bytes=audio.get(path),type=bytes?'audio/wav':types[extname(path)];
    if(!bytes&&path.startsWith('/scratch/p3-p4-261026-1706/')){
      const file=resolve('.'+path);if(!file.startsWith(root+sep))throw Error('Outside task root');
      if(!(await stat(file)).isFile())throw Error('Not a file');bytes=await readFile(file);
    }
    if(!bytes){const key=assets.has(path)?path:!extname(path)?'/index.html':null;bytes=key&&assets.get(key);type=key&&types[extname(key)];}
    if(!bytes){response.writeHead(404);response.end();return;}
    let start=0,end=bytes.length-1,status=200;
    if(request.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(request.headers.range);if(!match)throw Error('Unsupported range');
      start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;
      if(start>end||start>=bytes.length){response.writeHead(416);response.end();return;}
      status=206;response.setHeader('Content-Range',`bytes ${start}-${end}/${bytes.length}`);
    }
    response.writeHead(status,{'Content-Type':type||'application/octet-stream','Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'no-store'});
    response.end(request.method==='HEAD'?undefined:bytes.subarray(start,end+1));
  }catch{response.writeHead(404);response.end();}
});
await new Promise((done,fail)=>{server.once('error',fail);server.listen(1420,'127.0.0.1',done);});
const processReceipt={pid:process.pid,command:process.argv.join(' '),port:1420,startedAt:new Date().toISOString(),worktree:process.cwd(),hmr:false};
await writeFile(resolve(root,'runtime-server-process.json'),JSON.stringify(processReceipt,null,2));console.log(JSON.stringify(processReceipt));
const stop=()=>{server.close();server.closeIdleConnections();};process.once('SIGINT',stop);process.once('SIGTERM',stop);
