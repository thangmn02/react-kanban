param([string]$Python = 'python', [string]$Uv = 'uv')
$ErrorActionPreference = 'Stop'
$beatRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $beatRoot
$beatFolder = Join-Path $beatRoot 'scratch/beat-grid-v2'
$beatFreeze = Join-Path $beatFolder 'environment-freeze.txt'
if (-not (Test-Path -LiteralPath $beatFreeze)) { throw 'Restore the private environment-freeze.txt receipt before setup; package versions must not be guessed.' }
$env:UV_CACHE_DIR = Join-Path $beatFolder 'uv-cache'
$beatVenv = Join-Path $beatFolder '.venv'
$beatInterpreter = Join-Path $beatVenv 'Scripts/python.exe'
if (-not (Test-Path -LiteralPath $beatInterpreter)) {
    & $Uv venv --python $Python $beatVenv
    if ($LASTEXITCODE -ne 0) { throw 'Isolated Python environment creation failed. Use the recorded Python3.12 interpreter.' }
}
& $Uv pip install --python $beatInterpreter 'torch==2.8.0+cpu' 'torchaudio==2.8.0+cpu' --index-url https://download.pytorch.org/whl/cpu
if ($LASTEXITCODE -ne 0) { throw 'Pinned CPU Torch installation failed.' }
$beatOtherRequirements = Join-Path $beatFolder 'requirements-excluding-torch.txt'
Get-Content -LiteralPath $beatFreeze | Where-Object { $_ -notmatch '^(torch|torchaudio)==' } | Set-Content -LiteralPath $beatOtherRequirements
& $Uv pip install --python $beatInterpreter --index-url https://pypi.org/simple -r $beatOtherRequirements
if ($LASTEXITCODE -ne 0) { throw 'Pinned evaluation dependencies failed to resolve; preserve the log instead of changing versions.' }
