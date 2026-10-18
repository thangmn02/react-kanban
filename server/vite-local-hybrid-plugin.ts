import type {Plugin} from 'vite';
import {resolve} from 'node:path';
/** Explicit private development route. No model/audio endpoint is emitted in builds. */
export function localHybridDevelopmentPlugin(enabled:boolean):Plugin {
 return {name:'private-local-hybrid',apply:'serve',async configureServer(server){
  if(!enabled)return;
  const {createFullSongStore}=await import('../scripts/full-song-store.mjs');
  const store=await createFullSongStore(resolve('scratch/acoustic-visual-lab/full-songs'),{allowedOrigins:['http://127.0.0.1:1420','http://localhost:1420']});
  const {savedLocalLead}=await import('./local-lead-cache.mjs');
  server.middlewares.use(async(req,res,next)=>{
   if(!req.url?.startsWith('/lab/full/'))return next();
   try{
    if(!['127.0.0.1:1420','localhost:1420'].includes(req.headers.host||''))throw Error('Private loopback host required');
    if(req.headers.origin&&!['http://127.0.0.1:1420','http://localhost:1420'].includes(req.headers.origin))throw Error('Private application origin required');
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const match=/^\/lab\/full\/clip\/([a-f0-9]{64})$/.exec(new URL(req.url,'http://127.0.0.1:1420').pathname);
    if(match&&req.method==='GET'){const clip=await store.clip(match[1]);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(clip?{...clip,lead:await savedLocalLead(store.root,match[1],clip)}:null));return;}
    if(!await store.handle(req,res,new URL(req.url,'http://127.0.0.1:1420')))next();
   }catch(error){res.statusCode=400;res.end(error instanceof Error?error.message:'Private local analysis unavailable');}
  });
  server.httpServer?.once('close',()=>void store.stop());
 }};
}
