/** Publish a built public Kora release to the production Netlify site in two gated steps.
 *  --draft            upload dist/ plus the verified Linux functions as an unpublished deploy and print its URL.
 *  --publish=<id>     promote that exact verified draft; the previous deploy stays available for rollback.
 *  Credentials are read from the owner's Netlify login and never printed. */
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,lstat,mkdir} from 'node:fs/promises';
import {resolve,join,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {parseEnv} from 'node:util';
import {execFileSync} from 'node:child_process';

const siteId='0c8406d3-9d2e-4afd-8351-140813bfbaf9',productionRef='lthlvntvjgnornrdxnms',stagingRef='enzzyuhchizfmruxhfhg';
const arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
const hash=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
const login=JSON.parse(await readFile(join(process.env.APPDATA,'netlify/Config/config.json'),'utf8'));
const token=login.users?.[login.userId]?.auth?.token;assert.ok(token,'Sign in with the owner Netlify account first (npx netlify login).');
async function api(path,{method='GET',body,bytes}={}){
  const response=await fetch('https://api.netlify.com/api/v1'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:bytes?{'Content-Type':'application/octet-stream'}:{})},body:body?JSON.stringify(body):bytes,signal:AbortSignal.timeout(120000)});
  assert.ok(response.ok,`Netlify ${method} ${path.split('?')[0]} failed (${response.status}); provider details withheld.`);
  return response.status===204?null:response.json();
}
const site=await api('/sites/'+siteId);
assert.equal(site.name,'kanthangboard');assert.equal(site.ssl_url,'https://koraspace.online');
const output=resolve(arg('output')||'scratch/release-0.1.33/publication');await mkdir(output,{recursive:true});

if(arg('publish')){
  const id=arg('publish'),before=site.published_deploy.id;
  const draft=await api('/deploys/'+id);
  assert.equal(draft.site_id,siteId);assert.equal(draft.state,'ready','Only a ready, verified draft can be promoted.');
  const receipt=JSON.parse(await readFile(join(output,'draft.json'),'utf8'));assert.equal(receipt.deployId,id,'Promote only the draft this release created.');
  await api('/sites/'+siteId+'/deploys/'+id+'/restore',{method:'POST'});
  const after=await api('/sites/'+siteId);assert.equal(after.published_deploy.id,id,'Promotion was not confirmed.');
  await writeFile(join(output,'published.json'),JSON.stringify({at:new Date().toISOString(),siteId,deployId:id,previousDeployId:before,sourceCommit:receipt.sourceCommit,rollback:`POST /sites/${siteId}/deploys/${before}/restore`},null,2));
  console.log(JSON.stringify({status:'PUBLISHED',deployId:id,previousDeployId:before}));
  process.exit(0);
}

assert.ok(process.argv.includes('--draft'),'Use --draft to stage, or --publish=<deployId> to promote a verified draft.');
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}),'','Publish only from a committed tree.');
const dist=resolve('dist'),functionsRoot=resolve(arg('linux-functions')||'');
// Every credential the owner keeps locally; none may appear in a published byte.
const credentials=[token];
const production=parseEnv(await readFile(join(process.env.LOCALAPPDATA,'Kora/secrets/production.env'),'utf8'));
for(const[name,value]of Object.entries(production))if(/SERVICE_ROLE|DB_URL|PASSWORD|SECRET|TOKEN/.test(name)&&value?.length>=8)credentials.push(value);
if(production.KORA_PRODUCTION_DB_URL)credentials.push(decodeURIComponent(new URL(production.KORA_PRODUCTION_DB_URL).password));
for(const file of ['.env.staging.local']){try{for(const[name,value]of Object.entries(parseEnv(await readFile(file,'utf8'))))if(/SERVICE_ROLE|DB_URL|SECRET/.test(name)&&value?.length>=8)credentials.push(value);}catch(error){if(error.code!=='ENOENT')throw error;}}

