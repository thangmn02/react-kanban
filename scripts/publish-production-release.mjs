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

assert.ok(process.argv.includes('--draft')||arg('production-after-draft'),'Use --draft to stage, --publish=<deployId> to promote, or --production-after-draft=<deployId>.');
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}),'','Publish only from a committed tree.');
const dist=resolve('dist'),functionsRoot=resolve(arg('linux-functions')||'');
// Every credential the owner keeps locally; none may appear in a published byte.
const credentials=[token];
const production=parseEnv(await readFile(join(process.env.LOCALAPPDATA,'Kora/secrets/production.env'),'utf8'));
for(const[name,value]of Object.entries(production))if(/SERVICE_ROLE|DB_URL|PASSWORD|SECRET|TOKEN/.test(name)&&value?.length>=8)credentials.push(value);
if(production.KORA_PRODUCTION_DB_URL)credentials.push(decodeURIComponent(new URL(production.KORA_PRODUCTION_DB_URL).password));
for(const file of ['.env.staging.local']){try{for(const[name,value]of Object.entries(parseEnv(await readFile(file,'utf8'))))if(/SERVICE_ROLE|DB_URL|SECRET/.test(name)&&value?.length>=8)credentials.push(value);}catch(error){if(error.code!=='ENOENT')throw error;}}

// The public Companion changes only when the release names its qualified version; otherwise the live bytes are kept.
const companionVersion=arg('companion-version');
const companionVersionOf=file=>JSON.parse(execFileSync(join(process.env.SystemRoot,'System32','tar.exe'),['-xOf',file,'manifest.json'],{encoding:'utf8'})).version;
let live;
if(companionVersion){
  for(const name of ['kora-music-companion.zip','kanban-music-companion.zip'])assert.equal(companionVersionOf(join(dist,'downloads',name)),companionVersion,`dist ${name} is not Companion ${companionVersion}.`);
  live=await readFile(join(dist,'downloads','kora-music-companion.zip'));
}else live=Buffer.from(await (await fetch('https://koraspace.online/downloads/kora-music-companion.zip',{signal:AbortSignal.timeout(120000)})).arrayBuffer());
assert.ok(live.length>1_000_000,'Could not prepare the Companion download.');
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
assert.ok(rules.redirects.includes('/api/share-feed /.netlify/functions/share-feed 200'),'The share-feed route is missing.');
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
  assert.ok(['beat-event-cache','note-images','task-breakdown','share-feed'].includes(fn.name));assert.equal(fn.runtimeVersion,'nodejs24.x');
  const zip=await readFile(join(functionsRoot,fn.name+'.zip'));assert.ok(!credentials.some(value=>zip.includes(Buffer.from(value))),'Credential in a function bundle; values withheld.');
  functions[fn.name]=hash(zip);functionsConfig[fn.name]={build_data:fn.buildData,priority:fn.priority};zips[fn.name]=zip;modes[fn.name]=fn.invocationMode;
}
assert.equal(functions['note-images'],'e0f8b0e45281eda9571dac4fed9d7bff1b03060f76a0b4381b54bc40b279f06b','Only the image function verified on Linux is admitted.');
assert.ok(functions['share-feed'],'The Linux build must include the share-feed function.');
// Netlify reuses an uploaded function by hash, including its invocation mode. These two bundles were once uploaded
// without stream mode, so give them a release-specific archive comment: identical entries, new hash, fresh upload.
function withZipComment(zip,text){
  const end=zip.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));assert.ok(end>=0&&zip.readUInt16LE(end+20)===0&&end+22===zip.length,'Unexpected archive trailer.');
  const comment=Buffer.from(text),copy=Buffer.from(zip);copy.writeUInt16LE(comment.length,end+20);return Buffer.concat([copy,comment]);
}
for(const name of ['beat-event-cache','task-breakdown']){zips[name]=withZipComment(zips[name],`kora ${version} stream`);functions[name]=hash(zips[name]);}

// Secret function variables are withheld from unpublished drafts (deploy-preview context). --production-after-draft
// deploys the exact content of an already verified draft in production context, then verifies it live and rolls back
// automatically on any failure.
const verifiedDraft=arg('production-after-draft');
if(verifiedDraft){
  const tested=JSON.parse(await readFile(join(output,'draft.json'),'utf8'));
  assert.equal(tested.deployId,verifiedDraft,'Name the draft this release created and tested.');
  assert.deepEqual(tested.functions,functions,'Function bundles differ from the tested draft.');
  assert.equal(tested.installerSha256,inventory.find(row=>row.path==='/downloads/Kora-setup.exe').sha256,'Installer differs from the tested draft.');
  const testedInventory=JSON.parse(await readFile(join(output,'inventory.json'),'utf8'));
  assert.deepEqual(testedInventory.map(row=>row.path+row.sha256).sort(),inventory.map(row=>row.path+row.sha256).sort(),'Site files differ from the tested draft.');
}
const deploy=await api('/sites/'+siteId+'/deploys?title='+encodeURIComponent(`Kora ${version} release ${sourceCommit.slice(0,7)}`),{method:'POST',body:{draft:!verifiedDraft,async:false,files,functions,functions_config:functionsConfig}});
assert.equal(deploy.site_id,siteId);assert.ok(!deploy.published_at,'The new deploy must start unpublished.');
const receipt={at:new Date().toISOString(),siteId,deployId:deploy.id,sourceCommit,version,productionDeployBefore:site.published_deploy.id,files:inventory.length,
  installerSha256:inventory.find(row=>row.path==='/downloads/Kora-setup.exe').sha256,companionRetained:hash(live),functions,...(verifiedDraft?{verifiedDraft}:{})};
