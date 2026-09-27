param([Parameter(Mandatory = $false, Position = 0)][string]$InputDir = ".\input", [string]$OutputDir = ".\output", [string]$Database = ".\wardrobe.db")

$ErrorActionPreference = "Stop"
$pythonExe = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Error "Virtual environment not found. Run .\setup.ps1 first."
}
$script = Join-Path $PSScriptRoot "wardrobe_cli.py"
& $pythonExe $script $InputDir --output-dir $OutputDir --db $Database
exit $LASTEXITCODE