// The public Companion is outside this release: publish the live bytes unchanged.
const live=Buffer.from(await (await fetch('https://koraspace.online/downloads/kora-music-companion.zip',{signal:AbortSignal.timeout(120000)})).arrayBuffer());
assert.ok(live.length>1_000_000,'Could not retain the live Companion download.');
const files={},bytesBySha=new Map(),inventory=[];
async function collect(directory){
  for(const name of await readdir(directory)){
    const file=join(directory,name),stat=await lstat(file);assert.ok(!stat.isSymbolicLink(),'No linked files may be published.');
    if(stat.isDirectory()){await collect(file);continue;}
    const path='/'+relative(dist,file).split(sep).join('/');
    let bytes=await readFile(file);
    if(path==='/downloads/kora-music-companion.zip'||path==='/downloads/kanban-music-companion.zip')bytes=live;
    assert.ok(!/(?:^|\/)(?:\.env[^/]*|scratch|\.git|\.netlify)(?:\/|$)|\.(?:key|pem|dpapi|dump|kora-backup|map)$/.test(path),`Private path in publication: ${path}`);
    assert.ok(!credentials.some(value=>bytes.includes(Buffer.from(value))),'Private credential match in publication; values withheld.');
    if(/\.(?:js|html|json|mjs)$/.test(path))assert.ok(!bytes.includes(Buffer.from(stagingRef)),'Staging routing leaked into the production release.');
    const sha=hash(bytes,'sha1');files[path]=sha;bytesBySha.set(sha,{path,bytes});inventory.push({path,sha256:hash(bytes),size:bytes.length});
  }
}
await collect(dist);
// API deploys do not read netlify.toml; publish its redirects and headers as _redirects/_headers so SPA routes,
// function routes and download caching match a CLI deploy.
export function netlifyRules(toml){
  const blocks=[];let current;
  for(const raw of toml.split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#'))continue;
    if(line==='[[redirects]]'||line==='[[headers]]'){current={kind:line.slice(2,-2),values:{}};blocks.push(current);continue;}
    if(line.startsWith('[')){current=line==='[headers.values]'&&current?.kind==='headers'?current:undefined;continue;}
    const match=current&&line.match(/^([A-Za-z-]+)\s*=\s*(?:"([^"]*)"|(\S+))$/);if(match)current.values[match[1]]=match[2]??match[3];}
  const redirects=blocks.filter(b=>b.kind==='redirects').map(({values:v})=>{assert.ok(v.from&&v.to&&v.status,'Unsupported redirect rule.');return `${v.from} ${v.to} ${v.status}${v.force==='true'?'!':''}`;});
  const headers=blocks.filter(b=>b.kind==='headers').map(({values:{for:path,...rest}})=>{assert.ok(path,'Unsupported header rule.');return [path,...Object.entries(rest).map(([key,value])=>`  ${key}: ${value}`)].join('\n');});
  return {redirects:redirects.join('\n')+'\n',headers:headers.join('\n')+'\n'};
}
const rules=netlifyRules(await readFile('netlify.toml','utf8'));
assert.ok(rules.redirects.includes('/* /index.html 200\n')&&rules.redirects.includes('/api/note-images /.netlify/functions/note-images 200!'),'Routing rules are incomplete.');
for(const[path,text]of [['/_redirects',rules.redirects],['/_headers',rules.headers]]){
  assert.ok(!files[path],`${path} already exists in dist.`);const bytes=Buffer.from(text),sha=hash(bytes,'sha1');
  files[path]=sha;bytesBySha.set(sha,{path,bytes});inventory.push({path,sha256:hash(bytes),size:bytes.length});
}
assert.ok(files['/index.html']&&files['/downloads/Kora-setup.exe']&&files['/downloads/latest.json'],'Build the web release after staging the installer and feed.');
const feed=JSON.parse(bytesBySha.get(files['/downloads/latest.json']).bytes);
const {version}=JSON.parse(await readFile('src-tauri/tauri.conf.json','utf8'));assert.equal(feed.version,version,'The updater feed must announce this release.');

const manifest=JSON.parse(await readFile(join(functionsRoot,'manifest.json'),'utf8'));
assert.equal(manifest.system.platform,'linux');assert.equal(manifest.system.arch,'x64');
const functions={},functionsConfig={},zips={},modes={};
for(const fn of manifest.functions){
  assert.ok(['beat-event-cache','note-images','task-breakdown'].includes(fn.name));assert.equal(fn.runtimeVersion,'nodejs24.x');
  const zip=await readFile(join(functionsRoot,fn.name+'.zip'));assert.ok(!credentials.some(value=>zip.includes(Buffer.from(value))),'Credential in a function bundle; values withheld.');
  functions[fn.name]=hash(zip);functionsConfig[fn.name]={build_data:fn.buildData,priority:fn.priority};zips[fn.name]=zip;modes[fn.name]=fn.invocationMode;
}
assert.equal(functions['note-images'],'e0f8b0e45281eda9571dac4fed9d7bff1b03060f76a0b4381b54bc40b279f06b','Only the image function verified on Linux is admitted.');
// Netlify reuses an uploaded function by hash, including its invocation mode. These two bundles were once uploaded
// without stream mode, so give them a release-specific archive comment: identical entries, new hash, fresh upload.
function withZipComment(zip,text){
  const end=zip.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));assert.ok(end>=0&&zip.readUInt16LE(end+20)===0&&end+22===zip.length,'Unexpected archive trailer.');
  const comment=Buffer.from(text),copy=Buffer.from(zip);copy.writeUInt16LE(comment.length,end+20);return Buffer.concat([copy,comment]);
}
for(const name of ['beat-event-cache','task-breakdown']){zips[name]=withZipComment(zips[name],`kora ${version} stream`);functions[name]=hash(zips[name]);}

