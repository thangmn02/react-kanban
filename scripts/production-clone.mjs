/** Reopen a verified DPAPI backup in one owned, networkless disposable database. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,relative,isAbsolute,join,sep} from 'node:path';
import {postgresImage,quoteIdentifier,platformFingerprintSql,platformVersionsSql} from './staging-qualification-contract.mjs';
import {applicationFingerprintSql,publicationStateSql} from './staging-state-contract.mjs';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function assertContained(base,target){
 const path=relative(base,target);assert.ok(path&&path!=='..'&&!path.startsWith('..'+sep)&&!isAbsolute(path),'Private backup path must be within its owning directory.');
}
export async function withProductionClone({manifestFile,output},run){
 const privateRoot=await realpath(join(process.env.LOCALAPPDATA,'Kora/backups/production'));
 manifestFile=await realpath(manifestFile);assertContained(privateRoot,manifestFile);
 const manifest=JSON.parse(await readFile(manifestFile,'utf8'));
 assert.equal(manifest.authorizedProject,'lthlvntvjgnornrdxnms');assert.equal(manifest.hostedWrites,false);
 assert.equal(manifest.restoreVerified,true);assert.equal(manifest.image,postgresImage);
 const archive=await realpath(manifest.archive);assertContained(privateRoot,archive);
 const encrypted=await readFile(archive);assert.equal(sha256(encrypted),manifest.encryptedArchiveSha256);
 output=resolve(output);assertContained(privateRoot,output);await mkdir(output,{recursive:false});
 // realpath closes junction/symlink escapes before any production-derived evidence is written.
 assertContained(privateRoot,await realpath(output));
 const decrypted=spawnSync('powershell.exe',['-NoProfile','-Command',"$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Security;$s=[IO.MemoryStream]::new();[Console]::OpenStandardInput().CopyTo($s);$b=[Security.Cryptography.ProtectedData]::Unprotect($s.ToArray(),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::OpenStandardOutput().Write($b,0,$b.Length)"],{input:encrypted,maxBuffer:256*1024**2,timeout:30000});
 assert.equal(decrypted.status,0,'Private backup decryption failed; diagnostics withheld.');assert.equal(sha256(decrypted.stdout),manifest.sha256);
 const ownerToken=randomUUID(),name='kora-offline-rehearsal-'+ownerToken;let started=false,launchAttempted=false;
 const docker=(args,input,binary=false)=>{
  const result=spawnSync('docker',args,{input,encoding:binary?undefined:'utf8',timeout:120000,maxBuffer:256*1024**2});
  if(result.status!==0||result.error){if(started&&result.stderr)void writeFile(join(output,'failure-private.log'),String(result.stderr));throw Error('Offline database operation failed; diagnostics retained privately.');}
  return result.stdout;
 };
 const command=(args,input)=>docker(['exec',...(input===undefined?[]:['-i']),name,...args],input).trim();
 const sql=text=>command(['psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],text);
 try{
  launchAttempted=true;const id=docker(['run','--rm','-d','--name',name,'--network','none','--label','kora.qualification=offline-reconciliation','--label','kora.owner='+ownerToken,'-e','POSTGRES_HOST_AUTH_METHOD=trust',postgresImage]).trim();started=true;
  await writeFile(join(output,'owner.json'),JSON.stringify({name,id,image:postgresImage,network:'none',hostPorts:[],worktree:process.cwd(),startedAt:new Date().toISOString()},null,2));
  let ready=false;for(let i=0;i<40;i++){const p=spawnSync('docker',['exec',name,'pg_isready','-U','postgres'],{encoding:'utf8',timeout:5000});if(p.status===0){ready=true;break;}await new Promise(done=>setTimeout(done,250));}assert.ok(ready,'Offline clone readiness failed.');
  command(['sh','-c','cat > /tmp/before.dump'],decrypted.stdout);decrypted.stdout.fill(0);
  const toc=command(['pg_restore','--list','/tmp/before.dump']);
  const publications=[...toc.matchAll(/^\d+; \d+ \d+ PUBLICATION - (\S+) (\S+)$/gm)];
  sql(manifest.roles.filter(role=>role!=='postgres').map(role=>`create role ${quoteIdentifier(role)} nologin;`).join('\n')+'\ncreate schema extensions;create extension pgcrypto with schema extensions;create extension "uuid-ossp" with schema extensions;\n'+publications.map(([,name,owner])=>`create publication ${quoteIdentifier(name)};alter publication ${quoteIdentifier(name)} owner to ${quoteIdentifier(owner)};`).join('\n')+'\n'+Object.entries(manifest.schemaOwners).map(([schema,owner])=>`create schema if not exists ${quoteIdentifier(schema)} authorization ${quoteIdentifier(owner)};alter schema ${quoteIdentifier(schema)} owner to ${quoteIdentifier(owner)};`).join('\n'));
  command(['pg_restore','-U','postgres','-d','postgres','--exit-on-error',...manifest.schemas.map(schema=>'--schema='+schema),'/tmp/before.dump']);
  const schemaAcls=toc.split('\n').filter(line=>/^\d+; \d+ \d+ ACL - SCHEMA /.test(line)&&manifest.schemas.includes(line.split(' ACL - SCHEMA ')[1].split(' ')[0]));
  if(schemaAcls.length){command(['sh','-c','cat > /tmp/schema-acls.list'],schemaAcls.join('\n'));command(['pg_restore','-U','postgres','-d','postgres','--exit-on-error','--use-list=/tmp/schema-acls.list','/tmp/before.dump']);}
  const providerFingerprint=sql('set search_path=pg_catalog;'+platformFingerprintSql.replaceAll("('auth','storage')","('auth','storage','realtime')"));assert.ok(providerFingerprint===manifest.platformFingerprint,'Recovered provider definitions differ from the verified snapshot.');
  assert.deepEqual(JSON.parse(sql('set search_path=pg_catalog;'+platformVersionsSql)),manifest.platformVersions,'Recovered provider migration history differs.');
  const fingerprint=sql('set search_path=pg_catalog;'+applicationFingerprintSql);assert.equal(fingerprint,manifest.applicationFingerprint,'Restored schema/permissions differ from the verified archive.');
  assert.deepEqual(JSON.parse(sql('set search_path=pg_catalog;'+publicationStateSql)),manifest.publicationState,'Restored publication membership differs.');
  const rowSql=Object.keys(manifest.dataFingerprints).map(name=>{const [schema,table]=name.split('.');return `select '${name}' as name,md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text collate "C")::text,'[]')) checksum from ${quoteIdentifier(schema)}.${quoteIdentifier(table)} t`;}).join(' union all ');
  const rows=JSON.parse(sql(`set search_path=pg_catalog;set timezone='UTC';set extra_float_digits=3;select json_object_agg(name,checksum order by name) from (${rowSql}) r`));assert.deepEqual(rows,manifest.dataFingerprints,'Restored row values differ from the verified archive.');
  return await run({sql,command,manifest,output,name});
 }finally{
  if(launchAttempted){
   let inspected;for(let attempt=0;attempt<3;attempt++){
    inspected=spawnSync('docker',['inspect','--format','{{json .Config.Labels}}',name],{encoding:'utf8',timeout:10000});
    if(inspected.status===0||/No such (object|container)/i.test(inspected.stderr||''))break;
    await new Promise(done=>setTimeout(done,250));
   }
   if(inspected.status!==0){assert.ok(/No such (object|container)/i.test(inspected.stderr||''),'Cannot confirm owned offline container absence; Docker status is unavailable.');}
   else {assert.equal(JSON.parse(inspected.stdout)['kora.owner'],ownerToken,'Container ownership changed; refusing cleanup.');
   const stopped=spawnSync('docker',['stop','--time','10',name],{encoding:'utf8',timeout:20000});await writeFile(join(output,'cleanup.json'),JSON.stringify({at:new Date().toISOString(),name,stoppedAndRemoved:stopped.status===0,hostedConnections:false}));assert.equal(stopped.status,0,'Owned offline database cleanup could not be confirmed.');}}
 }
}
