/** Actual Storage API restore in the recovered database's network-none namespace. No hosted connector. */
import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomBytes,randomUUID,createHmac} from 'node:crypto';
import {withProductionClone,sha256,assertContained} from './production-clone.mjs';
import {localRecoveryPassphrase} from './private-recovery-keys.mjs';
import {openPortable,verifyStorageBundle,isStorageAccessDenial} from './storage-recovery.mjs';
const arg=name=>process.argv.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3);
const storageImage='public.ecr.aws/supabase/storage-api@sha256:737a63010a48348cfca5ea51c4c24cc72eb3d6a4bc39cb8a4bf952f7032455bb';
const root=await realpath(join(process.env.LOCALAPPDATA,'Kora/backups/production')),archive=await realpath(arg('archive'));assertContained(root,archive);
const encrypted=await readFile(archive),bundle=JSON.parse(await openPortable(encrypted,await localRecoveryPassphrase()));verifyStorageBundle(bundle);assert.equal(bundle.assets.length,31);
await withProductionClone({manifestFile:arg('manifest'),output:arg('output')},async({sql,output,name:databaseName})=>{
 const prerequisites=JSON.parse(await readFile(join(root,'provider-role-prerequisites.json'),'utf8'));
 assert.ok(prerequisites.projectRef==='lthlvntvjgnornrdxnms'&&prerequisites.tlsVerified&&prerequisites.productionWrites===false&&[true,'on'].includes(prerequisites.readOnly),'Independently read-only verified provider role prerequisites are required.');
 assert.ok(prerequisites.roles.find(row=>row.name==='service_role')?.bypassRls===true,'Provider service role must retain its actual RLS attribute.');
 for(const role of prerequisites.roles){assert.ok(['service_role','authenticated','anon','supabase_storage_admin'].includes(role.name)&&typeof role.bypassRls==='boolean'&&typeof role.inherit==='boolean');sql(`alter role "${role.name}" ${role.bypassRls?'bypassrls':'nobypassrls'} ${role.inherit?'inherit':'noinherit'};`);}
 const catalogSql="select jsonb_build_object('indexes',(select coalesce(jsonb_agg(jsonb_build_object('definition',pg_get_indexdef(i.indexrelid),'unique',i.indisunique,'valid',i.indisvalid,'ready',i.indisready,'predicate',pg_get_expr(i.indpred,i.indrelid),'expressions',pg_get_expr(i.indexprs,i.indrelid)) order by i.indexrelid::regclass::text),'[]') from pg_index i where i.indrelid='storage.objects'::regclass),'constraints',(select coalesce(jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid),'deferrable',condeferrable) order by conname),'[]') from pg_constraint where conrelid='storage.objects'::regclass),'migrations',(select jsonb_agg(to_jsonb(m) order by id) from storage.migrations m))";
 const catalogBefore=JSON.parse(sql(catalogSql));await writeFile(join(output,'storage-catalog-before.json'),JSON.stringify(catalogBefore,null,2));
 if(process.argv.includes('--inspect-only')){
  const explain=[];for(const role of ['postgres','supabase_storage_admin','service_role']){try{sql(`begin;set local role "${role}";explain insert into storage.objects(name,bucket_id) values('__kora_recovery_probe__','__kora_recovery_probe__') on conflict(name,bucket_id) do nothing;rollback;`);explain.push({role,arbiterInferred:true});}catch{explain.push({role,arbiterInferred:false});}}
  const result={status:explain.every(row=>row.arbiterInferred)?'PASS':'BLOCKED',scope:'Recovered provider catalog and non-executing planner checks only',providerRestoreExact:true,indexCount:catalogBefore.indexes.length,explain,hostedConnections:false};await writeFile(join(output,'catalog-inspection.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(result.status==='BLOCKED')process.exitCode=2;return;
 }
 const owner=randomUUID(),name='kora-storage-recovery-'+owner,secret=randomBytes(32).toString('base64url');let attempted=false;
 const token=role=>{const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),body=Buffer.from(JSON.stringify({role,iss:'supabase',aud:'authenticated',sub:randomUUID(),iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return header+'.'+body+'.'+createHmac('sha256',secret).update(header+'.'+body).digest('base64url');};
 const service=token('service_role'),anonymous=token('anon'),outsider=token('authenticated');
 const env={...process.env,AUTH_JWT_SECRET:secret,ANON_KEY:anonymous,SERVICE_KEY:service,DATABASE_URL:'postgresql://postgres@127.0.0.1:5432/postgres'};
 const redact=value=>[secret,service,anonymous,outsider].reduce((text,key)=>text.replaceAll(key,'[local credential redacted]'),String(value)).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[token redacted]').replace(/^const input=.*$/gm,'[private recovery payload omitted]');
 const docker=(args,{input,timeout=120000}={})=>{const result=spawnSync('docker',args,{env,input,encoding:'utf8',timeout,maxBuffer:256*1024**2});if(result.error||result.status!==0){void writeFile(join(output,'storage-error-private.log'),redact(result.stderr||'Docker operation failed.'));throw Error('Isolated Storage operation failed; diagnostics retained privately.');}return result.stdout.trim();};
 const policiesSql="select coalesce(jsonb_agg(to_jsonb(p) order by policyname),'[]') from pg_policies p where schemaname='storage' and tablename='objects'";
 const policies=JSON.parse(sql(policiesSql));
 const applicationRowsSql="select string_agg(format('select %L name,md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text collate \"C\")::text,''[]'')) checksum from %I.%I t',schemaname||'.'||tablename,schemaname,tablename),' union all ' order by schemaname,tablename) from pg_tables where schemaname in ('public','app_private')";
 const query=sql(applicationRowsSql),beforeRows=sql("set timezone='UTC';set extra_float_digits=3;select jsonb_object_agg(name,checksum order by name) from ("+query+") t");
 // These are local recovered provider rows, never a hosted database or the user's running local stack.
 sql("begin;set local storage.allow_delete_query='true';delete from storage.objects;commit;");
 try{
  attempted=true;const id=docker(['run','--rm','-d','--name',name,'--network','container:'+databaseName,'--label','kora.owner='+owner,'--tmpfs','/mnt:rw,noexec,nosuid,size=128m','-e','AUTH_JWT_SECRET','-e','ANON_KEY','-e','SERVICE_KEY','-e','DATABASE_URL','-e','STORAGE_BACKEND=file','-e','FILE_STORAGE_BACKEND_PATH=/mnt','-e','TENANT_ID=stub','-e','GLOBAL_S3_BUCKET=stub','-e','REGION=local','-e','STORAGE_S3_REGION=local','-e','FILE_SIZE_LIMIT=33554432','-e','ENABLE_IMAGE_TRANSFORMATION=false','-e','S3_PROTOCOL_ENABLED=false','-e','VECTOR_ENABLED=false',storageImage]);
  await writeFile(join(output,'storage-owner.json'),JSON.stringify({name,id,image:storageImage,network:'container:'+databaseName,namespaceNetwork:'none',hostPorts:[],startedAt:new Date().toISOString(),worktree:process.cwd()},null,2));
  let ready=false;for(let i=0;i<40;i++){const probe=spawnSync('docker',['exec',name,'node','-e',"fetch('http://127.0.0.1:5000/status',{signal:AbortSignal.timeout(1000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],{encoding:'utf8',timeout:3000});if(probe.status===0){ready=true;break;}await new Promise(done=>setTimeout(done,500));}assert.ok(ready,'Isolated Storage API readiness failed; provider logs are private.');await writeFile(join(output,'storage-catalog-after-startup.json'),JSON.stringify(JSON.parse(sql(catalogSql)),null,2));
  const script=`const input=${JSON.stringify({assets:bundle.assets,service,anonymous,outsider})};
 const crypto=await import('node:crypto'),base='http://127.0.0.1:5000';let restored=0,privateDenials=0,outsiderDenials=0,publicReads=0;
 const isStorageAccessDenial=${isStorageAccessDenial.toString()};
 const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 for(const asset of input.assets){
  const path=[asset.bucket,...asset.name.split('/')].map(encodeURIComponent).join('/'),bytes=Buffer.from(asset.data,'base64');
  const uploaded=await fetch(base+'/object/'+path,{method:'POST',headers:{Authorization:'Bearer '+input.service,'Content-Type':asset.metadata.mimetype||'application/octet-stream','cache-control':asset.metadata.cacheControl||'3600','x-upsert':'false'},body:bytes});
  if(!uploaded.ok)throw Error('Local provider upload rejected ('+uploaded.status+').');
  const response=await fetch(base+'/object/authenticated/'+path,{headers:{Authorization:'Bearer '+input.service}});if(!response.ok||digest(Buffer.from(await response.arrayBuffer()))!==asset.sha256)throw Error('Local provider content recovery mismatch.');restored++;
  const publicResponse=await fetch(base+'/object/public/'+path);if(asset.public){if(!publicResponse.ok||digest(Buffer.from(await publicResponse.arrayBuffer()))!==asset.sha256)throw Error('Expected public reference did not restore.');publicReads++;}else{const denialBody=await publicResponse.json().catch(()=>null);if(!isStorageAccessDenial(publicResponse.status,denialBody))throw Error('Private access must return an explicit authorization/not-found denial.');privateDenials++;}
  if(!asset.public){const denied=await fetch(base+'/object/authenticated/'+path,{headers:{Authorization:'Bearer '+input.outsider}});const denialBody=await denied.json().catch(()=>null);if(!isStorageAccessDenial(denied.status,denialBody))throw Error('Unrelated actor must receive an explicit authorization/not-found denial.');outsiderDenials++;}
 }
 console.log(JSON.stringify({restored,privateDenials,outsiderDenials,publicReads,actualStorageApi:true}));`;
  const result=JSON.parse(docker(['exec','-i',name,'node','--input-type=module'],{input:script}));
  assert.equal(result.restored,31);assert.equal(result.privateDenials,30);assert.equal(result.outsiderDenials,30);assert.equal(result.publicReads,1);
  assert.ok(sql("set timezone='UTC';set extra_float_digits=3;select jsonb_object_agg(name,checksum order by name) from ("+query+") t")===beforeRows,'Application rows changed during isolated provider restore.');
  assert.deepEqual(JSON.parse(sql(policiesSql)),policies,'Existing Storage access policies must remain unchanged.');
  result.at=new Date().toISOString();result.status='PASS';result.productionConnections=false;result.hostedWrites=false;result.archiveSha256=sha256(encrypted);result.image=storageImage;result.storageApiVersion='1.84.32';result.providerRolePrerequisitesVerified=true;result.providerGeneratedMetadata='New provider upload identities/versions; logical bucket/path references, original byte hashes and original access policies verified.';
  await writeFile(join(output,'storage-api-recovery.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{
  if(attempted){
   const logs=spawnSync('docker',['logs',name],{encoding:'utf8',timeout:10000,maxBuffer:8*1024**2});await writeFile(join(output,'storage-api-private.log'),redact(String(logs.stdout||'')+String(logs.stderr||'')));
   const inspected=spawnSync('docker',['inspect','--format','{{json .Config.Labels}}',name],{encoding:'utf8',timeout:10000});
   if(inspected.status!==0)assert.ok(/No such (object|container)/i.test(inspected.stderr||''),'Cannot confirm isolated Storage container cleanup.');
   else{assert.equal(JSON.parse(inspected.stdout)['kora.owner'],owner);docker(['stop','--time','10',name],{timeout:20000});}
   await writeFile(join(output,'storage-cleanup.json'),JSON.stringify({name,stoppedAndRemoved:true,namespaceNetwork:'none',hostPorts:[]}));
  }
 }
});
