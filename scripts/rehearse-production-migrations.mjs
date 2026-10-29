/** Offline-only additive migration rehearsal; no hosted connector or credential source. */
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {withProductionClone,sha256} from './production-clone.mjs';
import {verifyPreservedRows} from './migration-reconciliation.mjs';
import {applicationFingerprintSql,publicationStateSql} from './staging-state-contract.mjs';
const arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
assert.ok(arg('manifest')&&arg('output'),'Supply --manifest=<verified private backup> and --output=<new private evidence directory>.');
const contactSql=schema=>`select jsonb_build_object(
 'columns',(select jsonb_agg(jsonb_build_array(table_name,column_name,data_type,is_nullable,column_default) order by table_name,ordinal_position) from information_schema.columns where table_schema='${schema}' and table_name in ('contact_messages','contact_rate_limits')),
 'constraints',(select jsonb_agg(jsonb_build_array(c.relname,k.contype,pg_get_constraintdef(k.oid)) order by c.relname,k.conname) from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='${schema}' and c.relname in ('contact_messages','contact_rate_limits')),
 'functions',(select jsonb_agg(pg_get_functiondef(p.oid) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='${schema==='app_private'?'public':schema}' and p.proname in ('submit_contact_message','record_contact_notification')),
 'functionPrivileges',(select jsonb_agg(jsonb_build_array(p.proname,pg_get_function_identity_arguments(p.oid),pg_get_userbyid(p.proowner),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable,pg_get_userbyid(a.grantor)) order by p.proname,a.grantee,a.privilege_type) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname='${schema==='app_private'?'public':schema}' and p.proname in ('submit_contact_message','record_contact_notification')),
 'schemaPrivileges',(select jsonb_agg(jsonb_build_array(pg_get_userbyid(n.nspowner),case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable,pg_get_userbyid(a.grantor)) order by a.grantee,a.privilege_type) from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where n.nspname='${schema}'),
 'rls',(select jsonb_agg(jsonb_build_array(relname,relrowsecurity,relforcerowsecurity,pg_get_userbyid(relowner)) order by relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='${schema}' and relname in ('contact_messages','contact_rate_limits')),
 'grants',(select jsonb_agg(jsonb_build_array(table_name,grantee,privilege_type,is_grantable) order by table_name,grantee,privilege_type) from information_schema.role_table_grants where table_schema='${schema}' and table_name in ('contact_messages','contact_rate_limits'))) `;