const receiptFile=join(output,verifiedDraft?'production.json':'draft.json');
await writeFile(receiptFile,JSON.stringify(receipt,null,2));if(!verifiedDraft)await writeFile(join(output,'inventory.json'),JSON.stringify(inventory,null,2));
for(const sha of deploy.required||[]){const file=bytesBySha.get(sha);assert.ok(file,'Unknown requested file.');await api('/deploys/'+deploy.id+'/files'+file.path,{method:'PUT',bytes:file.bytes});}
for(const[name,sha]of Object.entries(functions))if((deploy.required_functions||[]).includes(sha))
  // Runtime API v2 functions return a Response and must be uploaded in their built invocation mode.
  await api('/deploys/'+deploy.id+'/functions/'+name+'?runtime=nodejs24.x'+(modes[name]?'&invocation_mode='+modes[name]:''),{method:'PUT',bytes:zips[name]});
let ready;
for(let attempt=0;attempt<180&&!ready;attempt++){const current=await api('/deploys/'+deploy.id);assert.notEqual(current.state,'error','Deploy processing failed; details withheld.');if(current.state==='ready')ready=current;else await new Promise(done=>setTimeout(done,1000));}
assert.ok(ready,'Deploy did not become ready within the bounded wait.');
if(!verifiedDraft){
  assert.equal((await api('/sites/'+siteId)).published_deploy.id,site.published_deploy.id,'Production changed before promotion.');
  Object.assign(receipt,{ready:true,url:ready.deploy_ssl_url||ready.deploy_url});
  await writeFile(receiptFile,JSON.stringify(receipt,null,2));
  console.log(JSON.stringify({status:'DRAFT_READY',deployId:deploy.id,url:receipt.url,productionUnchanged:true}));
}else{
  const previous=site.published_deploy.id;
  if((await api('/sites/'+siteId)).published_deploy.id!==deploy.id)await api('/sites/'+siteId+'/deploys/'+deploy.id+'/restore',{method:'POST'});
  // Live checks against the production host; any failure restores the previous release.
  const live='https://koraspace.online',failures=[];
  const check=async(name,run)=>{try{if(!await run())failures.push(name);}catch{failures.push(name);}};
  await new Promise(done=>setTimeout(done,5000));
  for(const path of ['/','/today','/notes','/focus?tab=beat'])await check(path,async()=>(await fetch(live+path,{signal:AbortSignal.timeout(30000)})).status===200);
  await check('feed',async()=>(await (await fetch(live+'/downloads/latest.json?'+Date.now())).json()).version===version);
  const expectations={'/api/note-images':[401,'Sign in'],'/api/beat-events':[400,'invalid_asset'],'/api/task-breakdown':[415,'invalid_request']};
  // An unknown share link answers 404 only when the function is routed and can reach the database function.
  await check('/api/share-feed',async()=>(await fetch(live+'/api/share-feed?format=csv&token='+'a'.repeat(43),{signal:AbortSignal.timeout(30000)})).status===404);
  for(const[path,[status,text]]of Object.entries(expectations))await check(path,async()=>{const response=await fetch(live+path,{method:'POST',signal:AbortSignal.timeout(30000)});return response.status===status&&(await response.text()).includes(text);});
  if(failures.length){
    await api('/sites/'+siteId+'/deploys/'+previous+'/restore',{method:'POST'});
    Object.assign(receipt,{status:'ROLLED_BACK',failures,restored:previous});await writeFile(receiptFile,JSON.stringify(receipt,null,2));
    throw Error('Live verification failed ('+failures.join(', ')+'); the previous release was restored.');
  }
  Object.assign(receipt,{status:'PUBLISHED',verifiedLive:true,previousDeployId:previous,rollback:`POST /sites/${siteId}/deploys/${previous}/restore`});
  await writeFile(receiptFile,JSON.stringify(receipt,null,2));
  console.log(JSON.stringify({status:'PUBLISHED',deployId:deploy.id,previousDeployId:previous,verifiedLive:true}));
}
