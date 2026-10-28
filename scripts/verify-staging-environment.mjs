/** Verify only. Never echo credentials or execute hosted writes. */
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { lookup } from 'node:dns/promises';
import { createConnection } from 'node:net';
import { spawnSync } from 'node:child_process';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const authorized = arg('authorized-project');
if (!/^[a-z]{20}$/.test(authorized || '')) throw Error('Supply the independently authorized project reference.');
const output = arg('output') || 'scratch/staging-environment-verification.json';
const report = { at: new Date().toISOString(), authorizedProject: authorized, readOnly: true, checks: {}, blockers: [] };
const fail = message => { report.blockers.push(message); };
const config = parseEnv(await readFile(arg('env-file') || '.env.staging.local', 'utf8'));
const required = ['KORA_STAGING_PROJECT_REF', 'KORA_STAGING_DB_URL', 'KORA_STAGING_ANON_KEY', 'KORA_STAGING_SERVICE_ROLE_KEY'];
report.checks.variables = Object.fromEntries(required.map(name => [name, !!config[name]?.trim()]));
if (required.some(name => !config[name]?.trim())) fail('One or more required staging variables are missing.');
if (config.KORA_STAGING_PROJECT_REF !== authorized) fail('Configured project reference does not match the independently authorized target.');
let database;
try {
  database = new URL(config.KORA_STAGING_DB_URL);
  const username = decodeURIComponent(database.username);
  const direct = database.hostname === `db.${authorized}.supabase.co` && username === 'postgres';
  const pooler = /^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(database.hostname) && username === `postgres.${authorized}` && (!database.port || database.port === '5432');
  report.checks.connectionFormat = { postgresScheme: ['postgres:', 'postgresql:'].includes(database.protocol), passwordPresent: !!database.password, databaseIsPostgres: database.pathname === '/postgres', authorizedRouting: direct || pooler, sessionPooler: pooler };
  if (!report.checks.connectionFormat.postgresScheme || !database.password || database.pathname !== '/postgres' || (!direct && !pooler)) fail('Database URI does not identify the authorized direct endpoint or Session Pooler route.');
} catch { fail('Database URI is not valid.'); }
function keyKind(key) { return key?.startsWith('sb_publishable_') ? 'publishable' : key?.startsWith('sb_secret_') ? 'secret' : key?.split('.').length === 3 ? 'legacy-jwt' : 'invalid'; }
for (const [name, role] of [['KORA_STAGING_ANON_KEY', 'anon'], ['KORA_STAGING_SERVICE_ROLE_KEY', 'service_role']]) {
  const key = config[name], kind = keyKind(key);
  const record = { kind, expectedRole: role, compatibleFormat: role === 'anon' ? ['publishable', 'legacy-jwt'].includes(kind) : ['secret', 'legacy-jwt'].includes(kind) };
  if (kind === 'legacy-jwt') {
    try { const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); record.projectMatches = payload.ref === authorized; record.roleMatches = payload.role === role; record.unexpired = !payload.exp || payload.exp * 1000 > Date.now(); if (!record.projectMatches || !record.roleMatches || !record.unexpired) record.compatibleFormat = false; } catch { record.compatibleFormat = false; }
  }
  report.checks[name] = record;
  if (!record.compatibleFormat) fail(`${name} is incompatible with its intended role or target.`);
}
if (!report.blockers.length) {
  try {
    const addresses = await lookup(database.hostname, { all: true });
    report.checks.dns = { resolved: addresses.length > 0, ipv4: addresses.filter(row => row.family === 4).length, ipv6: addresses.filter(row => row.family === 6).length };
    await new Promise((done, reject) => { const socket = createConnection({ host: database.hostname, port: Number(database.port || 5432), family: addresses.some(row => row.family === 4) ? 4 : 6 }); socket.setTimeout(10000); socket.once('connect', () => { socket.destroy(); done(); }); socket.once('timeout', () => { socket.destroy(); reject(Error('TCP timeout')); }); socket.once('error', reject); });
    report.checks.tcp = { connected: true };
  } catch (error) { report.checks.tcp = { connected: false, code: error.code || 'TIMEOUT' }; fail('Staging DNS/TCP connectivity failed.'); }
  for (const [name, path] of [['KORA_STAGING_ANON_KEY', '/auth/v1/settings'], ['KORA_STAGING_SERVICE_ROLE_KEY', '/auth/v1/admin/users?page=1&per_page=1']]) {
    try {
      const headers = { apikey: config[name] }; if (keyKind(config[name]) === 'legacy-jwt') headers.Authorization = `Bearer ${config[name]}`;
      const response = await fetch(`https://${authorized}.supabase.co${path}`, { headers, signal: AbortSignal.timeout(15000) });
      const returnedRef = response.headers.get('sb-project-ref');
      report.checks[`${name}_api`] = { status: response.status, accepted: response.ok, returnedProjectMatches: !returnedRef || returnedRef === authorized };
      await response.arrayBuffer();
      if (!response.ok || returnedRef && returnedRef !== authorized) fail(`${name} was not accepted for the authorized project's API.`);
    } catch { fail(`${name} API verification could not connect.`); }
  }
  if (report.checks.dns?.resolved) {
    const caFile = arg('ca-file');
    let rootCertificate = '/etc/ssl/certs/ca-certificates.crt';
    if (caFile) {
      const ca = await readFile(caFile, 'utf8');
      if (!ca.includes('-----BEGIN CERTIFICATE-----')) throw Error('The supplied CA file is not a PEM certificate.');
      const copy = spawnSync('docker', ['exec', '-i', 'supabase_db_react-kanban', 'sh', '-c', 'cat > /tmp/kora-staging-qualification-ca.crt'], { input: ca, encoding: 'utf8', timeout: 10000 });
      if (copy.status !== 0) throw Error('The qualification CA could not be installed in the local client container.');
      rootCertificate = '/tmp/kora-staging-qualification-ca.crt';
    }
    const env = { ...process.env, PGPASSWORD: decodeURIComponent(database.password) };
    const args = ['exec', '-e', 'PGPASSWORD', '-e', `PGHOST=${database.hostname}`, '-e', `PGPORT=${database.port || 5432}`, '-e', `PGUSER=${decodeURIComponent(database.username)}`, '-e', 'PGDATABASE=postgres', '-e', 'PGSSLMODE=verify-full', '-e', `PGSSLROOTCERT=${rootCertificate}`, '-e', 'PGCONNECT_TIMEOUT=15', 'supabase_db_react-kanban', 'psql', '-X', '-qAt', '--no-password', '-v', 'ON_ERROR_STOP=1', '-c'];
    const sql = "begin read only; select jsonb_build_object('database',current_database(),'serverVersion',current_setting('server_version_num'),'migrationTable',to_regclass('supabase_migrations.schema_migrations')::text,'applicationTables',(select coalesce(jsonb_agg(tablename order by tablename),'[]'::jsonb) from pg_tables where schemaname='public'),'extensions',(select jsonb_agg(extname order by extname) from pg_extension),'authUsers',(select count(*) from auth.users),'storageObjects',(select count(*) from storage.objects)); rollback;";
    const result = spawnSync('docker', [...args, sql], { env, encoding: 'utf8', timeout: 25000 });
    const diagnostic = `${result.stderr || ''}\n${result.stdout || ''}`;
    report.checks.database = { readOnlyConnected: result.status === 0, exitStatus: result.status, signal: result.signal, processFailure: result.error?.code ?? null, certificateFailure: /certificate/i.test(diagnostic), authenticationFailure: /password authentication failed/i.test(diagnostic), tenantFailure: /tenant or user not found/i.test(diagnostic), networkFailure: /network is unreachable|timed out|could not translate|timeout/i.test(diagnostic), dockerUnavailable: /docker API|docker daemon|dockerDesktopLinuxEngine/i.test(diagnostic) };
    if (result.status === 0) {
      report.metadata = JSON.parse(result.stdout.trim());
      if (report.metadata.migrationTable) {
        const history = spawnSync('docker', [...args, "begin read only; select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name) order by version),'[]'::jsonb) from supabase_migrations.schema_migrations; rollback;"], { env, encoding: 'utf8', timeout: 25000 });
        if (history.status === 0) report.migrations = JSON.parse(history.stdout.trim()); else fail('Migration history could not be read.');
      } else report.migrations = [];
      if (!report.checks.tcp.connected) { report.checks.database.tcpVerifiedViaDocker = true; report.blockers = report.blockers.filter(message => message !== 'Staging DNS/TCP connectivity failed.'); }
    } else {
      let sanitized = diagnostic.replaceAll(env.PGPASSWORD, '[redacted]');
      for (const value of Object.values(config)) if (value) sanitized = sanitized.replaceAll(value, '[redacted]');
      await writeFile(`${output}.database-error.txt`, sanitized);
      fail('TLS-verified read-only database access failed.');
    }
  }
}
report.status = report.blockers.length ? 'BLOCKED' : 'PASS';
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, authorizedProject: authorized, checks: report.checks, metadata: report.metadata ? { serverVersion: report.metadata.serverVersion, applicationTableCount: report.metadata.applicationTables.length, authUsers: report.metadata.authUsers, storageObjects: report.metadata.storageObjects, migrationCount: report.migrations?.length } : null, blockers: report.blockers }, null, 2));
if (report.blockers.length) process.exitCode = 1;
