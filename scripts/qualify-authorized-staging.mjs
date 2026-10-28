/** Authorized hosted backup and isolated restore. Never writes to the hosted database. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { postgresImage, platformFingerprintSql, platformVersionsSql } from './staging-qualification-contract.mjs';
import {applicationFingerprintSql,applicationIdentitiesSql,publicationStateSql,privateEnforcementSql} from './staging-state-contract.mjs';
import {hostedReadOnlySnapshot} from './hosted-readonly-snapshot.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const authorized = arg('authorized-project');
const productionBackup=process.argv.includes('--production-read-only-backup');
const databaseOnly=process.argv.includes('--database-only');
assert.ok(!databaseOnly||productionBackup,'Database-only recovery is restricted to the explicit production read-only backup route.');
assert.equal(authorized,productionBackup?'lthlvntvjgnornrdxnms':'enzzyuhchizfmruxhfhg','Only the independently verified target is supported.');
if(productionBackup)assert.ok(!process.argv.includes('--rehearse-migrations')&&!process.argv.includes('--rehearse-incremental'),'Production backup mode performs recovery only; migration rehearsal is a separate operation.');
const prefix=productionBackup?'KORA_PRODUCTION':'KORA_STAGING';
const config = parseEnv(await readFile(productionBackup?(process.env.KORA_PRODUCTION_ENV_FILE||join(process.env.LOCALAPPDATA,'Kora/secrets/production.env')):'.env.staging.local', 'utf8')), endpoint = new URL(config[`${prefix}_DB_URL`]);
assert.equal(config[`${prefix}_PROJECT_REF`], authorized);
assert.match(endpoint.hostname, /^[a-z0-9.-]+\.pooler\.supabase\.com$/); assert.equal(decodeURIComponent(endpoint.username), `postgres.${authorized}`); assert.equal(endpoint.port || '5432', '5432');
assert.equal(endpoint.pathname, '/postgres');
const ca = resolve(arg('ca-file') || 'scratch/product-completion-261027-0846/supabase-root-ca.crt');
const privateProductionRoot=resolve(process.env.LOCALAPPDATA,'Kora/backups/production');
const inside=(base,path)=>{const remainder=relative(base,path);return !isAbsolute(remainder)&&remainder!=='..'&&!remainder.startsWith('..'+sep);};
const evidence = resolve(arg('output') || (productionBackup?join(privateProductionRoot,'evidence',String(Date.now())):'scratch/product-completion-261027-0846/staging-backup'));
const backupRoot = resolve(arg('backup-root') || (productionBackup?privateProductionRoot:`${process.env.USERPROFILE}/.codex/backups/kora-staging`));
assert.ok(!backupRoot.toLowerCase().startsWith(process.cwd().toLowerCase()), 'Durable hosted backups must be outside the repository.');
if(productionBackup){
  assert.ok(inside(privateProductionRoot,backupRoot)&&inside(privateProductionRoot,evidence),'Production archives and evidence must stay inside the exact private non-synced root.');
  await mkdir(privateProductionRoot,{recursive:true});
  const privateRootScript="$ErrorActionPreference='Stop'; $p=$env:KORA_PRODUCTION_BACKUP_ROOT; $identity=[Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=[Security.AccessControl.DirectorySecurity]::new(); $acl.SetOwner($identity); $acl.SetAccessRuleProtection($true,$false); $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')); [IO.Directory]::SetAccessControl($p,$acl)";
  const privacy=spawnSync('powershell.exe',['-NoProfile','-Command',privateRootScript],{env:{...process.env,KORA_PRODUCTION_BACKUP_ROOT:privateProductionRoot},encoding:'utf8',timeout:10000});assert.equal(privacy.status,0,'Production evidence privacy must be established before writing files.');
}
await mkdir(evidence,{recursive:true});
const backupDirectory = resolve(backupRoot, `${Date.now()}-${authorized}`);
const image = postgresImage;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const env = { ...process.env, PGPASSWORD: decodeURIComponent(endpoint.password) };
const snapshot=productionBackup?await hostedReadOnlySnapshot({env,evidence,dockerArgs:['--mount',`type=bind,source=${ca},target=/tmp/kora-root-ca.crt,readonly`,'-e','PGPASSWORD','-e',`PGHOST=${endpoint.hostname}`,'-e',`PGPORT=${endpoint.port||'5432'}`,'-e',`PGUSER=${decodeURIComponent(endpoint.username)}`,'-e','PGDATABASE=postgres','-e','PGSSLMODE=verify-full','-e','PGSSLROOTCERT=/tmp/kora-root-ca.crt','-e','PGCONNECT_TIMEOUT=15',image]}):null;
try{
const remote = (command, args, input, binary = false) => {
  const response = spawnSync('docker', ['run', '--rm', ...(input ? ['-i'] : []), '--mount', `type=bind,source=${ca},target=/tmp/kora-root-ca.crt,readonly`, '-e', 'PGPASSWORD', '-e', `PGHOST=${endpoint.hostname}`, '-e', `PGPORT=${endpoint.port || '5432'}`, '-e', `PGUSER=${decodeURIComponent(endpoint.username)}`, '-e', 'PGDATABASE=postgres', '-e', 'PGSSLMODE=verify-full', '-e', 'PGSSLROOTCERT=/tmp/kora-root-ca.crt', '-e', 'PGCONNECT_TIMEOUT=15', image, command, ...args], { env, input, encoding: binary ? undefined : 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 180000 });
  if (response.error || response.status !== 0) {const diagnostic=String(response.stderr??'');throw Error(`${productionBackup?'Production':'Staging'} ${command} failed; diagnostics withheld (exit ${response.status}, network=${/timed out|unreachable|timeout|translate host/i.test(diagnostic)}, tls=${/certificate/i.test(diagnostic)}, authentication=${/authentication failed/i.test(diagnostic)}).`);}
  return response.stdout;
};
const recoveryFingerprintSql=platformFingerprintSql.replaceAll("('auth','storage')","('auth','storage','realtime')");
const query = sql => remote('psql', ['-X', '-qAt', '--no-password', '-v', 'ON_ERROR_STOP=1', '-c', `begin isolation level repeatable read read only; ${snapshot?`set transaction snapshot '${snapshot.id}';`:''} set local search_path=pg_catalog; set local extra_float_digits=3; ${sql}; rollback;`]).trim();
const countsSql = "select string_agg(format('select %L as name,count(*)::bigint as count from %I.%I',schemaname||'.'||tablename,schemaname,tablename),' union all ' order by schemaname,tablename) from pg_tables where schemaname in ('public','auth','storage','realtime','app_private','supabase_migrations')";
const countQuery = query(countsSql);
const before = JSON.parse(query(`select json_object_agg(name,count order by name) from (${countQuery}) counts`));
const platformFingerprint = query(recoveryFingerprintSql), platformVersions = JSON.parse(query(platformVersionsSql));
const publicationsSql="select coalesce(jsonb_agg(jsonb_build_object('name',pubname,'owner',pg_get_userbyid(pubowner),'allTables',puballtables,'insert',pubinsert,'update',pubupdate,'delete',pubdelete,'truncate',pubtruncate,'partitionRoot',pubviaroot) order by pubname),'[]'::jsonb) from pg_publication";
const publications=JSON.parse(query(publicationsSql));
const applicationFingerprint=query(applicationFingerprintSql),publicationState=JSON.parse(query(publicationStateSql));
const applicationIdentities=JSON.parse(query(applicationIdentitiesSql));assert.equal(query(privateEnforcementSql),'t','Storage and private Broadcast require enabled RLS.');
const existingData = productionBackup||process.argv.includes('--with-existing-data');
if (existingData&&!productionBackup) assert.ok(process.argv.includes('--after-initial-migrations'), 'Existing data backup requires the committed staging history.');
if(!existingData) { assert.equal(before['auth.users'], 0, 'Use --with-existing-data only after initial staging migrations.'); assert.equal(before['storage.objects'], 0); }
if(productionBackup){const preflight=JSON.parse(await readFile(arg('history-receipt'),'utf8'));assert.equal(preflight.projectRef,authorized);assert.equal(preflight.readOnly,true);assert.equal(preflight.status,'PASS');assert.ok(Date.now()-Date.parse(preflight.at)<4*60*60*1000,'Production preflight must be fresh.');assert.deepEqual(JSON.parse(query("select coalesce(json_agg(version order by version),'[]') from supabase_migrations.schema_migrations")),preflight.migrations.map(item=>item.version));}
else if (process.argv.includes('--after-initial-migrations')) {
  assert.ok(!process.argv.includes('--rehearse-migrations'), 'Initialized backup and initial migration rehearsal are distinct operations.');
  const committed = JSON.parse(await readFile(arg('history-receipt')||'scratch/product-completion-261027-0846/staging-migration-result.json', 'utf8'));
  assert.equal(committed.authorizedProject, authorized); assert.equal(committed.committed, true); assert.equal(committed.verification, 'PASS');
  const history = JSON.parse(query("select json_agg(version order by version) from supabase_migrations.schema_migrations"));
  assert.deepEqual(history, committed.migrations.map(item => item.name.slice(0,14)));
} else assert.equal(query("select count(*) from pg_tables where schemaname='public'"), '0');
const roles = JSON.parse(query("select json_agg(rolname order by rolname) from pg_roles where rolname !~ '^pg_'"));
const schemas = JSON.parse(query("select json_agg(nspname order by nspname) from pg_namespace where nspname in ('public','auth','storage','realtime','app_private','supabase_migrations')"));
const schemaOwners = JSON.parse(query("select json_object_agg(nspname,pg_get_userbyid(nspowner)) from pg_namespace where nspname in ('public','auth','storage','realtime','app_private','supabase_migrations')"));
const schemaPrivileges=JSON.parse(query("select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'grantor',pg_get_userbyid(a.grantor),'grantee',case when a.grantee=0 then null else pg_get_userbyid(a.grantee) end,'privilege',a.privilege_type,'grantable',a.is_grantable) order by n.nspname,pg_get_userbyid(a.grantor),a.grantee,a.privilege_type),'[]'::jsonb) from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where n.nspname in ('public','auth','storage','realtime','app_private','supabase_migrations')"));
const dataQuery = query("select string_agg(format('select %L as name,md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text collate \"C\")::text,''[]'')) as checksum from %I.%I t',schemaname||'.'||tablename,schemaname,tablename),' union all ' order by schemaname,tablename) from pg_tables where schemaname in ('public','auth','storage','realtime','app_private','supabase_migrations')");
const dataFingerprints = JSON.parse(query(`set local timezone='UTC'; select json_object_agg(name,checksum order by name) from (${dataQuery}) data`));
const storageRows = JSON.parse(query("select coalesce(jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'name',o.name,'metadata',o.metadata,'public',b.public) order by o.bucket_id,o.name),'[]'::jsonb) from storage.objects o join storage.buckets b on b.id=o.bucket_id"));
const storage = productionBackup?null:createClient(`https://${authorized}.supabase.co`, config[`${prefix}_SERVICE_ROLE_KEY`], { auth: { persistSession: false, autoRefreshToken: false } });
if(productionBackup&&!databaseOnly)assert.ok(storageRows.every(row=>row.public===true),'Private production objects require separately authorized backup access; the backend secret is not reused.');
const downloadObject=async row=>{
  if(storage){const downloaded=await storage.storage.from(row.bucket).download(row.name);assert.equal(downloaded.error,null,'Every existing object must be backed up.');return Buffer.from(await downloaded.data.arrayBuffer());}
  const objectPath=[row.bucket,...row.name.split('/')].map(encodeURIComponent).join('/');
  const response=await fetch(`https://${authorized}.supabase.co/storage/v1/object/public/${objectPath}`,{signal:AbortSignal.timeout(45000)});assert.equal(response.ok,true,'Every public production object must be recoverable without the backend secret.');return Buffer.from(await response.arrayBuffer());
};
const assetBytes = [];
for (const row of databaseOnly?[]:storageRows) {
  const bytes = await downloadObject(row);
  assetBytes.push({ ...row, sha256: hash(bytes), data: bytes.toString('base64') });
}
const dump = remote('pg_dump', ['--format=custom', '--no-password',...(snapshot?[`--snapshot=${snapshot.id}`]:[])], undefined, true);
assert.deepEqual(JSON.parse(query(`select json_object_agg(name,count order by name) from (${countQuery}) counts`)), before, 'Source changed during backup.');
assert.equal(query(recoveryFingerprintSql), platformFingerprint, 'Platform schema changed during backup.');
assert.equal(query(applicationFingerprintSql),applicationFingerprint,'Application authorization/schema changed during backup.');
assert.deepEqual(JSON.parse(query(publicationStateSql)),publicationState,'Publication membership changed during backup.');
assert.deepEqual(JSON.parse(query(platformVersionsSql)), platformVersions, 'Provider migrations changed during backup.');
assert.deepEqual(JSON.parse(query(`set local timezone='UTC'; select json_object_agg(name,checksum order by name) from (${dataQuery}) data`)), dataFingerprints, 'Source row values changed during backup.');
for (const asset of assetBytes) {
  assert.equal(hash(await downloadObject(asset)), asset.sha256, 'An object changed during backup.');
}
await storage?.removeAllChannels();
await mkdir(backupDirectory, { recursive: true });
const privacyScript = "$ErrorActionPreference='Stop'; $p=$env:KORA_STAGING_BACKUP_DIRECTORY; $identity=[Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=[Security.AccessControl.DirectorySecurity]::new(); $acl.SetOwner($identity); $acl.SetAccessRuleProtection($true,$false); $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')); [IO.Directory]::SetAccessControl($p,$acl)";
let response = spawnSync('powershell.exe', ['-NoProfile', '-Command', privacyScript], { env: { ...process.env, KORA_STAGING_BACKUP_DIRECTORY: backupDirectory }, encoding: 'utf8', timeout: 10000 });
if (response.status !== 0) await writeFile(resolve(evidence, 'privacy-error.txt'), response.stderr || 'PowerShell privacy setup failed.');
assert.equal(response.status, 0, 'Backup directory privacy must be established.');
const encryptScript = "Add-Type -AssemblyName System.Security; $stream=[IO.MemoryStream]::new(); [Console]::OpenStandardInput().CopyTo($stream); $encrypted=[Security.Cryptography.ProtectedData]::Protect($stream.ToArray(),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::OpenStandardOutput().Write($encrypted,0,$encrypted.Length)";
response = spawnSync('powershell.exe', ['-NoProfile', '-Command', encryptScript], { input: dump, maxBuffer: 256 * 1024 * 1024, timeout: 30000 }); assert.equal(response.status, 0, 'Backup encryption must succeed.');
const archive = resolve(backupDirectory, 'before.dump.dpapi'); await writeFile(archive, response.stdout, { flag: 'wx' });
const decryptScript = "Add-Type -AssemblyName System.Security; $stream=[IO.MemoryStream]::new(); [Console]::OpenStandardInput().CopyTo($stream); $plain=[Security.Cryptography.ProtectedData]::Unprotect($stream.ToArray(),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::OpenStandardOutput().Write($plain,0,$plain.Length)";
response = spawnSync('powershell.exe', ['-NoProfile', '-Command', decryptScript], { input: await readFile(archive), maxBuffer: 256 * 1024 * 1024, timeout: 30000 }); assert.equal(response.status, 0, 'The saved encrypted archive must decrypt.');
const recoveredDump = response.stdout; assert.equal(hash(recoveredDump), hash(dump), 'Encrypted backup round-trip must match.');
let assetsArchive = null, assetsArchiveSha256 = null;
if (assetBytes.length) {
  const bundle = Buffer.from(JSON.stringify({ version: 1, authorizedProject: authorized, assets: assetBytes }));
  response = spawnSync('powershell.exe', ['-NoProfile', '-Command', encryptScript], { input: bundle, maxBuffer: 256 * 1024 * 1024, timeout: 30000 }); assert.equal(response.status, 0);
  assetsArchive = resolve(backupDirectory, 'storage-assets.dpapi'); await writeFile(assetsArchive, response.stdout, { flag: 'wx' });
  assetsArchiveSha256 = hash(await readFile(assetsArchive));
  response = spawnSync('powershell.exe', ['-NoProfile', '-Command', decryptScript], { input: await readFile(assetsArchive), maxBuffer: 256 * 1024 * 1024, timeout: 30000 }); assert.equal(response.status, 0);
  assert.equal(hash(response.stdout), hash(bundle), 'Encrypted object backup must round-trip.');
  for (const asset of JSON.parse(response.stdout).assets) assert.equal(hash(Buffer.from(asset.data, 'base64')), asset.sha256);
}
const owned = `kora-staging-restore-${randomUUID()}`;
const local = (command, args, input) => {
  const output = spawnSync('docker', ['exec', ...(input ? ['-i'] : []), owned, command, ...args], { input, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 120000 });
  if (output.error || output.status !== 0) { if (output.stderr) void writeFile(resolve(evidence, 'restore-error.txt'), output.stderr); throw Error(`Isolated ${command} failed (exit ${output.status}); diagnostics retained privately.`); }
  return output.stdout.trim();
};
let started = false, restored = false;
let rehearsal = null;
try {
  response = spawnSync('docker', ['run', '--rm', '-d', '--name', owned, '--network', 'none', '--label', 'kora.qualification=staging-restore', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', image], { encoding: 'utf8', timeout: 30000 }); assert.equal(response.status, 0, 'Isolated restore server must start.'); started = true;
  await writeFile(resolve(evidence, 'owned-container.json'), JSON.stringify({ name: owned, id: response.stdout.trim(), image, startedAt: new Date().toISOString(), network: 'none', hostPorts: [], worktree: process.cwd() }, null, 2));
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) { const probe = spawnSync('docker', ['exec', owned, 'pg_isready', '-U', 'postgres'], { encoding: 'utf8', timeout: 5000 }); if (probe.status === 0) { ready = true; break; } await new Promise(done => setTimeout(done, 500)); }
  assert.ok(ready, 'Isolated restore server readiness');
  const quote = identifier => `"${identifier.replaceAll('"', '""')}"`;
  const publicationDefinitions=publications.map(item=>`create publication ${quote(item.name)}${item.allTables?' for all tables':''} with (publish='${['insert','update','delete','truncate'].filter(operation=>item[operation]).join(',')}',publish_via_partition_root=${item.partitionRoot});alter publication ${quote(item.name)} owner to ${quote(item.owner)};`).join('\n');
  local('psql', ['-U', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-c', roles.filter(role => role !== 'postgres').map(role => `create role ${quote(role)} nologin;`).join('\n') + '\ncreate schema extensions; create extension pgcrypto with schema extensions; create extension "uuid-ossp" with schema extensions;\n'+publicationDefinitions+'\n' + Object.entries(schemaOwners).map(([schema, owner]) => `create schema if not exists ${quote(schema)} authorization ${quote(owner)}; alter schema ${quote(schema)} owner to ${quote(owner)};`).join('\n')]);
  local('pg_restore', ['-U', 'postgres', '-d', 'postgres', '--exit-on-error', ...schemas.map(schema => `--schema=${schema}`)], recoveredDump);
  // pg_restore --schema selects contained objects, not schema-level ACL entries.
  // Replay the actual namespace grants with their original grantors as well.
  const resetSchemaPrivileges=schemas.map(schema=>`revoke all on schema ${quote(schema)} from public;`+schemaPrivileges.filter(item=>item.schema===schema&&item.grantee).map(item=>`revoke all on schema ${quote(schema)} from ${quote(item.grantee)};`).join('')).join('\n');
  const restoreSchemaPrivileges=schemaPrivileges.map(item=>{assert.ok(['USAGE','CREATE'].includes(item.privilege));return `set role ${quote(item.grantor)};grant ${item.privilege} on schema ${quote(item.schema)} to ${item.grantee?quote(item.grantee):'public'}${item.grantable?' with grant option':''};reset role;`;}).join('\n');
  local('psql',['-U','postgres','-X','-v','ON_ERROR_STOP=1','-c',resetSchemaPrivileges+'\n'+restoreSchemaPrivileges]);
  const after = JSON.parse(local('psql', ['-U', 'postgres', '-X', '-qAt', '-c', `select json_object_agg(name,count order by name) from (${countQuery}) counts`])); assert.deepEqual(after, before, 'Restored row counts must match the hosted archive.'); restored = true;
  const restoredRows = JSON.parse(local('psql', ['-U', 'postgres', '-X', '-qAt', '-c', `set timezone='UTC'; set extra_float_digits=3; set search_path=pg_catalog; select json_object_agg(name,checksum order by name) from (${dataQuery}) data`]));
  if(JSON.stringify(restoredRows)!==JSON.stringify(dataFingerprints)){
    const differences=[];
    for(const name of Object.keys(dataFingerprints).filter(name=>restoredRows[name]!==dataFingerprints[name])){
      const [schema,table]=name.split('.'),sql=`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text collate "C"),'[]'::jsonb) from ${quote(schema)}.${quote(table)} t`;
      const source=JSON.parse(query(sql)),recovered=JSON.parse(local('psql',['-U','postgres','-X','-qAt','-c',`set timezone='UTC';set extra_float_digits=3;set search_path=pg_catalog;${sql}`]));
      const columns=new Set();for(const row of source){const other=recovered.find(item=>item.id===row.id);if(!other){columns.add('missing-row');continue;}for(const column of Object.keys(row))if(JSON.stringify(row[column])!==JSON.stringify(other[column]))columns.add(column);}
      differences.push({table:name,sourceCount:source.length,restoredCount:recovered.length,parsedValueDifferences:[...columns],parsedRowsEquivalent:columns.size===0});
    }
    await writeFile(resolve(evidence,'row-recovery-differences.json'),JSON.stringify(differences,null,2));
  }
  assert.deepEqual(restoredRows, dataFingerprints, 'Restored row values must match, including Notes/Auth/Storage metadata.');
  for (const asset of assetBytes) {
    const name = '/tmp/kora-restored-' + randomUUID() + '.bin';
    local('sh', ['-c', 'cat > ' + name], Buffer.from(asset.data, 'base64'));
    assert.equal(local('sha256sum', [name]).split(/\s/)[0], asset.sha256, 'Restored object bytes must match.');
  }
  const restoredPlatform = JSON.parse(local('psql', ['-U', 'postgres', '-X', '-qAt', '-c', `set search_path=pg_catalog; select jsonb_build_object('fingerprint',(${recoveryFingerprintSql}),'versions',(${platformVersionsSql}));`]));
  assert.equal(restoredPlatform.fingerprint, platformFingerprint, 'Restored platform definitions must match the source.'); assert.deepEqual(restoredPlatform.versions, platformVersions, 'Restored provider migration versions must match the source.');
  assert.deepEqual(JSON.parse(local('psql',['-U','postgres','-X','-qAt','-c',publicationsSql])),publications,'Actual publication definitions and owners must restore.');
  assert.equal(local('psql',['-U','postgres','-X','-qAt','-c',privateEnforcementSql]),'t','Restored Storage and Broadcast RLS must remain enabled.');
  const restoredIdentities=JSON.parse(local('psql',['-U','postgres','-X','-qAt','-c',`set search_path=pg_catalog;${applicationIdentitiesSql}`]));
  await writeFile(resolve(evidence,'application-identities-source.json'),JSON.stringify(applicationIdentities,null,2));await writeFile(resolve(evidence,'application-identities-restored.json'),JSON.stringify(restoredIdentities,null,2));
  assert.equal(local('psql',['-U','postgres','-X','-qAt','-c',`set search_path=pg_catalog;${applicationFingerprintSql}`]),applicationFingerprint,'Application schema/policies/grants/triggers must restore exactly.');
  assert.deepEqual(JSON.parse(local('psql',['-U','postgres','-X','-qAt','-c',`set search_path=pg_catalog;${publicationStateSql}`])),publicationState,'Actual publication members must restore exactly before rehearsal.');
  if (process.argv.includes('--rehearse-migrations')||process.argv.includes('--rehearse-incremental')) {
    const incremental=process.argv.includes('--rehearse-incremental');
    assert.ok(!incremental||process.argv.includes('--after-initial-migrations'),'Incremental rehearsal requires verified initialized history.');
    const historyBefore=incremental?JSON.parse(local('psql',['-U','postgres','-X','-qAt','-c','select coalesce(json_agg(version order by version),\'[]\') from supabase_migrations.schema_migrations'])):[];
    const allNames=(await readdir('supabase/migrations')).filter(name=>/^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort();
    assert.deepEqual(allNames.slice(0,historyBefore.length).map(name=>name.slice(0,14)),historyBefore,'Only an exact source-history prefix can be extended.');
    const names=allNames.filter(name=>!historyBefore.includes(name.slice(0,14)));
    const contents = await Promise.all(names.map(name => readFile(`supabase/migrations/${name}`, 'utf8')));
    let transaction = incremental?'begin;\n':'begin; create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);\n';
    names.forEach((name, index) => { transaction += contents[index] + `\ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('${name.slice(0,14)}','${name.slice(15,-4)}',array[]::text[]);\n`; });
    transaction += 'commit;'; local('psql', ['-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1'], transaction);
    const applied = Number(local('psql', ['-U', 'postgres', '-X', '-qAt', '-c', 'select count(*) from supabase_migrations.schema_migrations'])); assert.equal(applied, allNames.length);
    const applicationFingerprintAfter=local('psql',['-U','postgres','-X','-qAt','-c',`set search_path=pg_catalog;${applicationFingerprintSql}`]),publicationStateAfter=JSON.parse(local('psql',['-U','postgres','-X','-qAt','-c',`set search_path=pg_catalog;${publicationStateSql}`]));
    rehearsal = { status: 'PASS', target: 'isolated restored staging schemas only', incremental,historyBefore,migrations: names.map((name, index) => ({ name, sha256: hash(contents[index]) })), appliedCount: applied,applicationFingerprintAfter,publicationStateAfter };
    await writeFile(resolve(evidence, 'migration-rehearsal.json'), JSON.stringify(rehearsal, null, 2));
  }
  const receipt = { at: new Date().toISOString(), authorizedProject: authorized, hostedWrites: false, archive, sha256: hash(dump), encryptedArchiveSha256: hash(await readFile(archive)), encryption: 'Windows DPAPI CurrentUser; recovery requires this Windows account or separate credential/key recovery', image, caSha256: hash(await readFile(ca)), platformFingerprint, platformVersions, applicationFingerprint, publicationState, connectionHost:endpoint.hostname, storageObjects:assetBytes.map(({bucket,name,sha256})=>({bucket,name,sha256})), schemas, schemaOwners, roles, restoreVerified: true, originalOwnersAndAclsRestored: true, platformExtensionRestoreVerified: false, counts: before, dataFingerprints, storageObjectCount: storageRows.length, storageObjectBytesRequired: storageRows.length > 0, assetsArchive, assetsArchiveSha256, storageBytesRestoreVerified: !databaseOnly||storageRows.length===0, storageRecovery:databaseOnly&&storageRows.length?'BLOCKED: separate private-object backup access required':'PASS', rehearsal, recoveryScope: databaseOnly?'Application/public, Auth, Storage metadata, actual Realtime and migration schemas restored in isolation. Storage object bytes were NOT backed up or restored. Platform extension binaries/provider infrastructure require provider recovery.':'Application/public, Auth, Storage metadata, actual Realtime and migration schemas restored in isolation; object bytes restored and hash-verified. Platform extension binaries/provider infrastructure require provider recovery.' };
  await writeFile(resolve(backupDirectory, 'manifest.json'), JSON.stringify(receipt, null, 2)); await writeFile(resolve(evidence, 'backup-manifest.json'), JSON.stringify(receipt, null, 2));
} finally {
  if (started) { const stopped = spawnSync('docker', ['stop', '--time', '10', owned], { encoding: 'utf8', timeout: 20000 }); assert.equal(stopped.status, 0, 'The owned restore container must stop and be removed.'); }
  await writeFile(resolve(evidence, 'cleanup.json'), JSON.stringify({ at: new Date().toISOString(), ownedContainer: owned, stoppedAndRemoved: started, restored }, null, 2));
}
console.log(JSON.stringify({ status: databaseOnly&&storageRows.length?'PARTIAL':'PASS', authorizedProject: authorized, hostedWrites: false, restoreVerified: restored, backupDirectory, storageObjectBytesRequired: storageRows.length > 0, storageBytesRestoreVerified: !databaseOnly||storageRows.length===0 }));
}finally{await snapshot?.close();}
