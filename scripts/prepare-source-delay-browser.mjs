/** Own a separate Chrome profile with Companion 0.3.29; never touch Brave or any installed extension. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access,realpath} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const arg=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const root=arg('output');assert.match(root??'',/^scratch\/[a-z0-9/_-]+$/);await mkdir(root,{recursive:false});
const packageRoot=await realpath(arg('package'));assert.ok(packageRoot.startsWith(await realpath('scratch')+sep));
const extension=resolve(packageRoot,'extension'),manifest=JSON.parse(await readFile(resolve(extension,'manifest.json'),'utf8'));
assert.equal(manifest.version,'0.3.29');assert.equal(manifest.name,'Kora Music Companion Release Candidate');
const provenance=JSON.parse(await readFile(resolve(extension,'SOURCE-AUDIO-DELAY-PROVENANCE.json'),'utf8'));
assert.equal(provenance.modelChanged,false);assert.equal(provenance.privateOnly,false);
for(const file of provenance.files)assert.equal(createHash('sha256').update(await readFile(resolve(extension,file.name))).digest('hex'),file.outputSha256,'Candidate file changed: '+file.name);
const zip=await readFile(resolve(packageRoot,'kora-music-companion.zip'));
let context,timer;const result={at:new Date().toISOString(),pid:process.pid,command:process.argv,worktree:process.cwd(),profile:resolve(root,'profile'),
  personalProfileUsed:false,extensionChanged:false,packageSha256:createHash('sha256').update(zip).digest('hex')};
try{
  context=await chromium.launchPersistentContext(result.profile,{channel:'chrome',headless:false,viewport:null,
    // Without --enable-automation, sites such as YouTube see an ordinary browser. The loopback port lets the
    // owner-test inspector read the Companion's worker; it is bound to 127.0.0.1 only.
    ignoreDefaultArgs:['--disable-extensions','--mute-audio','--enable-automation'],
    args:['--enable-unsafe-extension-debugging','--no-first-run','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+(arg('debug-port')||'9224'),
      // Test-only: lets this one extension capture without the toolbar click. Real installs still require the click.
      ...(arg('allowlist-capture')?['--allowlisted-extension-id='+arg('allowlist-capture')]:[])]});
  const cdp=await context.browser().newBrowserCDPSession();const loaded=await cdp.send('Extensions.loadUnpacked',{path:extension});
  result.extensionId=loaded.id;result.browser=(await cdp.send('Browser.getVersion')).product;
  result.ownedProcesses=(await cdp.send('SystemInfo.getProcessInfo')).processInfo.map(process=>process.id);
  const setup=await context.newPage();await setup.goto(`chrome-extension://${loaded.id}/setup.html`);
  result.companionVersion=await setup.evaluate(()=>chrome.runtime.getManifest().version);assert.equal(result.companionVersion,'0.3.29');
  // Bounded in-memory telemetry only; the owner observer reads it from Kora, nothing is uploaded.
  await setup.evaluate(()=>chrome.storage.local.set({beatTelemetryEnabled:true}));
  const source=await context.newPage();await source.goto(arg('source')||'https://soundcloud.com/discover');await source.bringToFront();
  for(const page of context.pages())if(page!==source&&page.url()==='about:blank')await page.close();
  await writeFile(resolve(root,'browser-process.json'),JSON.stringify(result,null,2));
  console.log('Test Chrome ready with Companion 0.3.29. Play your song here. Create '+root+'/stop-browser or close this window to stop.');
  await new Promise(done=>{process.once('SIGINT',done);process.once('SIGTERM',done);context.once('close',done);timer=setInterval(()=>{void access(resolve(root,'stop-browser')).then(done,()=>{});},500);});
}finally{clearInterval(timer);await context?.close();result.closedAt=new Date().toISOString();await writeFile(resolve(root,'browser-cleanup.json'),JSON.stringify(result,null,2));}
