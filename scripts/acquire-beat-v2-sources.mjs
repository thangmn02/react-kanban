import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const root=resolve('scratch/beat-grid-v2'),sources=resolve(root,'sources');
await mkdir(sources,{recursive:true});
const repos={C1:'FrancescoZumo/frame_level_drum_classifier',C3:'inagoy/drumsep',C4:'pier-maker92/ADT_STR',C5:'ddman1101/Separate-and-detect',C6:'miraer/drum2midi',C7:'varsaav/yodo'};
const hubs={C2:'thebluescreen/oaf-drums-onnx',C3:'splitzo/drumsep',C4:'Pierfrancesco/adt-str',C5:'ddman1101/Separate-and-Detect'};
const result={frozenBase:'c93046ad262db21577792eed0ee61c3452525328',acquiredAt:new Date().toISOString(),repositories:{},checkpoints:{},errors:[]};
async function get(url){const r=await fetch(url,{headers:{'User-Agent':'Kora-private-model-audit'},signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`${r.status}: ${url}`);return r;}
async function save(path,bytes){await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);}
for(const [lane,repo] of Object.entries(repos)){
 try{
  const meta=await (await get('https://api.github.com/repos/'+repo)).json();
  const commit=await (await get(`https://api.github.com/repos/${repo}/commits/${meta.default_branch}`)).json();
  const tree=await (await get(`https://api.github.com/repos/${repo}/git/trees/${commit.sha}?recursive=1`)).json();
  const selected=tree.tree.filter(f=>f.type==='blob'&&f.size<1000000
   &&! /^(midi_onset_gt|transcription_results|data|test_data)\//.test(f.path)
   &&(/\.(py|toml|ya?ml|json|cfg|names|sh|ipynb)$/i.test(f.path)||/README|LICENSE|NOTICE|requirements|requirement/i.test(f.path)));
  const record={repo,url:'https://github.com/'+repo,commit:commit.sha,license:meta.license?.spdx_id||null,tree:tree.tree,downloaded:[],failures:[]};
  for(let offset=0;offset<selected.length;offset+=6)await Promise.all(selected.slice(offset,offset+6).map(async file=>{try{const bytes=await (await get(`https://raw.githubusercontent.com/${repo}/${commit.sha}/${file.path}`)).arrayBuffer();
   const local=file.path.replace(/\.md$/i,'.source.txt');await save(resolve(sources,lane,local),Buffer.from(bytes));record.downloaded.push({upstream:file.path,local});
  }catch(e){record.failures.push(String(e));}}));
  result.repositories[lane]=record;console.log(JSON.stringify({lane,repo,commit:commit.sha,license:record.license,sourceFiles:record.downloaded.length,weights:tree.tree.filter(f=>/\.(onnx|safetensors?|ckpt|pth|weights)$/i.test(f.path))}));
 }catch(e){result.errors.push({lane,stage:'github',error:String(e)});console.log(JSON.stringify(result.errors.at(-1)));}
 await writeFile(resolve(root,'acquisition-sources.json'),JSON.stringify(result,null,2));
}
for(const [lane,repo] of Object.entries(hubs)){
 try{const info=await (await get(`https://huggingface.co/api/models/${repo}?blobs=true`)).json();
  result.checkpoints[lane]=info;
  for(const file of info.siblings.filter(f=>!/\.gitattributes$/.test(f.rfilename)&&!f.lfs&&(!f.size||f.size<1000000)&&/README|LICENSE|NOTICE|\.json$|\.py$|\.ya?ml$|requirements|\.toml$/i.test(f.rfilename))){
   const local=file.rfilename.replace(/\.md$/i,'.source.txt');try{await save(resolve(sources,lane+'-hub',local),Buffer.from(await (await get(`https://huggingface.co/${repo}/resolve/${info.sha}/${file.rfilename}`)).arrayBuffer()));}catch(e){result.errors.push({lane,stage:file.rfilename,error:String(e)});}}
  console.log(JSON.stringify({lane,hub:repo,revision:info.sha,license:info.cardData?.license,files:info.siblings.map(f=>({path:f.rfilename,size:f.size,lfs:f.lfs}))}));
 }catch(e){result.errors.push({lane,stage:'huggingface',error:String(e)});console.log(JSON.stringify(result.errors.at(-1)));}
 await writeFile(resolve(root,'acquisition-sources.json'),JSON.stringify(result,null,2));
}
// Existing bytes are evidence, not automatically learned model checkpoints.
const inventory=JSON.parse(await readFile(resolve(root,'local-model-inventory.json'),'utf8'));
result.priorModelHashes=Object.entries(inventory.groups).filter(([,g])=>g.size>1000000).map(([sha,g])=>({sha256:sha,...g}));
await writeFile(resolve(root,'acquisition-sources.json'),JSON.stringify(result,null,2));
