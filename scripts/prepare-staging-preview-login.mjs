/** Hand the owner an existing generated staging login without printing credentials. */
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {parseEnv} from 'node:util';
const arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
const fixture=JSON.parse(await readFile(arg('owner-fixture'),'utf8'));
assert.equal(fixture.target,'https://enzzyuhchizfmruxhfhg.supabase.co');assert.match(fixture.email,/^native-qualification-[a-f0-9-]+@example\.invalid$/);
const deployment=JSON.parse(await readFile(arg('deployment'),'utf8'));assert.equal(deployment.ready,true);assert.equal(deployment.productionPublished,false);assert.equal(deployment.projectRef,'enzzyuhchizfmruxhfhg');
const config=parseEnv(await readFile('.env.staging.local','utf8'));assert.equal(config.KORA_STAGING_PROJECT_REF,'enzzyuhchizfmruxhfhg');
const client=createClient(fixture.target,config.KORA_STAGING_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const result=await client.auth.signInWithPassword({email:fixture.email,password:fixture.password});assert.ok(!result.error,'Generated staging identity is unavailable; details withheld.');assert.equal(result.data.user.id,fixture.userId);await client.auth.signOut();
const directory=join(process.env.LOCALAPPDATA,'Kora/secrets');assert.ok(!(await lstat(directory)).isSymbolicLink());
const target=join(directory,'staging-preview-login.txt');
// The pre-existing private parent is restricted before the new file is written.
const privacy=`$ErrorActionPreference='Stop';$identity=[Security.Principal.WindowsIdentity]::GetCurrent().User;$acl=[IO.Directory]::GetAccessControl($env:KORA_TEST_LOGIN_DIRECTORY);if(-not $acl.AreAccessRulesProtected){throw 'Private parent must have protected access'};foreach($entry in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){if($entry.IdentityReference-ne $identity){throw 'Private parent must allow only the current user'}}`;
const before=spawnSync('powershell.exe',['-NoProfile','-Command',privacy],{env:{...process.env,KORA_TEST_LOGIN_DIRECTORY:directory},encoding:'utf8',timeout:10000});assert.ok(before.status===0,'Private handoff directory access could not be verified.');
await writeFile(target,['Kora STAGING preview only — separate from Production',deployment.url,'Email: '+fixture.email,'Password: '+fixture.password,'Generated staging test credentials. Do not use your Production password.'].join('\r\n'),{flag:'wx'});
const script=`$ErrorActionPreference='Stop';$identity=[Security.Principal.WindowsIdentity]::GetCurrent().User;$acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner($identity);$acl.SetAccessRuleProtection($true,$false);$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','Allow'));[IO.File]::SetAccessControl($env:KORA_TEST_LOGIN_HANDOFF,$acl);if(-not ([IO.File]::GetAccessControl($env:KORA_TEST_LOGIN_HANDOFF)).AreAccessRulesProtected){throw 'Private access was not established'}`;
const secured=spawnSync('powershell.exe',['-NoProfile','-Command',script],{env:{...process.env,KORA_TEST_LOGIN_HANDOFF:target},encoding:'utf8',timeout:10000});assert.ok(secured.status===0,'Private login handoff access verification failed; details withheld.');
console.log(JSON.stringify({ready:true,path:target,restricted:true,credentialsPrinted:false}));