await withProductionClone({manifestFile:arg('manifest'),output:arg('output')},async({sql,manifest,output})=>{
 const history=JSON.parse(sql("select json_agg(jsonb_build_object('version',version,'name',name,'statements',statements) order by version) from supabase_migrations.schema_migrations"));
 const names=(await readdir('supabase/migrations')).filter(name=>/^\d{14}_.*\.sql$/.test(name)).sort();
 const migrations=await Promise.all(names.map(async name=>({name,body:await readFile('supabase/migrations/'+name,'utf8')})));
 assert.ok(history.some(row=>row.version==='20260713000000'),'Known squashed baseline is required; never replay it blindly.');
 assert.ok(history.some(row=>row.version==='20261007080000'),'Historical sparse-cache entry must remain present.');
 const pending=migrations.filter(row=>!history.some(entry=>entry.version===row.name.slice(0,14)));
 const contact=pending.find(row=>row.name.endsWith('_contact_messages.sql'));assert.ok(contact,'Exact contact reconciliation must be reviewed for this history.');
 const reference=contact.body.replaceAll('app_private.','kora_contact_reference.').replaceAll('schema app_private','schema kora_contact_reference').replaceAll('public.submit_contact_message','kora_contact_reference.submit_contact_message').replaceAll('public.record_contact_notification','kora_contact_reference.record_contact_notification');
 const schemaAcl=JSON.parse(sql("select json_agg(json_build_object('owner',pg_get_userbyid(n.nspowner),'grantor',pg_get_userbyid(a.grantor),'grantee',case when a.grantee=0 then null else pg_get_userbyid(a.grantee) end,'privilege',a.privilege_type,'grantable',a.is_grantable)) from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where n.nspname='app_private'"));
 const quote=value=>'"'+value.replaceAll('"','""')+'"';
 sql('create schema kora_contact_reference authorization '+quote(schemaAcl[0].owner)+';'+schemaAcl.map(item=>{assert.ok(['USAGE','CREATE'].includes(item.privilege));return `set role ${quote(item.grantor)};grant ${item.privilege} on schema kora_contact_reference to ${item.grantee?quote(item.grantee):'public'}${item.grantable?' with grant option':''};reset role;`;}).join('')+reference);
 const actual=JSON.parse(sql(contactSql('app_private'))),expected=JSON.parse(sql(contactSql('kora_contact_reference')));
 const normalize=value=>JSON.stringify(value).replaceAll('kora_contact_reference.','app_private.').replaceAll('FUNCTION app_private.','FUNCTION public.');
 await writeFile(join(output,'contact-comparison-private.json'),JSON.stringify({actual,expected},null,2));
 assert.ok(normalize(actual)===normalize(expected),'Existing contact definitions differ; inspect the private comparison before proposing any migration.');
 const guards=[
  {change:'grant execute on function public.submit_contact_message(text,text,text,text,text) to public;',restore:'revoke execute on function public.submit_contact_message(text,text,text,text,text) from public;'},
  {change:'revoke execute on function public.record_contact_notification(uuid,text) from service_role;',restore:'grant execute on function public.record_contact_notification(uuid,text) to service_role;'},
  {change:'revoke usage on schema app_private from service_role;',restore:'grant usage on schema app_private to service_role;'},
 ];
 for(const guard of guards){sql(guard.change);assert.ok(normalize(JSON.parse(sql(contactSql('app_private'))))!==normalize(expected),'Permission drift must be rejected.');sql(guard.restore);assert.ok(normalize(JSON.parse(sql(contactSql('app_private'))))===normalize(expected),'Permission guard must restore the original clone state.');}

 sql('drop schema kora_contact_reference cascade;');
 const owningTables=Object.keys(manifest.counts).filter(name=>/^(public|app_private)\./.test(name));
 const rowQuery="select jsonb_object_agg(name,rows order by name) from ("+owningTables.map(name=>{const [schema,table]=name.split('.');assert.match(table,/^[a-z_][a-z0-9_]*$/);return `select '${name}' name,coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text collate "C"),'[]') rows from "${schema}"."${table}" t`;}).join(' union all ')+") data";
 const beforeRows=JSON.parse(sql(rowQuery));
 let transaction='begin;\n';for(const row of pending){
  // The contact DDL is skipped only after exact isolated definition equivalence.
  if(row!==contact)transaction+=row.body+'\n';
  transaction+=`insert into supabase_migrations.schema_migrations(version,name,statements) values ('${row.name.slice(0,14)}','${row.name.slice(15,-4)}',array[convert_from(decode('${Buffer.from(row.body).toString('base64')}','base64'),'UTF8')]);\n`;
 }transaction+='commit;';
 await writeFile(join(output,'reconciliation.sql'),transaction);
 sql(transaction);
 const afterRows=JSON.parse(sql(rowQuery));verifyPreservedRows(beforeRows,afterRows,{'public.tasks':['repeat_interval']});
 const afterHistory=JSON.parse(sql("select json_agg(jsonb_build_object('version',version,'name',name,'statements',statements) order by version) from supabase_migrations.schema_migrations"));
 for(const entry of history)assert.deepEqual(afterHistory.find(row=>row.version===entry.version),entry,'Existing history must remain byte-for-byte equivalent.');
 const result={at:new Date().toISOString(),sourceCommit:arg('source-commit')||null,status:'PASS',hostedConnections:false,hostedWrites:false,network:'none',backupSha256:manifest.sha256,historyBefore:history.map(row=>row.version),historyAfter:afterHistory.map(row=>row.version),contactDdl:'Skipped only after definition/owner/ACL equivalence',authorizationDriftGuards:guards.length,historicalTaskRowsUnchanged:true,owningTablesPreserved:owningTables.length,planSha256:sha256(transaction),migrations:pending.map(row=>({name:row.name,sha256:sha256(row.body),operation:row===contact?'record verified-equivalent existing definitions':'apply additive source'})),applicationFingerprintAfter:sql('set search_path=pg_catalog;'+applicationFingerprintSql),publicationStateAfter:JSON.parse(sql('set search_path=pg_catalog;'+publicationStateSql)),productionAuthorization:'Not granted; SQL retained privately for exact owner review.'};
 await writeFile(join(output,'rehearsal.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,hostedConnections:false,migrations:pending.length,planSha256:result.planSha256}));
});
