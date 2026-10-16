import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('scratch/beat-grid-v2'),corpus=JSON.parse(await readFile(resolve(root,'corpus-manifest.json'),'utf8'));
const repository='marl/medleydb';
async function get(url){const response=await fetch(url,{headers:{'User-Agent':'Kora-private-evaluation'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`${response.status}: ${url}`);return response;}
const metadata=await (await get(`https://api.github.com/repos/${repository}`)).json();
const commit=await (await get(`https://api.github.com/repos/${repository}/commits/${metadata.default_branch}`)).json();
const tree=await (await get(`https://api.github.com/repos/${repository}/git/trees/${commit.sha}?recursive=1`)).json();
const tracks=[...new Set(corpus.items.filter(i=>i.splitGroup).map(i=>i.splitGroup))];
const folder=resolve(root,'genre-metadata');await mkdir(folder,{recursive:true});
const records=[];
for(const track of tracks){
 const file=tree.tree.find(f=>f.path.endsWith('/'+track+'_METADATA.yaml'));
 if(!file)throw Error('Missing author metadata: '+track);
 const url=`https://raw.githubusercontent.com/${repository}/${commit.sha}/${file.path}`;
 const bytes=Buffer.from(await (await get(url)).arrayBuffer());const path=resolve(folder,track+'.yaml');await writeFile(path,bytes);
 records.push({track,path,url,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(resolve(root,'genre-manifest.json'),JSON.stringify({repository,commit:commit.sha,records},null,2));
console.log(JSON.stringify({repository,revision:commit.sha,tracks:records.length}));
