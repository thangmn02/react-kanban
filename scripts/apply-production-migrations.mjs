/** Apply the exact offline-rehearsed reconciliation transaction to production, once, with fenced pre and post checks.
 *  Requires the rehearsal output directory and the backup manifest that rehearsal used. Provider output is withheld. */
import {readFile,writeFile} from 'node:fs/promises';import {parseEnv} from 'node:util';import {join,resolve} from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';import {postgresImage} from './staging-qualification-contract.mjs';
const arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
const expected='lthlvntvjgnornrdxnms',root=join(process.env.LOCALAPPDATA,'Kora/backups/production'),config=parseEnv(await readFile(join(process.env.LOCALAPPDATA,'Kora/secrets/production.env'),'utf8'));
assert.ok(config.KORA_PRODUCTION_PROJECT_REF===expected,'Authorized production identity differs.');const endpoint=new URL(config.KORA_PRODUCTION_DB_URL);
assert.ok(/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(endpoint.hostname)&&decodeURIComponent(endpoint.username)==='postgres.'+expected,'TLS database route must identify the independently verified project.');
const ca=resolve(arg('ca-file')||'');await readFile(ca);
const rehearsalDir=resolve(arg('rehearsal')||''),rehearsal=JSON.parse(await readFile(join(rehearsalDir,'rehearsal.json'),'utf8'));
const plan=await readFile(join(rehearsalDir,'reconciliation.sql'));
assert.equal(rehearsal.status,'PASS');assert.equal(createHash('sha256').update(plan).digest('hex'),rehearsal.planSha256,'The plan differs from the rehearsed transaction.');
const manifest=JSON.parse(await readFile(resolve(arg('manifest')||''),'utf8'));assert.equal(manifest.sha256,rehearsal.backupSha256,'Rehearsal must bind this backup.');
assert.ok(Date.now()-Date.parse(manifest.at)<6*60*60*1000,'The backup must be fresh.');
assert.ok(process.argv.includes('--apply'),'Explicit --apply is required.');
const psql=(sql,timeout=60000)=>{const result=spawnSync('docker',['run','--rm','-i','--mount',`type=bind,source=${ca},target=/tmp/root.crt,readonly`,'-e','PGPASSWORD','-e',`PGHOST=${endpoint.hostname}`,'-e',`PGPORT=${endpoint.port||5432}`,'-e',`PGUSER=${decodeURIComponent(endpoint.username)}`,'-e','PGDATABASE=postgres','-e','PGSSLMODE=verify-full','-e','PGSSLROOTCERT=/tmp/root.crt','-e','PGCONNECT_TIMEOUT=15',postgresImage,'psql','-X','-qAt','--no-password','-v','ON_ERROR_STOP=1','--single-transaction'].filter(value=>value!=='--single-transaction'||!sql.startsWith('begin;')),{env:{...process.env,PGPASSWORD:decodeURIComponent(endpoint.password)},input:sql,encoding:'utf8',timeout});
  return {ok:result.status===0,stdout:result.stdout.trim()};};
const historySql="select coalesce(json_agg(version order by version),'[]') from supabase_migrations.schema_migrations";
const before=psql(`begin read only;${historySql};rollback;`);assert.ok(before.ok,'Read-only history check failed; provider output withheld.');
assert.deepEqual(JSON.parse(before.stdout),rehearsal.historyBefore,'Production history changed since the rehearsal; nothing was applied.');
const countSql=tables=>'select json_build_object('+tables.map(name=>`'${name}',(select count(*) from ${name.split('.').map(part=>'"'+part+'"').join('.')})`).join(',')+')';
const owned=Object.keys(manifest.counts).filter(name=>/^public\./.test(name));
const countsBefore=psql(`begin read only;${countSql(owned)};rollback;`);assert.ok(countsBefore.ok,'Read-only count check failed.');
const applied=psql(plan.toString('utf8'),300000);
const receipt={at:new Date().toISOString(),projectRef:expected,planSha256:rehearsal.planSha256,backupSha256:manifest.sha256,historyBefore:rehearsal.historyBefore,committed:applied.ok};
if(!applied.ok){await writeFile(join(root,'release-0.1.33-apply.json'),JSON.stringify(receipt,null,2));throw Error('The transaction failed and was rolled back; provider output withheld.');}
const after=psql(`begin read only;${historySql};rollback;`),countsAfter=psql(`begin read only;${countSql(owned)};rollback;`);
assert.ok(after.ok&&countsAfter.ok,'Post-apply verification could not be read.');
const preserved=JSON.parse(countsBefore.stdout),current=JSON.parse(countsAfter.stdout);
Object.assign(receipt,{historyAfter:JSON.parse(after.stdout),rowsBefore:preserved,rowsAfter:current,rowsPreserved:Object.entries(preserved).every(([name,count])=>current[name]>=count)});
assert.deepEqual(receipt.historyAfter,rehearsal.historyAfter,'Production history differs from the rehearsed result.');assert.ok(receipt.rowsPreserved,'A pre-existing table lost rows.');
await writeFile(join(root,'release-0.1.33-apply.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({status:'APPLIED',migrations:receipt.historyAfter.length-receipt.historyBefore.length,historyMatchesRehearsal:true,rowsPreserved:true}));
