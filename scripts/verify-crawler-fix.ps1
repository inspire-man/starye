# 爬虫修复验证脚本

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "爬虫配置验证" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. 检查 .env 文件
Write-Host "1. 检查 .env 文件..." -ForegroundColor Yellow
if (Test-Path "packages\crawler\.env") {
    Write-Host "   ✅ .env 文件存在" -ForegroundColor Green
} else {
    Write-Host "   ❌ .env 文件不存在" -ForegroundColor Red
    Write-Host "   请创建 packages\crawler\.env 并配置 R2 相关变量" -ForegroundColor Red
    exit 1
}

# 2. 运行配置检查
Write-Host "`n2. 运行配置检查..." -ForegroundColor Yellow
pnpm --filter @starye/crawler exec tsx scripts/check-config.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n   ❌ 配置检查失败" -ForegroundColor Red
    exit 1
}

# 3. 测试 ImageProcessor
Write-Host "`n3. 测试 ImageProcessor..." -ForegroundColor Yellow
pnpm --filter @starye/crawler exec tsx scripts/test-image-upload.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n   ❌ ImageProcessor 测试失败" -ForegroundColor Red
    exit 1
}

# 完成
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✅ 所有检查通过！" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "下一步：" -ForegroundColor Yellow
Write-Host "  运行爬虫测试：pnpm --filter @starye/crawler test:optimized" -ForegroundColor White
Write-Host "  查看故障排查指南：packages\crawler\TROUBLESHOOTING.md`n" -ForegroundColor White
