/** Apply only a reviewed, restore-rehearsed initial schema to the explicitly authorized empty staging project. */
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { postgresImage, platformFingerprintSql, platformVersionsSql, countsSqlFor, quoteIdentifier } from './staging-qualification-contract.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const authorized = arg('authorized-project'); assert.equal(authorized, 'enzzyuhchizfmruxhfhg', 'Only the independently authorized staging target is admitted.');
const root = 'scratch/product-completion-261027-0846', receipt = JSON.parse(await readFile(`${root}/staging-rehearsal/backup-manifest.json`, 'utf8'));
assert.equal(receipt.authorizedProject, authorized); assert.equal(receipt.restoreVerified, true); assert.equal(receipt.rehearsal?.status, 'PASS'); assert.equal(receipt.storageObjectCount, 0);
assert.ok(Date.now() - Date.parse(receipt.at) < 4 * 60 * 60 * 1000, 'The staging recovery receipt must be fresh.');
const hash = bytes => createHash('sha256').update(bytes).digest('hex'); assert.equal(hash(await readFile(receipt.archive)), receipt.encryptedArchiveSha256);
const names = (await readdir('supabase/migrations')).filter(name => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort();
const contents = await Promise.all(names.map(name => readFile(`supabase/migrations/${name}`, 'utf8')));
const current = names.map((name, index) => ({ name, sha256: hash(contents[index]) })); assert.deepEqual(current, receipt.rehearsal.migrations, 'Every source migration must match the successfully restored/rehearsed copy.');
const config = parseEnv(await readFile('.env.staging.local', 'utf8')), database = new URL(config.KORA_STAGING_DB_URL); assert.equal(config.KORA_STAGING_PROJECT_REF, authorized);
assert.match(database.hostname, /^[a-z0-9.-]+\.pooler\.supabase\.com$/); assert.equal(decodeURIComponent(database.username), `postgres.${authorized}`); assert.equal(database.port || '5432', '5432'); assert.equal(database.pathname, '/postgres');
const image = receipt.image, ca = resolve(`${root}/supabase-root-ca.crt`), env = { ...process.env, PGPASSWORD: decodeURIComponent(database.password) };
assert.equal(image, postgresImage); assert.equal(hash(await readFile(ca)), receipt.caSha256, 'Apply must use the qualified CA.');
const run = (sql, operation = 'read-only verification') => {
  const result = spawnSync('docker', ['run', '--rm', '-i', '--mount', `type=bind,source=${ca},target=/tmp/kora-root-ca.crt,readonly`, '-e', 'PGPASSWORD', '-e', `PGHOST=${database.hostname}`, '-e', `PGPORT=${database.port || '5432'}`, '-e', `PGUSER=${decodeURIComponent(database.username)}`, '-e', 'PGDATABASE=postgres', '-e', 'PGSSLMODE=verify-full', '-e', 'PGSSLROOTCERT=/tmp/kora-root-ca.crt', '-e', 'PGCONNECT_TIMEOUT=15', image, 'psql', '-X', '-qAt', '--no-password', '-v', 'ON_ERROR_STOP=1'], { env, input: sql, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 180000 });
  if (result.error || result.status !== 0) {
    let diagnostic = result.stderr || result.error?.code || 'Unknown process failure';
    for (const value of [...Object.values(config), env.PGPASSWORD, database.hostname, decodeURIComponent(database.username)]) if (value) diagnostic = diagnostic.replaceAll(value, '[redacted]');
    writeFileSync(`${root}/staging-migration-private-error.txt`, diagnostic);
    throw Error(`${operation} failed (exit ${result.status}). A migration commit outcome must be reconciled read-only before retrying. Sanitized diagnostics retained privately.`);
  }
  return result.stdout.trim();
};
const readStateSql = `select jsonb_build_object('counts',(select jsonb_object_agg(name,count order by name) from (${countsSqlFor(Object.keys(receipt.counts))}) counts),'fingerprint',(${platformFingerprintSql}),'versions',(${platformVersionsSql}))`;
const state = JSON.parse(run(`begin read only; set local search_path=pg_catalog; ${readStateSql}; rollback;`));
assert.deepEqual(state.counts, receipt.counts, 'Every backed-up owning table must still match the admitted state.');
assert.equal(state.fingerprint, receipt.platformFingerprint, 'Live platform schema differs from the restored/rehearsed backup.');
assert.deepEqual(state.versions, receipt.platformVersions, 'Provider migration versions differ from the backup.');
const identity = JSON.parse(run("begin read only; select json_build_object('publicTables',(select count(*) from pg_tables where schemaname='public'),'authUsers',(select count(*) from auth.users),'storageObjects',(select count(*) from storage.objects),'migrationTable',to_regclass('supabase_migrations.schema_migrations')::text,'publication',(select count(*) from pg_publication where pubname='supabase_realtime'),'crypto',(select count(*) from pg_extension where extname in ('pgcrypto','uuid-ossp'))); rollback;"));
assert.deepEqual(identity, { publicTables: 0, authUsers: 0, storageObjects: 0, migrationTable: null, publication: 1, crypto: 2 }, 'Live staging must still match its admitted empty state and dependencies.');
const plan = { at: new Date().toISOString(), authorizedProject: authorized, productionAuthorized: false, backup: receipt.archive, encryptedBackupHash: receipt.encryptedArchiveSha256, restoreRehearsalVerified: true, migrations: current, livePrerequisites: identity, mode: process.argv.includes('--apply') ? 'apply' : 'plan' };
await writeFile(`${root}/staging-migration-plan.json`, JSON.stringify(plan, null, 2));
if (!process.argv.includes('--apply') && !process.argv.includes('--check-hosted-transaction')) { console.log(JSON.stringify({ status: 'READY', authorizedProject: authorized, migrationCount: names.length, hostedWrites: false })); process.exit(0); }
let transaction = "begin; set local lock_timeout='15s'; set local statement_timeout='120s'; select pg_advisory_xact_lock(hashtextextended('kora-initial-staging-migrations',0));\n";
const writableParents = ['auth.users', 'storage.buckets', 'storage.objects'];
transaction += `lock table ${writableParents.map(key => key.split('.').map(quoteIdentifier).join('.')).join(',')} in share row exclusive mode;\n`;
const providerTables = Object.keys(receipt.counts).filter(key => !writableParents.includes(key));
transaction += `lock table ${providerTables.map(key => key.split('.').map(quoteIdentifier).join('.')).join(',')} in access share mode; set local search_path=pg_catalog;\n`;
const expected = JSON.stringify(state); const stateTag = `$state_${hash(expected).slice(0,16)}$`;
transaction += `do $$ begin if (${readStateSql}) is distinct from ${stateTag}${expected}${stateTag}::jsonb then raise exception 'Owning tables or platform schema changed after backup. No migration applied.'; end if; end $$;\n`;
transaction += "do $$ begin if exists(select 1 from pg_tables where schemaname='public') or exists(select 1 from auth.users) or exists(select 1 from storage.objects) or to_regclass('supabase_migrations.schema_migrations') is not null then raise exception 'Staging changed after admission; no migration applied.'; end if; end $$;\n";
transaction += 'create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);\n';
names.forEach((name, index) => { const tag = `$migration_${current[index].sha256.slice(0, 16)}$`; assert.ok(!contents[index].includes(tag)); transaction += contents[index] + `\ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('${name.slice(0,14)}','${name.slice(15,-4)}',array[${tag}${contents[index]}${tag}]);\n`; });
transaction += `set local search_path=pg_catalog; do $$ begin if (${platformFingerprintSql}) is distinct from '${receipt.platformFingerprint}' or (${platformVersionsSql}) is distinct from '${JSON.stringify(receipt.platformVersions)}'::jsonb then raise exception 'Provider schema changed during migration. No migration applied.'; end if; end $$;\n`;
transaction += process.argv.includes('--check-hosted-transaction') ? 'rollback;' : "notify pgrst,'reload schema'; commit;";
if (process.argv.includes('--check-hosted-transaction')) { run(transaction, 'Rolled-back staging migration rehearsal'); console.log(JSON.stringify({ status: 'PASS', authorizedProject: authorized, transactionRolledBack: true, committedChanges: false })); process.exit(0); }
try { run(transaction, 'Staging migration transaction'); }
catch (error) { console.error(JSON.stringify({ status: 'UNKNOWN', authorizedProject: authorized, action: 'Reconcile migration history read-only before retrying.' })); await writeFile(`${root}/staging-migration-result.json`, JSON.stringify({ ...plan, committed: null, outcome: 'UNKNOWN: reconcile read-only before retrying', attemptedAt: new Date().toISOString() }, null, 2)); throw error; }
console.log(JSON.stringify({ status: 'COMMITTED', authorizedProject: authorized, verification: 'pending' }));
try { await writeFile(`${root}/staging-migration-result.json`, JSON.stringify({ ...plan, committed: true, verification: 'pending', completedAt: new Date().toISOString() }, null, 2)); }
catch { throw Error('Staging migrations committed successfully; local receipt persistence failed. Reconcile read-only without reapplying.'); }
let history;
try { history = JSON.parse(run("begin read only; select json_agg(json_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations; rollback;")); assert.equal(history.length, names.length); }
catch { throw Error('Staging migrations committed successfully; subsequent read-only verification is incomplete. Reconcile history without reapplying.'); }
await writeFile(`${root}/staging-migration-result.json`, JSON.stringify({ ...plan, committed: true, verification: 'PASS', history, completedAt: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ status: 'PASS', authorizedProject: authorized, committedMigrations: history.length, productionTouched: false }));
