/** Run through Codex's supported in-app browser after the owner signs in. No hidden API/session access. */
import {validateSignedAccess,hash,capabilityExpiry} from './storage-recovery.mjs';
import {open,rename,unlink,realpath,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const projectRef='lthlvntvjgnornrdxnms',dashboard='https://supabase.com/dashboard/project/'+projectRef;
export async function collectDashboardCapabilities(tab,inventory,objects,{limit=5}={}){
 if(inventory.length!==31||new Set(inventory.map(x=>x.bucket+'/'+x.name)).size!==31)throw Error('Exact 31-object inventory is required.');
 let completed=0;
 for(const row of inventory){
  if(objects.some(item=>item.bucket===row.bucket&&item.name===row.name))continue;if(completed>=limit)break;
  const current=new URL(await tab.url());if(current.origin!=='https://supabase.com'||!current.pathname.startsWith('/dashboard/project/'+projectRef+'/storage/files'))throw Error('Authorized project Storage page is required.');
  const parent=row.name.split('/').slice(0,-1).join('/'),filename=row.name.split('/').at(-1);
  // This exact bucket/path route was observed through the dashboard Navigate form.
  // Each destination is an inventoried folder, not a guessed resource or hidden API.
  if(!current.pathname.endsWith('/buckets/'+row.bucket)||current.searchParams.get('path')!==parent){
   await tab.goto(dashboard+'/storage/files/buckets/'+encodeURIComponent(row.bucket)+'?path='+encodeURIComponent(parent));await tab.ax.get();
  }
  const action=tab.playwright.getByRole('button',{name:filename+' actions',exact:true});await action.waitFor({state:'visible',timeoutMs:15000});
  await action.click();await tab.ax.get();
  await tab.playwright.getByText('Get URL',{exact:true}).click();await tab.ax.get();
  if(row.public===true){
   const candidate={bucket:row.bucket,name:row.name,url:await tab.clipboard.readText()};validateSignedAccess([row],{projectRef,objects:[candidate]});objects.push(candidate);await tab.clipboard.writeText('');completed++;continue;
  }
  await tab.playwright.getByText('Custom expiry',{exact:true}).click();await tab.ax.get();
  if(!(await tab.playwright.getByRole('combobox').innerText()).includes('days'))throw Error('Unexpected expiry units; no capability was requested.');
  await tab.playwright.getByRole('spinbutton',{name:'Duration',exact:true}).fill('0.020833333333333332');
  await tab.playwright.getByRole('button',{name:'Get signed URL',exact:true}).click();
  await tab.playwright.getByRole('heading',{name:'Custom expiry for signed URL',exact:true}).waitFor({state:'hidden',timeoutMs:30000});
  const url=await tab.clipboard.readText(),candidate={bucket:row.bucket,name:row.name,url};
  validateSignedAccess([row],{projectRef,objects:[candidate]});
  const parsed=new URL(url),claims=JSON.parse(Buffer.from(parsed.searchParams.get('token').split('.')[1],'base64url'));
  if(claims.exp-claims.iat!==1800)throw Error('Dashboard did not issue the requested 30-minute lifetime.');
  objects.push(candidate);await tab.clipboard.writeText('');completed++;
 }
 return {completedThisBatch:completed,collected:objects.length,total:inventory.length,credentialsPrinted:false};
}
/** Write only into the browser sandbox; the owner-side finalizer establishes private ACLs. */
export async function saveDashboardCapabilities(inventory,objects,sandboxTemporaryDirectory){
 validateSignedAccess(inventory,{projectRef,objects});const directory=await realpath(sandboxTemporaryDirectory);
 if(!/\/Packages\/sandbox\.\{[a-f0-9-]+\}\/AC\/Temp$/i.test(directory.replaceAll('\\','/')))throw Error('Exact browser sandbox temporary directory is required.');
 const target=join(directory,'kora-signed-object-access-'+Date.now()+'.json');try{await stat(target);throw Error('Handoff already exists.');}catch(error){if(error.code!=='ENOENT')throw error;}
 const expiresAt=capabilityExpiry(inventory,{projectRef,objects});
 const payload={expiresAt,version:1,projectRef,createdAt:new Date().toISOString(),expiresInSeconds:1800,inventorySha256:hash(JSON.stringify(inventory)),objects};
 const temporary=join(directory,'.signed-object-access-'+randomUUID()+'.tmp');let file;
 try{file=await open(temporary,'wx',0o600);await file.writeFile(JSON.stringify(payload));await file.sync();await file.close();file=undefined;await rename(temporary,target);}
 finally{await file?.close();await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
 return {status:'HANDOFF_READY',handoff:target,objects:objects.length,atomicWrite:true,expiresInSeconds:1800,credentialsPrinted:false};
}
