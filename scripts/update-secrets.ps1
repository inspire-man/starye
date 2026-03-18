# 更新生产环境 secrets 脚本
# 从 .dev.vars 读取并更新到 Cloudflare Workers

Write-Host "🔐 更新生产环境 Secrets" -ForegroundColor Cyan
Write-Host ""

# 读取 .dev.vars
$devVars = Get-Content "apps/api/.dev.vars"
$crawlerSecret = ($devVars | Select-String 'CRAWLER_SECRET' | ForEach-Object { $_.ToString().Split('=')[1].Trim('"') })

if (-not $crawlerSecret) {
    Write-Host "❌ 无法从 .dev.vars 读取 CRAWLER_SECRET" -ForegroundColor Red
    exit 1
}

Write-Host "📋 当前 CRAWLER_SECRET: $($crawlerSecret.Substring(0, 15))..." -ForegroundColor Gray
Write-Host ""

Write-Host "⚠️  即将更新生产环境 CRAWLER_SECRET" -ForegroundColor Yellow
Write-Host "   Worker: starye-api" -ForegroundColor Gray
Write-Host ""

$confirm = Read-Host "确认更新？(y/N)"
if ($confirm -ne 'y') {
    Write-Host "❌ 已取消" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🔄 更新中..." -ForegroundColor Yellow

# 更新 secret
Set-Location apps/api
echo $crawlerSecret | pnpm exec wrangler secret put CRAWLER_SECRET
Set-Location ../..

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ CRAWLER_SECRET 已更新" -ForegroundColor Green
    Write-Host ""
    Write-Host "验证步骤：" -ForegroundColor Yellow
    Write-Host "  1. 等待 10-20 秒让 secret 生效" -ForegroundColor Gray
    Write-Host "  2. 运行: pnpm exec tsx scripts/test-batch-status.ts" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "❌ 更新失败" -ForegroundColor Red
    exit 1
}
