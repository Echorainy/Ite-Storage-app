param([switch]$SkipBackend)

$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path

function Configure-WardrobeEnv([string]$Backend) {
    $example = Join-Path $Backend '.env.example'
    $envFile = Join-Path $Backend '.env'
    if (-not (Test-Path -LiteralPath $example)) { throw "Missing backend environment template: $example" }

    $lines = if (Test-Path -LiteralPath $envFile) { @(Get-Content -LiteralPath $envFile) } else { @(Get-Content -LiteralPath $example) }
    $existing = ($lines | Where-Object { $_ -match '^OPENAI_API_KEY=(.+)$' } | Select-Object -First 1)
    $hasUsableKey = $existing -and $existing -notmatch 'your_deepseek_api_key_here' -and $existing -notmatch '^OPENAI_API_KEY=$'
    if (-not $hasUsableKey) {
        $secure = Read-Host '请输入 DeepSeek API Key（输入内容不会显示）' -AsSecureString
        $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try { $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
        if ([string]::IsNullOrWhiteSpace($key)) { throw 'DeepSeek API Key 不能为空。' }
        $lines = @($lines | Where-Object { $_ -notmatch '^OPENAI_API_KEY=' })
        $lines = @("OPENAI_API_KEY=$key") + $lines
    } else { Write-Host '检测到已有 DeepSeek API Key，保留现有配置。' }

    $defaults = @{
        'OPENAI_BASE_URL' = 'https://api.deepseek.com'
        'VISION_MODEL' = 'deepseek-flash'
        'CHAT_MODEL' = 'deepseek-chat'
    }
    foreach ($name in $defaults.Keys) {
        if (-not ($lines | Where-Object { $_ -match "^$name=" })) { $lines += "$name=$($defaults[$name])" }
    }
    Set-Content -LiteralPath $envFile -Value $lines -Encoding UTF8
    Write-Host "已写入 $envFile"
}

function Require-Command([string]$Name, [string]$Hint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing $Name. $Hint"
    }
}

Require-Command 'node' 'Install Node.js 22.9 or newer: https://nodejs.org/'

$nodeVersion = [version]((& node --version).TrimStart('v'))
if ($nodeVersion -lt [version]'22.9.0') { throw "Node.js 22.9 or newer is required (found $nodeVersion)." }

$pnpmExe = 'pnpm'
$pnpmPrefix = @()
if (-not (Get-Command 'pnpm' -ErrorAction SilentlyContinue)) {
    $corepack = Get-Command 'corepack' -ErrorAction SilentlyContinue
    if (-not $corepack) { throw 'pnpm or Corepack is missing. Install Node.js 22.9+ or pnpm manually.' }
    Write-Host 'pnpm was not found; preparing it with Corepack...'
    $pnpmExe = 'corepack'
    $pnpmPrefix = @('pnpm')
    & $pnpmExe @pnpmPrefix --version | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Corepack could not prepare pnpm. Run npm install -g pnpm manually.' }
}

Set-Location -LiteralPath $Project
Write-Host 'Installing frontend dependencies...'
& $pnpmExe @pnpmPrefix install
if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }

if (-not $SkipBackend) {
    $backend = Join-Path $Project 'wardrobe_local_tool'
    if (-not (Test-Path -LiteralPath $backend -PathType Container)) { throw "衣柜服务目录不存在：$backend" }
    $pyLauncher = Get-Command 'py' -ErrorAction SilentlyContinue
    $python = Get-Command 'python' -ErrorAction SilentlyContinue
    if (-not $pyLauncher -and -not $python) {
        throw 'Python was not found. Install Python 3.11 or newer and enable Add Python to PATH.'
    }
    Write-Host 'Installing local vision service dependencies...'
    & powershell -ExecutionPolicy Bypass -File (Join-Path $backend 'setup.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Local vision service dependency installation failed.' }
    Configure-WardrobeEnv $backend
}

Write-Host ''
Write-Host 'Setup complete. Start the web app with: pnpm web -- --port 8091'
Write-Host 'Start both services with: .\start-all.ps1'
