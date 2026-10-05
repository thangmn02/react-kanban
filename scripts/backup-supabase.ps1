param(
  [Parameter(Mandatory)][string]$BackupRoot,
  [Parameter(Mandatory)][string]$PostgresBin,
  [Parameter(Mandatory)][string]$ProjectRef,
  [int]$RestorePort = 54329,
  [string]$ExistingBackup
)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$backupBase = [IO.Path]::GetFullPath($BackupRoot)
if ($backupBase.TrimEnd('\') -eq $repoRoot.TrimEnd('\') -or $backupBase.StartsWith($repoRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Backups must be outside the repository.'
}
if ($ProjectRef -notmatch '^[a-z]{20}$' -or (Get-Content -LiteralPath (Join-Path $repoRoot 'supabase/.temp/project-ref') -Raw).Trim() -ne $ProjectRef) {
  throw 'The requested project must match the linked project.'
}
if (Get-NetTCPConnection -State Listen -LocalPort $RestorePort -ErrorAction SilentlyContinue) { throw 'The restore-test port is already in use.' }
foreach ($tool in @('pg_dump','pg_dumpall','pg_restore','psql','initdb','pg_ctl')) {
  if (-not (Test-Path -LiteralPath (Join-Path $PostgresBin "$tool.exe"))) { throw "Missing tool: $tool" }
}

function Invoke-PgTool([string]$Name, [string[]]$Arguments, [hashtable]$Connection = @{}) {
  $start = [Diagnostics.ProcessStartInfo]::new((Join-Path $PostgresBin "$Name.exe"))
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  # pg_ctl starts a daemon that can inherit redirected pipes. Waiting for
  # those pipes to close would wait for the database itself to stop.
  $start.RedirectStandardOutput = $Name -ne 'pg_ctl'
  $start.RedirectStandardError = $Name -ne 'pg_ctl'
  foreach ($argument in $Arguments) { $start.ArgumentList.Add($argument) }
  foreach ($key in @($start.Environment.Keys | Where-Object { $_ -like 'PG*' })) { $start.Environment.Remove($key) | Out-Null }
  foreach ($key in $Connection.Keys) { $start.Environment[$key] = $Connection[$key] }
  $process = [Diagnostics.Process]::Start($start)
  if ($Name -eq 'pg_ctl') {
    if (-not $process.WaitForExit(60000)) { $process.Kill($true); throw 'pg_ctl exceeded its timeout.' }
    if ($process.ExitCode -ne 0) { throw "pg_ctl failed with exit code $($process.ExitCode)." }
    return ''
  }
  $stdout = $process.StandardOutput.ReadToEndAsync()
  $stderr = $process.StandardError.ReadToEndAsync()
  if (-not $process.WaitForExit(180000)) { $process.Kill($true); throw "$Name exceeded its timeout." }
  $output = $stdout.GetAwaiter().GetResult()
  $errorText = $stderr.GetAwaiter().GetResult()
  if ($process.ExitCode -ne 0) {
    # Provider diagnostics may include private identifiers. Keep them in the
    # encrypted backup directory rather than console output.
    Protect-FileBytes ([Text.Encoding]::UTF8.GetBytes($errorText)) "$Name-error.txt.dpapi"
    throw "$Name failed with exit code $($process.ExitCode); encrypted diagnostics were retained."
  }
  return $output
}
function Protect-FileBytes([byte[]]$Bytes, [string]$Name) {
  $encrypted = [Security.Cryptography.ProtectedData]::Protect($Bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  [IO.File]::WriteAllBytes((Join-Path $backupPath $Name), $encrypted)
}
function Read-Counts([hashtable]$Connection) {
  $result = Invoke-PgTool 'psql' @('--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align','--set=ON_ERROR_STOP=1','--command',"set role postgres; $countsSql") $Connection
  return $result.Trim()
}

$stamp = [TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, [TimeZoneInfo]::FindSystemTimeZoneById('SE Asia Standard Time')).ToString('yyyy-MM-dd-HHmmss')
$backupPath = Join-Path $backupBase "$stamp-$ProjectRef"
if ($ExistingBackup) {
  $backupPath = [IO.Path]::GetFullPath($ExistingBackup)
  if (-not $backupPath.StartsWith($backupBase.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -or -not $backupPath.EndsWith("-$ProjectRef")) {
    throw 'The existing backup must be under the requested backup root and match the project.'
  }
}
[IO.Directory]::CreateDirectory($backupPath) | Out-Null
# Protect temporary plaintext exports and the restore-test database as well.
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = [Security.AccessControl.DirectorySecurity]::new()
$acl.SetOwner($identity)
$acl.SetAccessRuleProtection($true, $false)
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
if ($ExistingBackup) {
  $existingAcl = Get-Acl -LiteralPath $backupPath
  if (-not $existingAcl.AreAccessRulesProtected -or $existingAcl.GetOwner([Security.Principal.SecurityIdentifier]) -ne $identity) {
    throw 'The existing backup directory must be private and owned by the current user.'
  }
  if (@($existingAcl.Access | Where-Object { $_.AccessControlType -eq 'Allow' -and $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]) -ne $identity }).Count) {
    throw 'The existing backup directory grants access to another identity.'
  }
} else {
  Set-Acl -LiteralPath $backupPath -AclObject $acl
}
$workPath = Join-Path $backupPath '.work'
if (Test-Path -LiteralPath $workPath) { throw 'Backup staging already exists; reconcile the prior attempt before retrying.' }
[IO.Directory]::CreateDirectory($workPath) | Out-Null
$serverStarted = $false
$verified = $false
try {
  $archive = Join-Path $workPath 'database.dump'
  if (-not $ExistingBackup) {
  Push-Location $repoRoot
  try {
    # Use the CLI's short-lived login credentials without revealing them or
    # evaluating the generated shell script. No database password is requested.
    $dumpPlan = & pnpm exec supabase db dump --linked --dry-run 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'Supabase could not prepare a dump connection.' }
  } finally { Pop-Location }
  $remote = @{}
  foreach ($line in $dumpPlan) {
    if ("$line" -match '^export (PGHOST|PGPORT|PGUSER|PGPASSWORD|PGDATABASE)=(.*)$') {
      $value = $Matches[2].Trim()
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) { $value = $value.Substring(1,$value.Length-2) }
      if ($value.Contains("`n") -or $value.Contains("`r")) { throw 'Invalid connection metadata.' }
      $remote[$Matches[1]] = $value
    }
  }
  foreach ($key in @('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE')) { if (-not $remote[$key]) { throw "Missing connection field: $key" } }
  $remote.PGSSLMODE = 'require'
  $remote.PGCONNECT_TIMEOUT = '20'
  $remote.PGAPPNAME = 'KoraBackup'
  $psqlArgs = @('--no-psqlrc','--no-password','--tuples-only','--no-align','--set=ON_ERROR_STOP=1')
  $countBuilder = @'
select string_agg(format('select %L as schema_name, %L as table_name, count(*)::bigint as row_count from %I.%I', schemaname, tablename, schemaname, tablename), ' union all ' order by schemaname, tablename)
from pg_tables where schemaname in ('public','app_private','auth','storage','supabase_migrations');
'@
  $countUnion = (Invoke-PgTool 'psql' ($psqlArgs + @('--command',$countBuilder)) $remote).Trim()
  if (-not $countUnion.StartsWith('select ')) { throw 'No application tables were found.' }
  $countsSql = "select jsonb_agg(t order by schema_name,table_name) from ($countUnion) t;"
  $beforeCounts = Read-Counts $remote
  Invoke-PgTool 'pg_dump' @('--no-password','--format=custom','--quote-all-identifiers','--role=postgres','--file',$archive) $remote | Out-Null
  Invoke-PgTool 'pg_dumpall' @('--no-password','--roles-only','--no-role-passwords','--role=postgres','--file',(Join-Path $workPath 'roles.sql')) $remote | Out-Null
  if ((Read-Counts $remote) -ne $beforeCounts) { throw 'Rows changed during backup; retry before accepting this backup.' }
  $remote.Clear()
  foreach ($part in @('schema','data')) {
    Invoke-PgTool 'pg_restore' @("--$part-only",'--file',(Join-Path $workPath "$part.sql"),$archive) | Out-Null
  }
  $catalog = Invoke-PgTool 'pg_restore' @('--list',$archive)
  if (-not $catalog.Contains('TABLE DATA')) { throw 'The archive contains no table data entries.' }

  # Retain encrypted exports before testing recovery. A failed drill must not
  # discard the only downloaded copy.
  foreach ($name in @('database.dump','schema.sql','data.sql','roles.sql')) {
    Protect-FileBytes ([IO.File]::ReadAllBytes((Join-Path $workPath $name))) "$name.dpapi"
  }
  Protect-FileBytes ([Text.Encoding]::UTF8.GetBytes($catalog)) 'archive-list.txt.dpapi'
  Protect-FileBytes ([Text.Encoding]::UTF8.GetBytes($beforeCounts)) 'source-table-counts.json.dpapi'
  } else {
    $beforeCounts = [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $backupPath 'source-table-counts.json.dpapi')), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser))
    $counts = $beforeCounts | ConvertFrom-Json
    $countUnion = ($counts | ForEach-Object {
      $schemaIdent = '"' + $_.schema_name.Replace('"','""') + '"'
      $tableIdent = '"' + $_.table_name.Replace('"','""') + '"'
      $schemaLiteral = "'" + $_.schema_name.Replace("'","''") + "'"
      $tableLiteral = "'" + $_.table_name.Replace("'","''") + "'"
      "select $schemaLiteral as schema_name, $tableLiteral as table_name, count(*)::bigint as row_count from $schemaIdent.$tableIdent"
    }) -join ' union all '
    $countsSql = "select jsonb_agg(t order by schema_name,table_name) from ($countUnion) t;"
  }
  # The drill restores the encrypted artifacts, verifying decryption as well
  # as archive integrity. Original files are not used as a substitute.
  foreach ($name in @('database.dump','schema.sql','data.sql','roles.sql')) {
    $plainBytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $backupPath "$name.dpapi")), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllBytes((Join-Path $workPath $name), $plainBytes)
  }
  $psqlArgs = @('--no-psqlrc','--no-password','--tuples-only','--no-align','--set=ON_ERROR_STOP=1')

  $localPassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
  $passwordFile = Join-Path $workPath 'restore-password.txt'
  [IO.File]::WriteAllText($passwordFile,$localPassword)
  $dataDir = Join-Path $workPath 'restore-db'
  Invoke-PgTool 'initdb' @('--pgdata',$dataDir,'--username=postgres','--auth=scram-sha-256','--encoding=UTF8','--locale=C','--pwfile',$passwordFile) | Out-Null
  $serverStarted = $true
  Invoke-PgTool 'pg_ctl' @('--pgdata',$dataDir,'--log',(Join-Path $workPath 'server.log'),'--options',"-h 127.0.0.1 -p $RestorePort",'--wait','start') | Out-Null
  $local = @{PGHOST='127.0.0.1';PGPORT="$RestorePort";PGUSER='postgres';PGPASSWORD=$localPassword;PGDATABASE='postgres';PGCONNECT_TIMEOUT='10'}
  # Keep the drill's local administrator and use it as membership grantor.
  # Original role definitions/grantors remain intact in the encrypted export.
  $roles = [IO.File]::ReadAllLines((Join-Path $workPath 'roles.sql')) | Where-Object { $_ -notmatch '^(CREATE|ALTER) ROLE "?postgres"?( |;)' } | ForEach-Object { $_ -replace '\s+GRANTED BY ("[^"]+"|[a-z_][a-z0-9_]*)\s*;\s*$',';' }
  [IO.File]::WriteAllLines((Join-Path $workPath 'restore-roles.sql'),$roles)
  Invoke-PgTool 'psql' ($psqlArgs + @('--file',(Join-Path $workPath 'restore-roles.sql'))) $local | Out-Null
  Invoke-PgTool 'psql' ($psqlArgs + @('--command','create schema extensions; create schema auth; create schema app_private; create schema storage; create schema supabase_migrations; create extension pgcrypto with schema extensions; create extension "uuid-ossp" with schema extensions;')) $local | Out-Null
  $catalog = Invoke-PgTool 'pg_restore' @('--list',$archive)
  $publications = [regex]::Matches($catalog, '(?m)^\d+;\s+\d+\s+\d+\s+PUBLICATION\s+-\s+([a-z_][a-z0-9_]*)\s')
  foreach ($publication in $publications) {
    Invoke-PgTool 'psql' ($psqlArgs + @('--command',('create publication "' + $publication.Groups[1].Value + '";'))) $local | Out-Null
  }
  $schemas = @('--schema=public','--schema=app_private','--schema=auth','--schema=storage','--schema=supabase_migrations')
  Invoke-PgTool 'pg_restore' ($schemas + @('--schema-only','--file',(Join-Path $workPath 'restore-schema.sql'),$archive)) | Out-Null
  Invoke-PgTool 'psql' ($psqlArgs + @('--file',(Join-Path $workPath 'restore-schema.sql'))) $local | Out-Null
  Invoke-PgTool 'pg_restore' ($schemas + @('--data-only','--disable-triggers','--file',(Join-Path $workPath 'restore-data.sql'),$archive)) | Out-Null
  Invoke-PgTool 'psql' ($psqlArgs + @('--file',(Join-Path $workPath 'restore-data.sql'))) $local | Out-Null
  if ((Read-Counts $local) -ne $beforeCounts) { throw 'Restored table counts do not match the hosted source.' }
  Protect-FileBytes ([Text.Encoding]::UTF8.GetBytes($beforeCounts)) 'verified-table-counts.json.dpapi'
  $verified = $true
  $manifest = [ordered]@{
    project_ref=$ProjectRef; created_at_utc=(Get-Item -LiteralPath (Join-Path $backupPath 'database.dump.dpapi')).CreationTimeUtc.ToString('o');
    verified_at_utc=[DateTime]::UtcNow.ToString('o'); encryption='Windows DPAPI CurrentUser';
    archive_scope='Full pg_dump database archive; roles exclude passwords';
    restored_schemas=@('public','app_private','auth','storage','supabase_migrations');
    restore_table_count=@($beforeCounts | ConvertFrom-Json).Count;
    restore_verified=$true; platform_extension_restore_verified=$false; storage_object_files_included=$false;
    files=@(Get-ChildItem -LiteralPath $backupPath -File -Filter '*.dpapi' | ForEach-Object { @{name=$_.Name;bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash} })
  }
  [IO.File]::WriteAllText((Join-Path $backupPath 'manifest.json'),($manifest | ConvertTo-Json -Depth 6))
  [IO.File]::WriteAllText((Join-Path $backupPath 'RECOVERY.txt'),@'
Encrypted full PostgreSQL custom archive plus schema, data and role exports.
Files use Windows DPAPI CurrentUser: decrypt with the same Windows account/profile on this computer.
Back up your Windows recovery credentials before treating a copied encrypted file as off-device disaster recovery.
PowerShell decryption: [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($encryptedPath), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
Write decrypted bytes to a private temporary directory. Inspect with pg_restore --list. Restore only to a separately approved destination.
Application/auth/storage-metadata schemas were actually restored locally and row counts matched the hosted source. Supabase platform-specific extensions were not restored locally.
Storage object files are not included in any PostgreSQL database dump. Obtain them separately if needed.
Role exports exclude passwords. Supabase secrets/environment configuration are not database backup contents.
'@)
  [pscustomobject]@{backup_path=$backupPath;restore_verified=$verified;tables_verified=$manifest.restore_table_count;encrypted_files=$manifest.files.Count} | ConvertTo-Json
} finally {
  if ($serverStarted -and (Test-Path -LiteralPath (Join-Path $workPath 'restore-db/postmaster.pid'))) {
    Invoke-PgTool 'pg_ctl' @('--pgdata',(Join-Path $workPath 'restore-db'),'--mode=fast','--wait','stop') | Out-Null
  }
  # Delete only this script's private staging directory after verifying it is
  # inside the exact backup folder. Encrypted exports are always retained.
  $resolvedWork = [IO.Path]::GetFullPath($workPath)
  if ($resolvedWork.StartsWith([IO.Path]::GetFullPath($backupPath).TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $resolvedWork -Recurse -Force
  }
}
