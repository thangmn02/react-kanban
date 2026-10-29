/** Prepare private review/recovery from an existing archive; optional narrow signed GETs only. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,realpath,unlink,rmdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {localRecoveryPassphrase} from './private-recovery-keys.mjs';
import {withProductionClone,assertContained} from './production-clone.mjs';
import {auditTaskConsistency} from '../src/features/task/model/task-workflow.ts';
import {downloadSignedObjects,capabilityExpiry,verifyStorageBundle,sealPortable,openPortable,hash} from './storage-recovery.mjs';
const arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
assert.ok(arg('manifest')&&arg('output'),'Supply a verified private --manifest and a new private --output directory.');
const root=await realpath(join(process.env.LOCALAPPDATA,'Kora/backups/production')),output=resolve(arg('output'));
assertContained(root,output);await mkdir(output,{recursive:false});assertContained(root,await realpath(output));
async function containedArchive(path){const actual=await realpath(path);assertContained(root,actual);return actual;}
async function loadPreparedReview(){
 const path=await realpath(arg('review'));assertContained(root,path);const prepared=JSON.parse(await readFile(path,'utf8'));
 const manifestPath=await realpath(arg('manifest'));assertContained(root,manifestPath);const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 assert.ok(manifest.authorizedProject==='lthlvntvjgnornrdxnms'&&manifest.restoreVerified===true&&manifest.hostedWrites===false,'Prepared inventory requires the verified read-only backup.');
 assert.ok(prepared.projectRef===manifest.authorizedProject&&prepared.backupSha256===manifest.sha256&&prepared.productionConnected===false,'Prepared review must bind the exact restored database snapshot.');
 assert.ok(hash(await readFile(await containedArchive(manifest.archive)))===manifest.encryptedArchiveSha256,'The existing encrypted database archive changed.');
 assert.ok(prepared.inventory.length===31,'Exact owner-authorized inventory is required.');return prepared;
}
const snapshot=arg('review')?await loadPreparedReview():await withProductionClone({manifestFile:arg('manifest'),output:join(output,'clone')},async({sql,manifest})=>{
 const inventory=JSON.parse(sql("select coalesce(jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'name',o.name,'metadata',o.metadata,'public',b.public,'objectId',o.id,'updatedAt',o.updated_at,'ownerId',o.owner_id) order by o.bucket_id,o.name),'[]') from storage.objects o join storage.buckets b on b.id=o.bucket_id"));
 const taskSnapshot=JSON.parse(sql("select jsonb_build_object('lists',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from public.lists t),'tasks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from public.tasks t))"));
 const audit=auditTaskConsistency(taskSnapshot.lists,taskSnapshot.tasks);
 const affected=[...new Set(audit.anomalies.map(row=>row.taskId))].map(id=>{
  const before=taskSnapshot.tasks.find(row=>row.id===id),lists=taskSnapshot.lists.filter(row=>row.board_id===before.board_id);
  const siblings=taskSnapshot.tasks.filter(row=>lists.some(list=>list.id===row.list_id)).map(row=>({id:row.id,list_id:row.list_id,position:row.position,updated_at:row.updated_at}));
  return {taskId:id,before,findings:audit.anomalies.filter(row=>row.taskId===id).map(row=>({type:row.type,proposal:row.proposed})),allowedOwnerDecisions:['retain current state with unknown historical time','confirm completed and provide actual historical timestamp','confirm active and reopen','confirm completed list placement while retaining unknown timestamp'],cas:{taskAllOriginalColumns:before,listBeforeImages:lists,orderedSiblingBeforeImages:siblings,sha256:hash(JSON.stringify({before,lists,siblings}))},execution:'No repair SQL is executed. Re-read and lock task/list/sibling versions after an explicit owner decision; abort any mismatch.'};
 });
 const references=JSON.parse(sql("select coalesce(jsonb_agg(jsonb_build_object('profileId',id,'avatar',avatar_url) order by id),'[]') from public.profiles where avatar_url is not null"));
 const policies=JSON.parse(sql("select coalesce(jsonb_agg(jsonb_build_object('name',policyname,'roles',roles,'command',cmd,'using',qual,'check',with_check) order by policyname),'[]') from pg_policies where schemaname='storage' and tablename='objects'"));
 const report={at:new Date().toISOString(),backupAt:manifest.at,backupSha256:manifest.sha256,projectRef:manifest.authorizedProject,productionConnected:false,inventory,profileReferences:references,storagePolicies:policies,historicalReview:{taskCount:taskSnapshot.tasks.length,findings:audit.anomalies.length,affected,decisionRequired:true,repairsExecuted:false}};
 await writeFile(join(output,'owner-review.private.json'),JSON.stringify(report,null,2));return report;
});
if(!arg('access-file')){
 console.log(JSON.stringify({status:'PREPARED',hostedConnections:false,objectCount:snapshot.inventory.length,historicalTaskCount:snapshot.historicalReview.affected.length,findings:snapshot.historicalReview.findings,requiredAuthorization:'Object-scoped time-limited signed download URLs for the exact inventory. Image backend key is not accepted.',privateReview:join(output,'owner-review.private.json')}));
}else{
 assert.ok(process.argv.includes('--authorized-signed-object-backup'),'Separate explicit object-backup authorization is required.');
 const accessPath=await realpath(arg('access-file'));assertContained(root,accessPath);assert.equal(accessPath,join(root,'signed-object-access.json'),'Only the exact temporary capability file is accepted.');const accessBytes=await readFile(accessPath),access=JSON.parse(accessBytes);let result;try{
 capabilityExpiry(snapshot.inventory,access);assert.equal(access.inventorySha256,hash(JSON.stringify(snapshot.inventory)),'Signed access must bind the exact backup inventory.');
 const passphrase=await localRecoveryPassphrase();
 const bundle=await downloadSignedObjects(snapshot.inventory,access),plain=Buffer.from(JSON.stringify(bundle)),archive=await sealPortable(plain,passphrase);
 const archiveFile=join(output,'storage.kora-backup');await writeFile(archiveFile,archive,{flag:'wx'});
 const reopened=await openPortable(await readFile(archiveFile),passphrase);assert.equal(hash(reopened),hash(plain));verifyStorageBundle(JSON.parse(reopened));
 // Restore through ordinal filenames, never untrusted object paths. Provider restore remains a separate gate.
 const restored=join(output,'isolated-object-files');await mkdir(restored,{recursive:false});for(let i=0;i<bundle.assets.length;i++){const asset=bundle.assets[i],target=join(restored,String(i)+'.bin');await writeFile(target,Buffer.from(asset.data,'base64'),{flag:'wx'});assert.equal(hash(await readFile(target)),asset.sha256);await unlink(target);}await rmdir(restored);
 result={at:new Date().toISOString(),status:'PARTIAL',hostedWrites:false,objectCount:bundle.assets.length,exactBytesRestored:true,snapshotContentChecksumsVerified:true,plaintextRestoreFilesRetained:false,archiveSha256:hash(archive),inventorySha256:bundle.inventorySha256,capabilitiesPersisted:false,providerStorageApiRestored:false,offDeviceCopyVerified:false,remaining:'Copy only the encrypted archive to an owner-approved off-device destination; keep recovery passphrase separately. Verify independent decrypt and a separately authorized isolated Storage API restore with RLS/reference checks.'};
 }finally{
  const current=await readFile(accessPath).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  if(current){assert.ok(hash(current)===hash(accessBytes),'Capability file changed; refusing to remove a different file.');await unlink(accessPath);}
  if(result){result.temporaryCapabilitiesRemoved=true;await writeFile(join(output,'storage-recovery.json'),JSON.stringify(result,null,2));}
 }
 console.log(JSON.stringify(result));
}
