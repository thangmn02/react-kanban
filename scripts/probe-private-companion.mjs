import {chromium} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const root=process.cwd(),results=[];
for(const channel of ['chrome','msedge']) {
  let context;
  try {
    const profile=resolve(root,'scratch/browser-first-candidate',`probe-${channel}`);
    context=await chromium.launchPersistentContext(profile,{channel,headless:true,ignoreDefaultArgs:['--disable-extensions'],
      args:['--enable-unsafe-extension-debugging','--no-first-run']});
    const cdp=await context.browser().newBrowserCDPSession();
    const version=await cdp.send('Browser.getVersion');
    for(const extension of (await cdp.send('Extensions.getExtensions')).extensions)
      if(extension.path===resolve(root,'scratch/browser-first-candidate/extension'))await cdp.send('Extensions.uninstall',{id:extension.id});
    const loaded=await cdp.send('Extensions.loadUnpacked',{path:resolve(root,'scratch/browser-first-candidate/extension')});
    const page=await context.newPage();
    await page.goto(`chrome-extension://${loaded.id}/setup.html`);
    const manifest=await page.evaluate(()=>({id:chrome.runtime.id,manifest:chrome.runtime.getManifest()}));
    const extensions=await cdp.send('Extensions.getExtensions');
    results.push({channel,version:version.product,id:loaded.id,manifest,extensions});
  }catch(error){results.push({channel,error:error.message});}
  finally{await context?.close();}
}
await mkdir(resolve(root,'scratch/browser-first-candidate'),{recursive:true});
await writeFile(resolve(root,'scratch/browser-first-candidate/browser-probe.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results));
