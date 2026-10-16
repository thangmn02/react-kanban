import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('scratch/beat-grid-v2'),meta=JSON.parse(await readFile(resolve(root,'mdb-original-acquisition.json'),'utf8'));
const files=meta.tree.filter(f=>f.type==='blob'&&(/audio\/(drum_only|full_mix)\/.*\.wav$/.test(f.path)
 ||/annotations\/(class|subclass)\//.test(f.path)||/README|LICENSE/i.test(f.path)));
const result={repository:meta.repo,revision:meta.commit,purpose:'private noncommercial research evaluation',files:[],errors:[]};
for(let offset=0;offset<files.length;offset+=4)await Promise.all(files.slice(offset,offset+4).map(async f=>{
 try{const url=`https://raw.githubusercontent.com/${meta.repo}/${meta.commit}/${encodeURI(f.path)}`;
  const r=await fetch(url,{signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error(r.status);
  const bytes=Buffer.from(await r.arrayBuffer()),local=f.path.replace(/^MDB Drums\//,'').replace(/\.md$/i,'.source.txt'),path=resolve(root,'reference-data',local);
  if(bytes.length!==f.size)throw Error('Reference byte length mismatch');await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);
  result.files.push({upstream:f.path,path,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
 }catch(e){result.errors.push({file:f.path,error:String(e)});}
}));
await writeFile(resolve(root,'reference-data-manifest.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({revision:meta.commit,files:result.files.length,errors:result.errors}));
if(result.errors.length)process.exitCode=1;
