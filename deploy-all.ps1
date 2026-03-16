# 完整部署脚本

Write-Host "🚀 开始部署所有应用..." -ForegroundColor Green

# 1. 部署 Comic App
Write-Host "`n📦 步骤 1/3: 部署 Comic App..." -ForegroundColor Cyan
pnpm exec wrangler pages deploy apps/comic-app/dist --project-name=starye-comic
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Comic App 部署失败！" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Comic App 部署成功" -ForegroundColor Green

# 2. 部署 Movie App
Write-Host "`n📦 步骤 2/3: 部署 Movie App..." -ForegroundColor Cyan
pnpm exec wrangler pages deploy apps/movie-app/dist --project-name=starye-movie
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Movie App 部署失败！" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Movie App 部署成功" -ForegroundColor Green

# 3. 部署 Gateway
Write-Host "`n📦 步骤 3/3: 部署 Gateway Worker..." -ForegroundColor Cyan
Set-Location apps/gateway
pnpm exec wrangler deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Gateway 部署失败！" -ForegroundColor Red
    Set-Location ../..
    exit 1
}
Set-Location ../..
Write-Host "✅ Gateway 部署成功" -ForegroundColor Green

Write-Host "`n🎉 所有应用部署完成！" -ForegroundColor Green
Write-Host "`n等待 30 秒让 CDN 生效..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host "`n🧪 测试访问..." -ForegroundColor Cyan
Write-Host "请在浏览器中访问：" -ForegroundColor White
Write-Host "  - https://starye.org/comic/" -ForegroundColor Yellow
Write-Host "  - https://starye.org/movie/" -ForegroundColor Yellow
