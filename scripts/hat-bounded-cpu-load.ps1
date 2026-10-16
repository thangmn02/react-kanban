param([Parameter(Mandatory=$true)][int]$BrowserPid,
      [Parameter(Mandatory=$true)][string]$ProfilePath,
      [int]$DurationMs=8000,[int]$BusyMs=70,[int]$PeriodMs=85)
$ErrorActionPreference='Stop'
if($DurationMs -gt 8000 -or $DurationMs -le 0 -or $BusyMs -ge $PeriodMs){throw 'Invalid bounded load'}
$taskInventory=Get-CimInstance Win32_Process
$taskRoot=$taskInventory | Where-Object { $_.ProcessId -eq $BrowserPid }
if(-not $taskRoot -or -not $taskRoot.CommandLine.Contains($ProfilePath)){throw 'Browser ownership proof failed'}
$taskOwned=[Collections.Generic.HashSet[int]]::new();[void]$taskOwned.Add($BrowserPid)
do{$taskBefore=$taskOwned.Count;foreach($taskProcess in $taskInventory){if($taskOwned.Contains([int]$taskProcess.ParentProcessId)){[void]$taskOwned.Add([int]$taskProcess.ProcessId)}}}while($taskOwned.Count -gt $taskBefore)
$taskSaved=@{};$taskRestoreFailures=@();$taskSelf=[Diagnostics.Process]::GetCurrentProcess();$taskSelfMask=$taskSelf.ProcessorAffinity
$taskAllowed=[long]$taskSelfMask;$taskMask=$taskAllowed -band (-$taskAllowed)
try{
 foreach($taskProcessId in $taskOwned){
  $taskProcess=[Diagnostics.Process]::GetProcessById($taskProcessId)
  if($taskProcess.HasExited){continue};$taskSaved[$taskProcessId]=$taskProcess.ProcessorAffinity
  $taskProcess.ProcessorAffinity=[IntPtr]$taskMask
 }
 $taskSelf.ProcessorAffinity=[IntPtr]$taskMask
 $taskStarted=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();$taskWatch=[Diagnostics.Stopwatch]::StartNew()
 while($taskWatch.ElapsedMilliseconds -lt $DurationMs){
  $taskCycle=$taskWatch.ElapsedMilliseconds
  while($taskWatch.ElapsedMilliseconds -lt [Math]::Min($DurationMs,$taskCycle+$BusyMs)){}
  $taskRest=[Math]::Min($DurationMs-$taskWatch.ElapsedMilliseconds,$PeriodMs-$BusyMs)
  if($taskRest -gt 0){[Threading.Thread]::Sleep([int]$taskRest)}
 }
}finally{
 foreach($taskProcessId in $taskSaved.Keys){
  try{$taskProcess=[Diagnostics.Process]::GetProcessById($taskProcessId)}catch [ArgumentException] {continue}
  try{
   if(-not $taskProcess.HasExited){$taskProcess.ProcessorAffinity=$taskSaved[$taskProcessId];$taskProcess.Refresh();if($taskProcess.ProcessorAffinity -ne $taskSaved[$taskProcessId]){throw 'Affinity restore mismatch'}}
  }catch{if(-not $taskProcess.HasExited){$taskRestoreFailures+=@{pid=$taskProcessId;error=$_.Exception.Message}}}
 }
 $taskSelf.ProcessorAffinity=$taskSelfMask
}
@{startedAt=$taskStarted;finishedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();durationMs=$DurationMs;
  mask=$taskMask;ownedBrowserPids=@($taskOwned);restored=($taskRestoreFailures.Count -eq 0);restoreFailures=$taskRestoreFailures;
  scope='Owned isolated browser constrained to one CPU plus bounded competitor'} | ConvertTo-Json -Compress
if($taskRestoreFailures.Count -gt 0){exit 1}
