param([Parameter(Mandatory=$true)][int]$DriverId)
$ErrorActionPreference = 'Stop'
$candidateRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\scratch\browser-first-candidate'))
$reportPath = Join-Path $candidateRoot "resources-$DriverId.jsonl"
$utf8 = New-Object System.Text.UTF8Encoding($false)
Write-Output "Resource monitor: driver $DriverId; output $reportPath"
while (Get-Process -Id $DriverId -ErrorAction SilentlyContinue) {
  $processes = Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' OR Name = 'msedge.exe'"
  $owned = @($processes | Where-Object { $_.ParentProcessId -eq $DriverId -and $_.CommandLine.Contains($candidateRoot) })
  $candidateIds = [Collections.Generic.HashSet[int]]::new()
  foreach ($process in $owned) { [void]$candidateIds.Add([int]$process.ProcessId) }
  do {
    $before = $candidateIds.Count
    foreach ($process in $processes) {
      if ($candidateIds.Contains([int]$process.ParentProcessId)) { [void]$candidateIds.Add([int]$process.ProcessId) }
    }
  } while ($candidateIds.Count -gt $before)
  $usage = @($candidateIds | ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue } |
    Select-Object Id, CPU, WorkingSet64, PrivateMemorySize64)
  $sample = @{timestamp=[DateTime]::UtcNow.ToString('o');driverId=$DriverId;processes=$usage}
  [IO.File]::AppendAllText($reportPath, (($sample | ConvertTo-Json -Depth 4 -Compress) + "`n"), $utf8)
  Start-Sleep -Seconds 10
}
