/** Exercise an unchanged 0.1.31 binary, forwarding its API requests to real staging. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {chromium,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {qualificationTarget} from './qualification-target.mjs';
const arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
const {config,root,staging}=await qualificationTarget('scratch/legacy-native-staging');assert.ok(staging);
const output=resolve(root),installed=join(process.env.LOCALAPPDATA,'Kora/kora.exe');
const expected='fc0539c891b37ecdabca922c4ee0fd907f581992cff2a5b36d7869422660645e';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(digest(await readFile(installed)),expected);
const executable=join(output,'kora-legacy-0.1.31.exe'),profile=join(output,'webview-profile');await copyFile(installed,executable);await mkdir(profile,{recursive:false});
assert.equal(digest(await readFile(executable)),expected);assert.ok((await realpath(profile)).startsWith((await realpath(output))+'\\'));
const available=spawnSync('powershell.exe',['-NoProfile','-Command',"if(Get-NetTCPConnection -State Listen -LocalPort 9224 -ErrorAction SilentlyContinue){exit 1}"],{encoding:'utf8',timeout:10000});assert.equal(available.status,0,'The dedicated legacy debug port is occupied.');
const fixture=JSON.parse(await readFile(arg('owner-fixture'),'utf8'));assert.equal(fixture.target,config.API_URL);
const client=createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const auth=await client.auth.signInWithPassword({email:fixture.email,password:fixture.password});assert.ok(!auth.error,'Staging fixture authentication failed; details withheld.');assert.equal(auth.data.user.id,fixture.userId);
const taskId=randomUUID(),title='Legacy native check '+randomUUID().slice(0,8);
const lists=await client.from('lists').select('id').eq('board_id',fixture.boardId).order('position');assert.ok(!lists.error&&lists.data.length);
const created=await client.from('tasks').insert({id:taskId,workspace_id:fixture.workspaceId,board_id:fixture.boardId,list_id:lists.data[0].id,title,created_by:fixture.userId,position:900});assert.ok(!created.error,'Legacy test fixture creation failed.');
let child,browser,page;const realtimePeers=new Set();
const result={at:new Date().toISOString(),status:'INCOMPLETE',installedVersion:'0.1.31',binarySha256:expected,installedFilesChanged:false,profile,debugPort:9224,networkRebinding:'Production Supabase request URLs and anonymous API headers are forwarded to the real authorized staging project; request bodies and server responses are unchanged.',fakeResponses:false,productionWrites:false,checks:[],forwardedRequests:0,stage:'launch'};
const alive=()=>child&&child.exitCode===null&&child.signalCode===null;
try{
  child=spawn(executable,[],{cwd:output,windowsHide:true,stdio:'ignore',env:{...process.env,WEBVIEW2_USER_DATA_FOLDER:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9224'}});
  result.pid=child.pid;await writeFile(join(output,'process.json'),JSON.stringify({pid:child.pid,command:[executable],profile,debugPort:9224,worktree:process.cwd(),startedAt:new Date().toISOString()},null,2));
  for(let attempt=0;attempt<40;attempt++){
    try{browser=await chromium.connectOverCDP('http://127.0.0.1:9224',{timeout:1000});break;}catch{assert.ok(alive(),'Copied legacy executable exited.');await new Promise(done=>setTimeout(done,250));}
  }
  assert.ok(browser,'Legacy WebView debugging did not become available.');
  const inspect=spawnSync('powershell.exe',['-NoProfile','-Command',`$all=Get-CimInstance Win32_Process;$port=Get-NetTCPConnection -State Listen -LocalPort 9224;$ancestor=[int]$port.OwningProcess;$owned=$false;for($i=0;$i-lt 16;$i++){if($ancestor-eq ${child.pid}){$owned=$true;break};$row=$all|Where-Object ProcessId -eq $ancestor;if(-not $row){break};$ancestor=[int]$row.ParentProcessId};$profileProof=@($all|Where-Object {$_.CommandLine -and $_.CommandLine.Contains($env:KORA_LEGACY_PROFILE)}).Count -gt 0;@{owned=$owned;profileIsolated=$profileProof}|ConvertTo-Json -Compress`],{env:{...process.env,KORA_LEGACY_PROFILE:profile},encoding:'utf8',timeout:15000});
  assert.equal(inspect.status,0);const proof=JSON.parse(inspect.stdout);assert.ok(proof.owned&&proof.profileIsolated,'Legacy process/profile ownership could not be proven.');
  const context=browser.contexts()[0];
  await context.routeWebSocket('wss://lthlvntvjgnornrdxnms.supabase.co/**',route=>{
    const url=new URL(route.url());url.hostname='enzzyuhchizfmruxhfhg.supabase.co';url.searchParams.set('apikey',config.ANON_KEY);
    const peer=new WebSocket(url);peer.binaryType='arraybuffer';realtimePeers.add(peer);const pending=[];
    route.onMessage(message=>{if(peer.readyState===WebSocket.OPEN)peer.send(message);else if(peer.readyState===WebSocket.CONNECTING)pending.push(message);});
    route.onClose(()=>{if(peer.readyState===WebSocket.OPEN)peer.close();});
    peer.addEventListener('open',()=>{for(const message of pending)peer.send(message);pending.length=0;});
    peer.addEventListener('message',event=>route.send(typeof event.data==='string'?event.data:Buffer.from(event.data)));
    peer.addEventListener('close',()=>{realtimePeers.delete(peer);route.close().catch(()=>{});});
    peer.addEventListener('error',()=>{result.forwardingFailure=true;route.close().catch(()=>{});});
  });
  await context.route('https://lthlvntvjgnornrdxnms.supabase.co/**',async route=>{
    const request=route.request(),url=new URL(request.url());url.hostname='enzzyuhchizfmruxhfhg.supabase.co';
    const headers={...request.headers(),apikey:config.ANON_KEY};delete headers.host;
    const bearer=headers.authorization?.replace(/^Bearer /,'');
    if(bearer?.split('.').length===3){try{if(JSON.parse(Buffer.from(bearer.split('.')[1],'base64url')).role==='anon')headers.authorization='Bearer '+config.ANON_KEY;}catch{/* Real user JWTs remain unchanged. */}}
    if(config.ANON_KEY.startsWith('sb_publishable_')&&headers.authorization==='Bearer '+config.ANON_KEY)delete headers.authorization;
    result.forwardedRequests++;
    try{const response=await route.fetch({url:url.href,headers,timeout:30000});await route.fulfill({response});}
    catch{await route.abort('failed').catch(()=>{});result.forwardingFailure=true;}
  });
  // Retain real HTTP traffic; only the target/key are rebound. Do not return fake data.
  page=context.pages().find(page=>/tauri\.localhost|tauri:\/\//.test(page.url()));assert.ok(page,'Expected embedded legacy app page.');
  result.stage='sign-in';
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.includes('auth-token')).length),0,'The isolated legacy profile must start without a personal session.');
  const destination=`/workspaces/${fixture.workspaceId}/boards/${fixture.boardId}`;
  await page.evaluate(destination=>{location.hash='/auth/sign-in?returnTo='+encodeURIComponent(destination);},destination);
  await page.getByLabel('Email',{exact:true}).fill(fixture.email);await page.getByLabel('Password',{exact:true}).fill(fixture.password);
  await page.getByRole('button',{name:'Sign in',exact:true}).last().click();
  await expect.poll(()=>page.evaluate(()=>location.hash),{timeout:30000}).toBe('#'+destination);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.nativeSurface),{timeout:30000}).toMatch(/dock|workspace/);
  result.checks.push('actual unchanged 0.1.31 binary signs into real staging');
  if(await page.evaluate(()=>document.documentElement.dataset.nativeSurface)==='dock')await page.getByRole('button',{name:'Tasks',exact:true}).first().evaluate(button=>button.click());
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.nativeSurface)).toBe('workspace');
  result.stage='task-read';await expect(page.getByRole('button',{name:'Open task: '+title,exact:true})).toBeVisible({timeout:30000});
  result.stage='open-editor';await page.getByRole('button',{name:'Open task: '+title,exact:true}).click();
  const drawer=page.getByRole('dialog');await expect(drawer).toBeVisible();
  result.checks.push('old Tasks reads the migrated staging schema and opens an original');
  result.stage='task-edit';
  await drawer.getByRole('textbox',{name:/task title|task name|^title$/i}).fill(title+' saved');
  await drawer.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect.poll(async()=>{const response=await client.from('tasks').select('title').eq('id',taskId).single();return response.data?.title;},{timeout:20000}).toBe(title+' saved');
  result.checks.push('old task editor saves through actual legacy API calls');
  result.stage='reload';await page.reload();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.nativeSurface),{timeout:30000}).toMatch(/dock|workspace/);
  if(await page.evaluate(()=>document.documentElement.dataset.nativeSurface)==='dock')await page.getByRole('button',{name:'Tasks',exact:true}).first().evaluate(button=>button.click());
  await expect(page.getByText(title+' saved',{exact:true}).first()).toBeVisible({timeout:30000});
  result.checks.push('legacy task reload recovers the server-committed value');
  assert.ok(!result.forwardingFailure);assert.equal(digest(await readFile(installed)),expected);
  result.status='PASS';result.stage='complete';
}catch(error){result.status='FAIL';result.errorType=error.name;let reason=String(error.message);for(const value of [fixture.password,config.ANON_KEY,config.SERVICE_ROLE_KEY,auth.data.session?.access_token,auth.data.session?.refresh_token])if(value)reason=reason.split(value).join('[redacted]');result.reason=reason.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[redacted token]').slice(0,3500);result.visibleControls=await page?.locator('h1,h2,button,input').evaluateAll(elements=>elements.map(element=>({tag:element.tagName,label:element.getAttribute('aria-label')||element.getAttribute('placeholder')||(element.tagName==='BUTTON'?element.textContent?.slice(0,100):undefined),type:element.getAttribute('type')}))).catch(()=>[]);process.exitCode=1;}
finally{
  if(page&&alive())await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|close',{label:'main'})).catch(()=>{});
  for(let i=0;i<30&&alive();i++)await new Promise(done=>setTimeout(done,200));
  result.normalQuit=!alive();
  for(const peer of realtimePeers)if(peer.readyState===WebSocket.OPEN)peer.close();
  await browser?.close().catch(()=>{});
  if(alive()){
    const guarded=spawnSync('powershell.exe',['-NoProfile','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${child.pid}';if($p.ExecutablePath-ne $env:KORA_LEGACY_EXE){exit 1}`],{env:{...process.env,KORA_LEGACY_EXE:executable},encoding:'utf8',timeout:10000});
    assert.equal(guarded.status,0,'Copied process identity changed; refusing forced cleanup.');child.kill();result.status='FAIL';result.forcedCleanup=true;process.exitCode=1;
  }
  const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const removed=await admin.from('tasks').delete().eq('id',taskId).eq('created_by',fixture.userId).select('id');
  const remaining=await admin.from('tasks').select('id').eq('id',taskId).maybeSingle();result.generatedTaskCleaned=!removed.error&&!remaining.error&&remaining.data===null;
  if(!result.generatedTaskCleaned){result.status='FAIL';process.exitCode=1;}await client.auth.signOut();
  await writeFile(join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,stage:result.stage,checks:result.checks.length,normalQuit:result.normalQuit,forwardedRequests:result.forwardedRequests,productionWrites:false,credentialsPrinted:false}));
}
