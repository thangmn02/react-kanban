import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createWriteStream,createReadStream} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
const root=resolve('scratch/beat-grid-v2'),metadata=JSON.parse(await readFile(resolve(root,'hf-manifests.json'),'utf8'));
const selected={C2:['oaf_drums.onnx'],C3:['drumsep.onnx'],C4:['setting-tau-0.8/model.safetensors']};
const manifest=[];
for(const [lane,names] of Object.entries(selected))for(const name of names){
 const info=metadata[lane],file=info.siblings.find(f=>f.rfilename===name);if(!file?.lfs?.sha256)throw Error('Missing published checksum: '+lane+'/'+name);
 const path=resolve(root,'weights',lane,name),url=`https://huggingface.co/${info.id}/resolve/${info.sha}/${name}`;
 await mkdir(dirname(path),{recursive:true});
 const response=await fetch(url,{signal:AbortSignal.timeout(20*60*1000)});if(!response.ok)throw Error(response.status+': '+url);
 await pipeline(Readable.fromWeb(response.body),createWriteStream(path));
 const hash=createHash('sha256');let size=0;for await(const bytes of createReadStream(path)){hash.update(bytes);size+=bytes.length;}
 const sha256=hash.digest('hex');if(sha256!==file.lfs.sha256||size!==file.size)throw Error('Checkpoint identity mismatch: '+lane);
 manifest.push({lane,repository:info.id,revision:info.sha,url,path,sha256,size,licenseClaim:info.cardData?.license||'See pinned upstream license; weight scope requires review'});
 await writeFile(resolve(root,'checkpoint-manifest.json'),JSON.stringify(manifest,null,2));
 console.log(JSON.stringify(manifest.at(-1)));
}
