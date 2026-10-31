/** Build the public Kora release (web or signed Windows) from committed source with production public settings.
 *  Only browser-safe values (Supabase URL/publishable key, Turnstile site key) are read; nothing is printed. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {parseEnv} from 'node:util';
import {execFileSync,spawnSync} from 'node:child_process';

const target=process.argv[2];
assert.ok(target==='web'||target==='windows','Usage: node scripts/build-release.mjs <web|windows> --env-dir=<checkout holding .env.local>');
const envDir=process.argv.find(value=>value.startsWith('--env-dir='))?.slice(10);
assert.ok(envDir,'Supply --env-dir with the production .env.local.');
const status=execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'});
assert.equal(status,'','Release builds come only from a committed tree.');
const local=parseEnv(await readFile(join(envDir,'.env.local'),'utf8')),shared=parseEnv(await readFile(join(envDir,'.env'),'utf8'));
assert.equal(local.VITE_AUTH_MODE,'supabase');
assert.equal(new URL(local.VITE_SUPABASE_URL).host,'lthlvntvjgnornrdxnms.supabase.co','Release builds target the production project only.');
assert.match(local.VITE_SUPABASE_ANON_KEY,/^sb_publishable_/,'Only the browser-safe publishable key may be embedded.');
const env={...process.env,
  VITE_AUTH_MODE:'supabase',VITE_SUPABASE_URL:local.VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY:local.VITE_SUPABASE_ANON_KEY,
  VITE_TURNSTILE_SITE_KEY:shared.VITE_TURNSTILE_SITE_KEY||'',VITE_ENABLE_NOTES_PREVIEW:'true',
  // Experiments stay off in every public build.
  VITE_ENABLE_BEAT_GRID_PREVIEW:'false',VITE_ENABLE_SOURCE_AUDIO_DELAY:'false',VITE_PRIVATE_NATIVE_COMPANION_CAPTURE:'false',
  VITE_PRIVATE_LOCAL_HYBRID:'false',VITE_PRIVATE_BEAT_CANDIDATE:'false',VITE_OWNER_PREVIEW_LOOPBACK:'false',VITE_ENABLE_DESIGN_LAB:'false',
  ...(target==='windows'?{VITE_NOTE_IMAGES_URL:'https://koraspace.online/api/note-images'}:{VITE_NOTE_IMAGES_URL:''})};
for(const name of ['KORA_OWNER_PREVIEW_LOOPBACK','GEMINI_API_KEY','SUPABASE_SERVICE_ROLE_KEY'])delete env[name];
const command=target==='web'?['npm',['run','build']]:['npx',['tauri','build']];
const result=spawnSync(command[0],command[1],{env,stdio:'inherit',shell:true});
process.exit(result.status??1);
