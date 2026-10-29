/** Finalize the isolated browser handoff; never prints capabilities or reads browser/session credentials. */
import {readFile,realpath,rename,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateSignedAccess,hash,capabilityExpiry} from './storage-recovery.mjs';
const supplied=process.argv.find(x=>x.startsWith('--handoff='))?.slice(10);
let stage='input';try{
 if(!supplied)throw Error('A browser-created handoff is required.');const source=await realpath(supplied),root=await realpath(join(process.env.LOCALAPPDATA,'Kora/backups/production'));
 const relative=source.replaceAll('\\','/').slice(process.env.LOCALAPPDATA.replaceAll('\\','/').length);
 if(!/^\/Packages\/sandbox\.\{[a-f0-9-]+\}\/AC\/Temp\/kora-signed-object-access-\d+\.json$/i.test(relative))throw Error('Unexpected handoff path.');
 stage='read-and-validate';const report=JSON.parse(await readFile(join(root,'completion-owner-review-261029/owner-review.private.json'),'utf8')),access=JSON.parse(await readFile(source,'utf8'));
 capabilityExpiry(report.inventory,access);if(!access.expiresAt)throw Error('Bound earliest expiration is required.');validateSignedAccess(report.inventory,access);if(access.inventorySha256!==hash(JSON.stringify(report.inventory)))throw Error('Inventory binding failed.');
 stage='target';const target=join(root,'signed-object-access.json');let exists=false;try{await stat(target);exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}if(exists)throw Error('Capability file already exists.');
 const aclScript="$ErrorActionPreference='Stop';$identity=[Security.Principal.WindowsIdentity]::GetCurrent().User;$rootAcl=Get-Acl -LiteralPath $env:KORA_CAPABILITY_ROOT;if(-not $rootAcl.AreAccessRulesProtected){throw 'Private root inherits access'};foreach($rule in $rootAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -ne $identity.Value){throw 'Private root has another reader'}};$acl=[Security.AccessControl.FileSecurity]::new();$acl.SetOwner($identity);$acl.SetAccessRuleProtection($true,$false);$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','Allow'));Set-Acl -LiteralPath $env:KORA_CAPABILITY_HANDOFF -AclObject $acl";
 stage='acl';const secured=spawnSync('powershell.exe',['-NoProfile','-Command',aclScript],{env:{...process.env,KORA_CAPABILITY_ROOT:root,KORA_CAPABILITY_HANDOFF:source,PSModulePath:join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/Modules')},encoding:'utf8',timeout:15000});if(secured.status!==0)throw Error('Private handoff ACL failed.');
 stage='atomic-move';await rename(source,target);console.log(JSON.stringify({status:'READY',objects:report.inventory.length,signedPrivateObjects:report.inventory.filter(x=>!x.public).length,restrictedAccess:true,atomicWrite:true,credentialsPrinted:false}));
}catch(error){console.log(JSON.stringify({status:'BLOCKED',stage,osCode:/^[A-Z_]+$/.test(error.code||'')?error.code:null,reason:'Handoff validation or private-file finalization failed; values withheld.',credentialsPrinted:false}));process.exitCode=1;}
