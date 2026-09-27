param([int]$WebPort = 8091, [int]$ApiPort = 8000)

$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendScript = Join-Path $Project 'wardrobe_local_tool\start_web.ps1'
$python = Join-Path $Project 'wardrobe_local_tool\.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    throw 'The local vision service is not installed. Run .\setup.ps1 first.'
}
$envFile = Join-Path $Project 'wardrobe_local_tool\.env'
if (-not (Test-Path -LiteralPath $envFile)) {
    throw 'wardrobe_local_tool\.env is missing. Run .\setup.ps1 and enter your DeepSeek API Key first.'
}
$configured = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^OPENAI_API_KEY=(.+)$' -and $_ -notmatch 'your_deepseek_api_key_here' }
if (-not $configured) { throw 'DeepSeek API Key is not configured. Run .\setup.ps1 again.' }

Start-Process -WindowStyle Hidden -FilePath 'powershell' -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-File', $backendScript, '-Port', $ApiPort) -WorkingDirectory (Join-Path $Project 'wardrobe_local_tool')
$env:EXPO_PUBLIC_WARDROBE_API_URL = "http://localhost:$ApiPort"
Set-Location -LiteralPath $Project
Write-Host "Starting MeRoom at http://localhost:$WebPort"
Write-Host "Wardrobe API: http://localhost:$ApiPort"
if (Get-Command 'pnpm' -ErrorAction SilentlyContinue) {
    & pnpm web -- --port $WebPort
} elseif (Get-Command 'corepack' -ErrorAction SilentlyContinue) {
    & corepack pnpm web -- --port $WebPort
} else {
    throw 'pnpm is missing. Run .\setup.ps1 first.'
}
