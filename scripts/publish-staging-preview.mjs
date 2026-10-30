/** Publish only an isolated draft, with staging-only, deploy-scoped image credentials. */
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,lstat,mkdir,unlink,realpath} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {parseEnv} from 'node:util';
import {execFileSync} from 'node:child_process';
import {build} from 'vite';
import {createClient} from '@supabase/supabase-js';
import {qualificationTarget} from './qualification-target.mjs';

const siteId='0c8406d3-9d2e-4afd-8351-140813bfbaf9';
const productionRef='lthlvntvjgnornrdxnms';
const arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
const {config,staging,root}=await qualificationTarget('scratch/staging-preview');assert.equal(staging,true);
assert.equal(config.API_URL,'https://enzzyuhchizfmruxhfhg.supabase.co');
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.match(sourceCommit,/^[a-f0-9]{40}$/);
const sourceStatus=execFileSync('git',['status','--porcelain','--untracked-files=normal','--','src','src-tauri','server','netlify','extensions','scripts','public','package.json','package-lock.json','vite.config.ts'],{encoding:'utf8'});
assert.equal(sourceStatus,'','Commit the exact application, packaging and publisher source before creating a staging draft.');
const output=resolve(root),site=resolve(output,'site');await mkdir(site,{recursive:false});
const inside=(base,path)=>{const rest=relative(base,path);return rest&&rest!=='..'&&!rest.startsWith('..'+sep)&&!isAbsolute(rest);};
assert.ok(inside(resolve('scratch'),await realpath(output)));
const privateEnv=parseEnv(await readFile('.env.staging.local','utf8'));
for(const [key,role]of [[config.ANON_KEY,'anon'],[config.SERVICE_ROLE_KEY,'service_role']]){
  assert.ok(key?.length>20,'A required staging API key is missing.');
  if(key.split('.').length===3){const claim=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));assert.ok(claim.ref==='enzzyuhchizfmruxhfhg'&&claim.role===role,'A staging API key has the wrong project or role.');}
}
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
assert.ok(!(await admin.from('notes').select('id').limit(0)).error,'Read-only staging Notes access failed; provider details withheld.');
const credentialValues=[privateEnv.KORA_STAGING_SERVICE_ROLE_KEY,privateEnv.KORA_STAGING_DB_URL,decodeURIComponent(new URL(privateEnv.KORA_STAGING_DB_URL).password)];
try{
  const production=parseEnv(await readFile(join(process.env.LOCALAPPDATA,'Kora/secrets/production.env'),'utf8'));
  assert.ok(config.SERVICE_ROLE_KEY!==production.KORA_PRODUCTION_SERVICE_ROLE_KEY,'Never reuse the production image-backend key.');
  for(const[name,value]of Object.entries(production))if(/SERVICE_ROLE|DB_URL|PASSWORD|SECRET|TOKEN/.test(name)&&value?.length>=8)credentialValues.push(value);
  if(production.KORA_PRODUCTION_DB_URL)credentialValues.push(decodeURIComponent(new URL(production.KORA_PRODUCTION_DB_URL).password));
}catch(error){if(error.code!=='ENOENT')throw error;}
const login=JSON.parse(await readFile(join(process.env.APPDATA,'netlify/Config/config.json'),'utf8'));
const token=login.users[login.userId]?.auth?.token;assert.ok(token,'Use the existing owner-authorized Netlify login.');credentialValues.push(token);
async function api(path,{method='GET',body,bytes}={}){
  const response=await fetch('https://api.netlify.com/api/v1'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:bytes?{'Content-Type':'application/octet-stream'}:{})},body:body?JSON.stringify(body):bytes,signal:AbortSignal.timeout(60000)});
  assert.ok(response.ok,'Netlify request failed ('+response.status+'); provider details withheld.');
  return response.status===204?null:response.json();
}
const before=await api('/sites/'+siteId);assert.equal(before.name,'kanthangboard');assert.equal(before.ssl_url,'https://koraspace.online');
const publishedId=before.published_deploy.id;
Object.assign(process.env,{VITE_AUTH_MODE:'supabase',VITE_SUPABASE_URL:config.API_URL,VITE_SUPABASE_ANON_KEY:config.ANON_KEY,VITE_ENABLE_NOTES_PREVIEW:'true',VITE_ENABLE_BEAT_GRID_PREVIEW:'true',VITE_PRIVATE_NATIVE_COMPANION_CAPTURE:'false',VITE_PRIVATE_LOCAL_HYBRID:'false',VITE_NOTE_IMAGES_URL:'/api/note-images'});
await build({mode:'staging',logLevel:'error',build:{outDir:site}});
// The preview must not distribute a new installer, updater feed or Companion.
const downloads=resolve(site,'downloads');assert.ok(inside(site,downloads));
for(const name of await readdir(downloads).catch(error=>{if(error.code==='ENOENT')return [];throw error;})){
  const file=join(downloads,name);assert.ok((await lstat(file)).isFile(),'Unexpected nested download artifact.');await unlink(file);
}
await writeFile(join(site,'_redirects'),'/api/note-images /.netlify/functions/note-images 200\n/downloads/* https://koraspace.online/downloads/:splat 302\n/* /index.html 200\n');
await writeFile(join(site,'_headers'),'/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: strict-origin-when-cross-origin\n');
await writeFile(join(site,'robots.txt'),'User-agent: *\nDisallow: /\n');
await writeFile(join(site,'staging-preview.json'),JSON.stringify({target:'authorized staging only',projectRef:'enzzyuhchizfmruxhfhg',sourceCommit,notes:true,opalPreview:true,productionData:false,publicCompanionReplaced:false,nativeInstallerReplaced:false}));
const fileBytes=new Map(),files={};
const hash=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
async function collect(directory){
  for(const name of await readdir(directory)){
    const file=join(directory,name),stat=await lstat(file);assert.ok(!stat.isSymbolicLink(),'No linked files may be published.');
    if(stat.isDirectory()){await collect(file);continue;}
    assert.ok(stat.isFile());const bytes=await readFile(file),path='/'+relative(site,file).split(sep).join('/');
    assert.ok(!/(?:^|\/)(?:\.env[^/]*|scratch|\.git|\.netlify)(?:\/|$)|\.(?:key|pem|dpapi|dump|kora-backup)$/.test(path),'Private path in publication.');
    assert.ok(!credentialValues.some(value=>value?.length>=8&&bytes.includes(Buffer.from(value))),'Private credential match in publication; values withheld.');
    if(/\.(?:js|html|json|mjs)$/.test(path))assert.ok(!bytes.includes(Buffer.from(productionRef)),'Production routing leaked into staging preview.');
    const sha=hash(bytes,'sha1');files[path]=sha;fileBytes.set(sha,{path,bytes});
  }
}
await collect(site);
assert.ok(arg('linux-functions'),'Supply the previously verified Linux function directory.');const functionsRoot=resolve(arg('linux-functions'));
const zip=await readFile(join(functionsRoot,'note-images.zip'));
assert.equal(hash(zip),'e0f8b0e45281eda9571dac4fed9d7bff1b03060f76a0b4381b54bc40b279f06b','Only the exact tested Linux image function is admitted.');
for(const[file,expected]of Object.entries({'server/note-images.ts':'fdf18743891d22c1f6017d57978df8d7c15bbe70d1014769455b48280a1f6b5d','netlify/functions/note-images.mts':'10ea066cfd2e9179fe49164234a791a5e14947aed1d5f7b0f4213710311c1984','package-lock.json':'5d1593b8192f57a881d2fd8970ec3ba534669c1ca42f25644be2590703885f39'}))assert.equal(hash((await readFile(file,'utf8')).replaceAll('\r\n','\n')),expected,'Image function source changed; rebuild and qualify the Linux artifact.');
assert.ok(!credentialValues.some(value=>value?.length>=8&&zip.includes(Buffer.from(value))));
const manifest=JSON.parse(await readFile(join(functionsRoot,'manifest.json'),'utf8'));assert.equal(manifest.system.platform,'linux');assert.equal(manifest.system.arch,'x64');
const fn=manifest.functions.find(fn=>fn.name==='note-images');assert.equal(fn.runtimeVersion,'nodejs24.x');
const functionHash=hash(zip);
const environment=Object.entries({VITE_SUPABASE_URL:config.API_URL,VITE_SUPABASE_ANON_KEY:config.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:config.SERVICE_ROLE_KEY}).map(([key,value])=>({key,value,scopes:['functions'],is_secret:key==='SUPABASE_SERVICE_ROLE_KEY'}));
assert.ok(process.argv.includes('--publish-draft'),'Build prepared. Explicit --publish-draft is required for an external draft.');
const deploy=await api('/sites/'+siteId+'/deploys?title='+encodeURIComponent('Kora staging Notes and Opal test preview'),{method:'POST',body:{draft:true,async:false,files,functions:{'note-images':functionHash},functions_config:{'note-images':{build_data:fn.buildData,priority:fn.priority}},environment}});
let completed=false;
try{
assert.equal(deploy.site_id,siteId);assert.ok(!deploy.published_at,'The new draft must not already be published.');
const receipt={at:new Date().toISOString(),siteId,deployId:deploy.id,sourceCommit,productionDeployBefore:publishedId,projectRef:'enzzyuhchizfmruxhfhg',draft:true,functions:['note-images'],functionSha256:functionHash,secretScope:'this draft/functions only',files:Object.keys(files).length,productionDatabaseWrites:false,productionPublished:false};
await writeFile(join(output,'deployment.json'),JSON.stringify(receipt,null,2));
for(const sha of deploy.required||[]){const file=fileBytes.get(sha);assert.ok(file,'Unknown requested file.');await api('/deploys/'+deploy.id+'/files'+file.path,{method:'PUT',bytes:file.bytes});}
if((deploy.required_functions||[]).includes(functionHash))await api('/deploys/'+deploy.id+'/functions/note-images?runtime=nodejs24.x&invocation_mode=stream',{method:'PUT',bytes:zip});
let ready;
for(let attempt=0;attempt<90;attempt++){
  const current=await api('/deploys/'+deploy.id);
  assert.notEqual(current.state,'error','Draft processing failed; details withheld.');
  if(current.state==='ready'){ready=current;break;}
  await new Promise(done=>setTimeout(done,1000));
}
assert.ok(ready,'Draft did not become ready within the bounded wait.');
assert.equal((await api('/sites/'+siteId)).published_deploy.id,publishedId,'Production publication unexpectedly changed.');
Object.assign(receipt,{ready:true,url:ready.deploy_ssl_url||ready.deploy_url,productionDeployAfter:publishedId,secretScan:'PASS'});
await writeFile(join(output,'deployment.json'),JSON.stringify(receipt,null,2));
completed=true;
console.log(JSON.stringify({status:'READY',url:receipt.url,productionUnchanged:true,notes:true,opalPreview:true,credentialsPrinted:false}));
}finally{
  if(!completed){await api('/deploys/'+deploy.id+'/cancel',{method:'POST'}).catch(()=>{});await writeFile(join(output,'incomplete.json'),JSON.stringify({at:new Date().toISOString(),deployId:deploy.id,incomplete:true,productionPublished:false}));}
}
