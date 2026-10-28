/** Read-only staging preparation. Hosted writes require a separate reviewed migration operation. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const migrations = ['20261026163000_task_workflow_transition.sql', '20261026170000_private_profile_images.sql', '20261027010000_task_workflow_realtime.sql'];
if (process.argv.includes('--apply')) throw Error('Hosted application is not supported by this preparation tool. Review the target, restored backup and migration history, then use the approved Supabase migration process.');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const contents = await Promise.all(migrations.map(name => readFile(`supabase/migrations/${name}`)));
const plan = { mode: 'plan', order: migrations.map((name, i) => ({ name, sha256: hash(contents[i]) })),
  dependencies: ['complete baseline and recurring-task migration', 'auth.uid()', 'app_private.can_edit_workspace(uuid)', 'profiles, workspace_members, tasks, boards, lists, task_activities', 'storage.objects and storage.buckets', 'supabase_realtime publication'],
  connectedAcceptance: false, productionAuthorized: false };
if (!process.argv.includes('--inspect')) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }
const ref = process.env.KORA_STAGING_PROJECT_REF;
if (!/^[a-z]{20}$/.test(ref || '') || process.env.PGHOST !== `db.${ref}.supabase.co`) throw Error('Supply an explicit staging ref and matching direct PGHOST; pooled/ambiguous targets are refused.');
const env = { ...process.env, PGSSLMODE: 'verify-full', PGCONNECT_TIMEOUT: '15', PGAPPNAME: 'KoraStagingQualification' };
const run = (args, input) => {
  const result = spawnSync('psql', ['--quiet', '--no-psqlrc', '--no-password', '--set=ON_ERROR_STOP=1', ...args], { env, input, encoding: 'utf8', timeout: 120000 });
  if (result.error || result.status !== 0) throw Error('psql failed. Check local PostgreSQL tooling, staging access and private database diagnostics. No credentials are printed.');
  return result.stdout;
};
const metadata = run(['--tuples-only', '--no-align', '--command', `begin read only;
select jsonb_build_object('tables',(select jsonb_agg(tablename) from pg_tables where schemaname='public'),
'rpc',to_regprocedure('public.transition_task_workflow(jsonb)')::text,
'edit_permission',to_regprocedure('app_private.can_edit_workspace(uuid)')::text,
'policies',(select jsonb_agg(jsonb_build_object('table',tablename,'policy',policyname,'command',cmd)) from pg_policies where schemaname in ('public','storage')),
'publications',(select jsonb_agg(jsonb_build_object('publication',pubname,'schema',schemaname,'table',tablename)) from pg_publication_tables),
'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations)); rollback;`]);
const outputArg = process.argv.find(arg => arg.startsWith('--output='));
if (outputArg) await writeFile(resolve(outputArg.slice(9)), JSON.stringify({ ...plan, mode: 'inspect', metadata: JSON.parse(metadata.trim()) }, null, 2));
else console.log(JSON.stringify({ ...plan, mode: 'inspect', metadata: JSON.parse(metadata.trim()) }, null, 2));