const deploy=await api('/sites/'+siteId+'/deploys?title='+encodeURIComponent(`Kora ${version} release ${sourceCommit.slice(0,7)}`),{method:'POST',body:{draft:true,async:false,files,functions,functions_config:functionsConfig}});
assert.equal(deploy.site_id,siteId);assert.ok(!deploy.published_at,'The new deploy must start unpublished.');
const receipt={at:new Date().toISOString(),siteId,deployId:deploy.id,sourceCommit,version,productionDeployBefore:site.published_deploy.id,files:inventory.length,
  installerSha256:inventory.find(row=>row.path==='/downloads/Kora-setup.exe').sha256,companionRetained:hash(live),functions};
await writeFile(join(output,'draft.json'),JSON.stringify(receipt,null,2));await writeFile(join(output,'inventory.json'),JSON.stringify(inventory,null,2));
for(const sha of deploy.required||[]){const file=bytesBySha.get(sha);assert.ok(file,'Unknown requested file.');await api('/deploys/'+deploy.id+'/files'+file.path,{method:'PUT',bytes:file.bytes});}
for(const[name,sha]of Object.entries(functions))if((deploy.required_functions||[]).includes(sha))
  // Runtime API v2 functions return a Response and must be uploaded in their built invocation mode.
  await api('/deploys/'+deploy.id+'/functions/'+name+'?runtime=nodejs24.x'+(modes[name]?'&invocation_mode='+modes[name]:''),{method:'PUT',bytes:zips[name]});
let ready;
for(let attempt=0;attempt<180&&!ready;attempt++){const current=await api('/deploys/'+deploy.id);assert.notEqual(current.state,'error','Deploy processing failed; details withheld.');if(current.state==='ready')ready=current;else await new Promise(done=>setTimeout(done,1000));}
assert.ok(ready,'Draft did not become ready within the bounded wait.');
assert.equal((await api('/sites/'+siteId)).published_deploy.id,site.published_deploy.id,'Production changed before promotion.');
Object.assign(receipt,{ready:true,url:ready.deploy_ssl_url||ready.deploy_url});
await writeFile(join(output,'draft.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({status:'DRAFT_READY',deployId:deploy.id,url:receipt.url,productionUnchanged:true}));
