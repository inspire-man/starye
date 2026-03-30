# Database Schema Verification Script
$db = "starye-db"
$workingDir = "apps/api"

Write-Host "Database Schema Verification" -ForegroundColor Cyan
Write-Host "Working directory: $workingDir" -ForegroundColor Gray
Write-Host ""

Set-Location $workingDir

Write-Host "1. Checking tables..." -ForegroundColor Yellow
pnpm exec wrangler d1 execute $db --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

Write-Host ""
Write-Host "2. Checking ratings table structure..." -ForegroundColor Yellow
pnpm exec wrangler d1 execute $db --local --command "PRAGMA table_info(ratings)"

Write-Host ""
Write-Host "3. Checking aria2_configs table structure..." -ForegroundColor Yellow
pnpm exec wrangler d1 execute $db --local --command "PRAGMA table_info(aria2_configs)"

Write-Host ""
Write-Host "4. Checking player table for new fields..." -ForegroundColor Yellow
pnpm exec wrangler d1 execute $db --local --command "SELECT sql FROM sqlite_master WHERE type='table' AND name='player'" | Select-String "average_rating|rating_count"

Write-Host ""
Write-Host "5. Checking indexes..." -ForegroundColor Yellow
pnpm exec wrangler d1 execute $db --local --command "SELECT name, tbl_name FROM sqlite_master WHERE type='index'" | Select-String "ratings|player"

Write-Host ""
Write-Host "6. Test query on ratings table..." -ForegroundColor Yellow
pnpm exec wrangler d1 execute $db --local --command "SELECT COUNT(*) as count FROM ratings"

Write-Host ""
Write-Host "7. Test query on aria2_configs table..." -ForegroundColor Yellow
pnpm exec wrangler d1 execute $db --local --command "SELECT COUNT(*) as count FROM aria2_configs"

Set-Location ../..

Write-Host ""
Write-Host "Verification complete" -ForegroundColor Green
