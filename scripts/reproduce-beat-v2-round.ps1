param([switch]$VerifyOnly)
$ErrorActionPreference = 'Stop'
$beatRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $beatRoot
$beatPython = Join-Path $beatRoot 'scratch/beat-grid-v2/.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $beatPython)) { throw 'Restore the isolated environment using environment-freeze.txt and the acquisition checkpoint first.' }
$env:OMP_NUM_THREADS = '4'
$env:OPENBLAS_NUM_THREADS = '4'
$env:PYTHONDONTWRITEBYTECODE = '1'
function Invoke-BeatPython([string[]]$Arguments) {
    & $beatPython @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Evaluation command failed: $($Arguments -join ' ')" }
}
Invoke-BeatPython -Arguments @('scripts/freeze-beat-v2-round.py')
if (-not $VerifyOnly) {
    Invoke-BeatPython -Arguments @('scripts/separate-beat-v2-inputs.py')
    Invoke-BeatPython -Arguments @('scripts/measure-beat-v2-separator-overhead.py')
    foreach ($beatLane in @('BASE','C1','C2','C2-separated','C3','C4')) {
        Invoke-BeatPython -Arguments @('scripts/run-beat-v2-inference.py','--lane',$beatLane)
    }
}
Invoke-BeatPython -Arguments @('scripts/score-beat-v2-round.py')
Invoke-BeatPython -Arguments @('scripts/summarize-beat-v2-runtime.py')
Invoke-BeatPython -Arguments @('scripts/inspect-beat-v2-listening.py')
Invoke-BeatPython -Arguments @('scripts/beat-v2-inference.test.py')
Invoke-BeatPython -Arguments @('scripts/beat-v2-scoring.test.py')
Invoke-BeatPython -Arguments @('scripts/beat-v2-evidence.test.py')
