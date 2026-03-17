# 快速诊断和修复脚本

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Starye 项目诊断和修复" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 步骤 1：检查生产数据库
Write-Host "[1/3] 检查生产数据库..." -ForegroundColor Yellow
Write-Host ""

Write-Host "检查 Movies 表：" -ForegroundColor Gray
pnpm exec wrangler d1 execute starye-db --command "SELECT COUNT(*) as total FROM movies" --remote

Write-Host ""
Write-Host "检查 Comics 表：" -ForegroundColor Gray
pnpm exec wrangler d1 execute starye-db --command "SELECT COUNT(*) as total FROM comics" --remote

Write-Host ""
Write-Host "检查 Users 表：" -ForegroundColor Gray
pnpm exec wrangler d1 execute starye-db --command "SELECT COUNT(*) as total FROM user" --remote

Write-Host ""
Write-Host ""

# 步骤 2：测试 API 响应
Write-Host "[2/3] 测试 API 响应..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Movies API：" -ForegroundColor Gray
curl -s "https://starye.org/api/public/movies" | ConvertFrom-Json | Select-Object total,page,limit | Format-Table

Write-Host "Comics API：" -ForegroundColor Gray
curl -s "https://starye.org/api/public/comics" | ConvertFrom-Json | Select-Object total,page,limit | Format-Table

Write-Host ""
Write-Host ""

# 步骤 3：显示数据样本（如果有数据）
Write-Host "[3/3] 显示数据样本..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Movies 示例（前 3 条）：" -ForegroundColor Gray
pnpm exec wrangler d1 execute starye-db --command "SELECT id, title, slug FROM movies LIMIT 3" --remote

Write-Host ""
Write-Host "Comics 示例（前 3 条）：" -ForegroundColor Gray
pnpm exec wrangler d1 execute starye-db --command "SELECT id, title, slug FROM comics LIMIT 3" --remote

Write-Host ""
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "诊断完成" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "如果生产数据库为空，执行以下命令导入数据：" -ForegroundColor Yellow
Write-Host ""
Write-Host "  cd apps/api" -ForegroundColor White
Write-Host "  wrangler d1 export DB --output=starye-data.sql" -ForegroundColor White
Write-Host "  wrangler d1 execute starye-db --file=starye-data.sql --remote" -ForegroundColor White
Write-Host ""
