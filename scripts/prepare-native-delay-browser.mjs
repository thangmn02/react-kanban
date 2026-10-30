/** Own a separate browser/profile; never touch the user's Brave installation. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access,realpath} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const arg=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const root=arg('output');assert.match(root,/^scratch\/[a-z0-9/_-]+$/);await mkdir(root,{recursive:false});
const packageRoot=await realpath(arg('package'));assert.ok(packageRoot.startsWith(await realpath('scratch')+sep));
const extension=resolve(packageRoot,'extension'),manifest=JSON.parse(await readFile(resolve(extension,'manifest.json'),'utf8'));
assert.equal(manifest.version,'0.3.28');assert.match(manifest.name,/Native Tab Delay \(UNQUALIFIED\)/);
const provenance=JSON.parse(await readFile(resolve(extension,'NATIVE-DELAY-PROVENANCE.json'),'utf8'));assert.equal(provenance.modelChanged,false);
for(const file of provenance.files){assert.ok(['beat-sync.js','beat-mode.js','widget-bridge.js'].includes(file.name));assert.equal(createHash('sha256').update(await readFile(resolve(extension,file.name))).digest('hex'),file.outputSha256);}
let context,timer;const result={at:new Date().toISOString(),pid:process.pid,command:process.argv,worktree:process.cwd(),profile:resolve(root,'profile'),personalProfileUsed:false,extensionChanged:false};
try{
  context=await chromium.launchPersistentContext(result.profile,{channel:'chrome',headless:false,ignoreDefaultArgs:['--disable-extensions','--mute-audio'],args:['--enable-unsafe-extension-debugging','--no-first-run']});
  const cdp=await context.browser().newBrowserCDPSession();const loaded=await cdp.send('Extensions.loadUnpacked',{path:extension});
  result.extensionId=loaded.id;result.browser=(await cdp.send('Browser.getVersion')).product;result.ownedProcesses=(await cdp.send('SystemInfo.getProcessInfo')).processInfo.map(process=>process.id);
  const setup=await context.newPage();await setup.goto(`chrome-extension://${loaded.id}/setup.html`);result.companionVersion=await setup.evaluate(()=>chrome.runtime.getManifest().version);assert.equal(result.companionVersion,'0.3.28');
  await setup.evaluate(()=>chrome.storage.local.set({beatTelemetryEnabled:true}));
  const source=await context.newPage();await source.goto('https://www.youtube.com/');await source.bringToFront();
  await writeFile(resolve(root,'browser-process.json'),JSON.stringify(result,null,2));
  console.log('Dedicated test browser ready: private Companion 0.3.28. Choose your real song here; Brave research remains unchanged.');
  await new Promise(done=>{process.once('SIGINT',done);process.once('SIGTERM',done);context.once('close',done);timer=setInterval(()=>{void access(resolve(root,'stop-browser')).then(done,()=>{});},500);});
}finally{clearInterval(timer);await context?.close();result.closedAt=new Date().toISOString();await writeFile(resolve(root,'browser-cleanup.json'),JSON.stringify(result,null,2));}
