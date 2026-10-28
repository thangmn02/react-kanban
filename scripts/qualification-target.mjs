/** Keep real-service qualification confined to the local stack or independently authorized staging. */
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { authorizedProject } from './staging-qualification-contract.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
export async function qualificationTarget(defaultOutput) {
  const staging = process.argv.includes('--staging');
  const root = arg('output') || defaultOutput;
  assert.match(root, /^scratch\/[a-z0-9/_-]+$/, 'Evidence must use a fresh repository scratch directory.'); await mkdir(root, { recursive: true });
  const path = arg('backup')||(staging ? 'scratch/product-completion-261027-0846/staging-before-fixtures/backup-manifest.json' : 'scratch/product-completion-261027-0846/notes-import-layout-backup/backup-manifest.json');
  const backup = JSON.parse(await readFile(path, 'utf8')); assert.equal(backup.restoreVerified, true);
  const actualHash = createHash('sha256').update(await readFile(backup.archive)).digest('hex');
  let config;
  if (staging) {
    assert.equal(arg('authorized-project'), authorizedProject, 'Supply the independently authorized staging target.'); assert.equal(backup.authorizedProject, authorizedProject); assert.equal(actualHash, backup.encryptedArchiveSha256);
    assert.ok(Date.now()-Date.parse(backup.at)<4*60*60*1000&&Date.parse(backup.at)<=Date.now(),'A fresh staging backup is required before fixture writes.');assert.equal(backup.storageBytesRestoreVerified,true);
    if(backup.storageObjectBytesRequired){assert.ok(backup.assetsArchive);assert.equal(createHash('sha256').update(await readFile(backup.assetsArchive)).digest('hex'),backup.assetsArchiveSha256);}
    const source = parseEnv(await readFile('.env.staging.local', 'utf8')); assert.equal(source.KORA_STAGING_PROJECT_REF, authorizedProject);
    const applied = JSON.parse(await readFile(arg('history-receipt')||'scratch/product-completion-261027-0846/staging-migration-result.json', 'utf8')); assert.equal(applied.committed, true); assert.equal(applied.verification, 'PASS'); assert.equal(applied.authorizedProject, authorizedProject);
    const names=(await readdir('supabase/migrations')).filter(name=>/^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort();const migrations=await Promise.all(names.map(async name=>({name,sha256:createHash('sha256').update(await readFile(`supabase/migrations/${name}`)).digest('hex')})));assert.deepEqual(migrations,applied.migrations,'Qualification must use the exact committed source schema.');
    assert.equal(backup.counts['supabase_migrations.schema_migrations'],migrations.length,'The restored fixture backup must include the committed migration history.');
    config = { API_URL: `https://${authorizedProject}.supabase.co`, ANON_KEY: source.KORA_STAGING_ANON_KEY, SERVICE_ROLE_KEY: source.KORA_STAGING_SERVICE_ROLE_KEY };
  } else {
    assert.equal(backup.target, 'local Docker Supabase only'); assert.equal(actualHash, backup.sha256);
    const cli = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '--output', 'json'], { encoding: 'utf8', timeout: 30000 }); assert.equal(cli.status, 0, 'Local Supabase must be available.'); config = JSON.parse(cli.stdout); assert.equal(config.API_URL, 'http://127.0.0.1:54321');
  }
  return { root, config, backup, staging, target: staging ? `authorized staging ${authorizedProject}` : 'local Docker Supabase only' };
}
