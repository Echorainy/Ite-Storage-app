param([int]$Port = 8000)
$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $Project '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $Python)) { Write-Host 'Run setup.ps1 first.'; exit 1 }
Set-Location -LiteralPath $Project
Write-Host ('Wardrobe API listening on http://127.0.0.1:' + $Port)
& $Python -m uvicorn app:app --host 0.0.0.0 --port $Port
