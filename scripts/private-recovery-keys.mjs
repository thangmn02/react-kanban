/** Local random recovery key, protected with this Windows account; never an application credential. */
import {readFile,writeFile,realpath,rename,unlink} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
export function protectedBytes(bytes,mode,{maxBytes=1024*1024}={}){
 const method=mode==='protect'?'Protect':'Unprotect';
 const result=spawnSync('powershell.exe',['-NoProfile','-Command',`$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Security;$s=[IO.MemoryStream]::new();[Console]::OpenStandardInput().CopyTo($s);$b=[Security.Cryptography.ProtectedData]::${method}($s.ToArray(),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::OpenStandardOutput().Write($b,0,$b.Length)`],{env:{...process.env,PSModulePath:join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/Modules')},input:bytes,maxBuffer:maxBytes,timeout:15000});
 if(result.status!==0)throw Error('Local recovery-key protection failed; diagnostics withheld.');return result.stdout;
}
export function secureRecoveryPath(path,{directoryOnly=false}={}){
 const script="$ErrorActionPreference='Stop';$id=[Security.Principal.WindowsIdentity]::GetCurrent().User;$dir=Get-Acl -LiteralPath $env:KORA_RECOVERY_DIRECTORY;if(-not $dir.AreAccessRulesProtected){throw 'Unprotected parent'};foreach($rule in $dir.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -ne $id.Value){throw 'Another parent reader'}};if($env:KORA_RECOVERY_FILE){$checked=Get-Acl -LiteralPath $env:KORA_RECOVERY_FILE;if(-not $checked.AreAccessRulesProtected){& icacls.exe $env:KORA_RECOVERY_FILE /inheritance:r /grant:r ('*'+$id.Value+':(F)') | Out-Null;if($LASTEXITCODE -ne 0){throw 'Private DACL failed'};$checked=Get-Acl -LiteralPath $env:KORA_RECOVERY_FILE};if(-not $checked.AreAccessRulesProtected){throw 'Unprotected file'};foreach($rule in $checked.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -ne $id.Value){throw 'Another file reader'}}}";
 const result=spawnSync('powershell.exe',['-NoProfile','-Command',script],{env:{...process.env,PSModulePath:join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/Modules'),KORA_RECOVERY_DIRECTORY:directoryOnly?path:dirname(path),KORA_RECOVERY_FILE:directoryOnly?'':path},encoding:'utf8',timeout:15000});
 if(result.status!==0)throw Error('Private recovery access verification failed; details withheld.');
}
export async function writePrivateRecoveryFile(path,bytes){
 secureRecoveryPath(dirname(path),{directoryOnly:true});const temporary=path+'.'+randomUUID()+'.tmp';
 try{await writeFile(temporary,bytes,{flag:'wx',mode:0o600});secureRecoveryPath(temporary);await rename(temporary,path);secureRecoveryPath(path);}
 finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}
export async function localRecoveryPassphrase(){
 const directory=await realpath(join(process.env.LOCALAPPDATA,'Kora/secrets')),file=join(directory,'storage-recovery-key.dpapi');
 let encrypted;try{encrypted=await readFile(file);}catch(error){
  if(error.code!=='ENOENT')throw Error('Recovery-key source is unavailable; details withheld.');
  const key=randomBytes(32);try{encrypted=protectedBytes(key,'protect');await writePrivateRecoveryFile(file,encrypted);}finally{key.fill(0);}
 }
 secureRecoveryPath(file);const key=protectedBytes(encrypted,'unprotect');try{if(key.length!==32)throw Error('Invalid local recovery key.');return key.toString('base64');}finally{key.fill(0);}
}
