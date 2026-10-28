/** Back up and restore the existing local stack before applying pending source migrations. */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const container = 'supabase_db_react-kanban';
const output = resolve(process.argv.find(arg => arg.startsWith('--output='))?.slice(9) || 'scratch/integration-261027-0739/local-database');
await mkdir(output, { recursive: true });
const run = (args, input, binary = false) => {
  const result = spawnSync('docker', ['exec', ...(input ? ['-i'] : []), container, 'sh', '-c', 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec "$@"', 'kora-qualification', ...args], { input, encoding: binary ? undefined : 'utf8', maxBuffer: 128 * 1024 * 1024, timeout: 120000 });
  if (result.error || result.status !== 0) throw Error(`Local Docker command failed: ${result.stderr?.toString().slice(-2000)}`);
  return result.stdout;
};
const sql = (database, query) => run(['psql', '-U', 'postgres', '-d', database, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', query]).trim();
const inventory = database => {
  const query = sql(database, "select string_agg(format('select %L as name, count(*)::bigint as count from %I.%I',schemaname||'.'||tablename,schemaname,tablename),' union all ' order by schemaname,tablename) from pg_tables where schemaname in ('public','auth','storage','app_private','supabase_migrations')");
  return JSON.parse(sql(database, `select json_object_agg(name,count order by name) from (${query}) counts`));
};
const before = inventory('postgres');
const dump = run(['pg_dump', '-U', 'postgres', '-d', 'postgres', '--format=custom'], undefined, true);
const archive = resolve(output, 'before.dump');
await writeFile(archive, dump, { flag: 'wx' });
if (JSON.stringify(inventory('postgres')) !== JSON.stringify(before)) throw Error('Local rows changed during backup; this snapshot is not accepted.');
const clone = `kora_restore_${Date.now()}`;
let created = false;
try {
  run(['createdb', '-U', 'supabase_admin', '--template=template0', clone]); created = true;
  run(['psql', '-U', 'supabase_admin', '-d', clone, '-X', '-v', 'ON_ERROR_STOP=1', '-c', 'create schema extensions; create extension pgcrypto with schema extensions; create extension "uuid-ossp" with schema extensions; create schema auth authorization supabase_admin; create schema storage authorization supabase_admin; create schema app_private authorization postgres; create schema supabase_migrations authorization postgres; create publication supabase_realtime;']);
  run(['pg_restore', '-U', 'supabase_admin', '-d', clone, '--exit-on-error', ...['public','auth','storage','app_private','supabase_migrations'].map(schema => `--schema=${schema}`)], dump);
  const restored = inventory(clone);
  if (JSON.stringify(restored) !== JSON.stringify(before)) throw Error('Restore row counts differ from the local source.');
  await writeFile(resolve(output, 'backup-manifest.json'), JSON.stringify({ target: 'local Docker Supabase only', container, archive, sha256: createHash('sha256').update(dump).digest('hex'), verifiedAt: new Date().toISOString(), restoreVerified: true, restoredSchemas: ['public','auth','storage','app_private','supabase_migrations'], platformExtensionRestoreVerified: false, counts: before, storageObjectBytesIncluded: false }, null, 2));
} finally {
  if (created) run(['dropdb', '-U', 'supabase_admin', clone]);
}
const applied = sql('postgres', 'select version from supabase_migrations.schema_migrations order by version').split('\n');
const pending = (await readdir('supabase/migrations')).filter(name => name.endsWith('.sql') && !applied.includes(name.split('_')[0])).sort();
const files = await Promise.all(pending.map(name => readFile(`supabase/migrations/${name}`, 'utf8')));
if (process.argv.includes('--apply')) {
  let transaction = 'begin;\n';
  pending.forEach((name, i) => { transaction += files[i] + `\ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('${name.split('_')[0]}','${name.slice(15, -4)}',array[]::text[]);\n`; });
  transaction += "notify pgrst,'reload schema';\ncommit;";
  run(['psql', '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1'], transaction);
}
await writeFile(resolve(output, 'migration-result.json'), JSON.stringify({ at: new Date().toISOString(), backupRestoreVerified: true, applied: process.argv.includes('--apply'), pending, sourceHashes: Object.fromEntries(pending.map((name, i) => [name, createHash('sha256').update(files[i]).digest('hex')])), hostedAcceptance: false }, null, 2));
console.log(JSON.stringify({ localBackupRestore: 'PASS', applied: process.argv.includes('--apply'), pending }));
