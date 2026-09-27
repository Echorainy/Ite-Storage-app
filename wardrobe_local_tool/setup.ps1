$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$Venv = Join-Path $Project '.venv'
$Python = Join-Path $Venv 'Scripts\python.exe'
if (-not (Test-Path -LiteralPath $Python)) {
    $made = $false
    foreach ($v in @('3.11','3.12','3.13','3.14')) {
        if (Get-Command py -ErrorAction SilentlyContinue) {
            & py ('-' + $v) -m venv $Venv 2>$null
            if ($LASTEXITCODE -eq 0) { $made = $true; break }
            if (Test-Path -LiteralPath $Venv) { Remove-Item -LiteralPath $Venv -Recurse -Force }
        }
    }
    if (-not $made -and (Get-Command python -ErrorAction SilentlyContinue)) {
        $version = & python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
        $parts = $version.Trim().Split('.')
        if ($parts.Length -ge 2 -and [int]$parts[0] -eq 3 -and [int]$parts[1] -ge 11) {
            & python -m venv $Venv
            $made = ($LASTEXITCODE -eq 0)
        }
    }
    if (-not $made) { throw 'Python 3.11 or newer is required.' }
}
& $Python -m pip install -r (Join-Path $Project 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
Write-Host 'Setup complete.'
