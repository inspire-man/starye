# 生产环境密钥设置脚本 (PowerShell)
# 使用方法: .\scripts\setup-production-secrets.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🔐 Starye API - 生产环境密钥设置" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# 检查 wrangler 是否安装
$wranglerPath = Get-Command wrangler -ErrorAction SilentlyContinue
if (-not $wranglerPath) {
    Write-Host "❌ 错误: wrangler 未安装" -ForegroundColor Red
    Write-Host "请运行: npm install -g wrangler"
    exit 1
}

# 切换到 API 目录
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiPath = Join-Path $scriptPath "..\apps\api"
Set-Location $apiPath

Write-Host "📂 当前目录: $(Get-Location)"
Write-Host ""

# 检查 .dev.vars 文件
if (-not (Test-Path ".dev.vars")) {
    Write-Host "❌ 错误: .dev.vars 文件不存在" -ForegroundColor Red
    exit 1
}

Write-Host "📋 将从 .dev.vars 读取密钥值..."
Write-Host ""

# 读取密钥
$devVars = Get-Content ".dev.vars"
$CRAWLER_SECRET = ($devVars | Select-String "CRAWLER_SECRET" | ForEach-Object { $_ -replace '.*=\s*"?([^"]+)"?.*', '$1' })
$BETTER_AUTH_SECRET = ($devVars | Select-String "BETTER_AUTH_SECRET" | ForEach-Object { $_ -replace '.*=\s*"?([^"]+)"?.*', '$1' })
$GITHUB_CLIENT_ID = ($devVars | Select-String "GITHUB_CLIENT_ID" | ForEach-Object { $_ -replace '.*=\s*"?([^"]+)"?.*', '$1' })
$GITHUB_CLIENT_SECRET = ($devVars | Select-String "GITHUB_CLIENT_SECRET" | ForEach-Object { $_ -replace '.*=\s*"?([^"]+)"?.*', '$1' })

# 验证必需的密钥
if ([string]::IsNullOrWhiteSpace($CRAWLER_SECRET)) {
    Write-Host "❌ 错误: CRAWLER_SECRET 未在 .dev.vars 中找到" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrWhiteSpace($BETTER_AUTH_SECRET)) {
    Write-Host "❌ 错误: BETTER_AUTH_SECRET 未在 .dev.vars 中找到" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 找到必需的密钥" -ForegroundColor Green
Write-Host "   CRAWLER_SECRET: $($CRAWLER_SECRET.Substring(0, [Math]::Min(20, $CRAWLER_SECRET.Length)))... (长度: $($CRAWLER_SECRET.Length))"
Write-Host "   BETTER_AUTH_SECRET: $($BETTER_AUTH_SECRET.Substring(0, [Math]::Min(20, $BETTER_AUTH_SECRET.Length)))... (长度: $($BETTER_AUTH_SECRET.Length))"
Write-Host ""

# 询问是否继续
$confirm = Read-Host "是否要设置这些密钥到 Cloudflare Workers? (y/N)"
if ($confirm -notmatch '^[Yy]$') {
    Write-Host "❌ 已取消" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🚀 开始设置密钥..." -ForegroundColor Cyan
Write-Host ""

# 设置 CRAWLER_SECRET
Write-Host "1️⃣ 设置 CRAWLER_SECRET..."
$CRAWLER_SECRET | wrangler secret put CRAWLER_SECRET
Write-Host "   ✅ CRAWLER_SECRET 已设置" -ForegroundColor Green
Write-Host ""

# 设置 BETTER_AUTH_SECRET
Write-Host "2️⃣ 设置 BETTER_AUTH_SECRET..."
$BETTER_AUTH_SECRET | wrangler secret put BETTER_AUTH_SECRET
Write-Host "   ✅ BETTER_AUTH_SECRET 已设置" -ForegroundColor Green
Write-Host ""

# 设置 GitHub OAuth（可选）
if (-not [string]::IsNullOrWhiteSpace($GITHUB_CLIENT_ID) -and -not [string]::IsNullOrWhiteSpace($GITHUB_CLIENT_SECRET)) {
    $confirmGithub = Read-Host "是否也要设置 GitHub OAuth 密钥? (y/N)"
    if ($confirmGithub -match '^[Yy]$') {
        Write-Host "3️⃣ 设置 GITHUB_CLIENT_ID..."
        $GITHUB_CLIENT_ID | wrangler secret put GITHUB_CLIENT_ID
        Write-Host "   ✅ GITHUB_CLIENT_ID 已设置" -ForegroundColor Green
        Write-Host ""

        Write-Host "4️⃣ 设置 GITHUB_CLIENT_SECRET..."
        $GITHUB_CLIENT_SECRET | wrangler secret put GITHUB_CLIENT_SECRET
        Write-Host "   ✅ GITHUB_CLIENT_SECRET 已设置" -ForegroundColor Green
        Write-Host ""
    }
}

# 验证设置
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📊 已设置的密钥列表:" -ForegroundColor Cyan
Write-Host ""
wrangler secret list
Write-Host ""

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ 密钥设置完成!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 下一步:" -ForegroundColor Yellow
Write-Host "   1. 部署 Worker: wrangler deploy"
Write-Host "   2. 测试 API: cd ..\..\packages\crawler; pnpm test:api"
Write-Host ""

