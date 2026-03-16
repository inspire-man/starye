# Complete Deployment Script (Fixed Dashboard + Gateway Configuration)
# Deployment Order: Gateway -> Dashboard -> Comic -> Movie

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Starting Starye Project Deployment (Fixed)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Deploy Gateway Worker (Fixed Dashboard path rewriting)
Write-Host "[1/4] Deploying Gateway Worker..." -ForegroundColor Yellow
Set-Location apps/gateway
pnpm exec wrangler deploy
Set-Location ../..
if ($LASTEXITCODE -ne 0) {
    Write-Host "Gateway deployment failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Gateway deployed successfully" -ForegroundColor Green
Write-Host ""
Start-Sleep -Seconds 2

# 2. Deploy Dashboard (Fixed API URL configuration)
Write-Host "[2/4] Deploying Dashboard..." -ForegroundColor Yellow
Write-Host "  - Rebuilding (using relative path /api)..." -ForegroundColor Gray
pnpm --filter dashboard run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Dashboard build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "  - Creating Pages project..." -ForegroundColor Gray
pnpm exec wrangler pages project create starye-dashboard --production-branch=main
# Ignore "project already exists" error

Write-Host "  - Deploying to Cloudflare Pages..." -ForegroundColor Gray
pnpm exec wrangler pages deploy apps/dashboard/dist --project-name=starye-dashboard --commit-dirty=true
if ($LASTEXITCODE -ne 0) {
    Write-Host "Dashboard deployment failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dashboard deployed successfully" -ForegroundColor Green
Write-Host ""
Start-Sleep -Seconds 2

# 3. Deploy Comic App
Write-Host "[3/4] Deploying Comic App..." -ForegroundColor Yellow
Write-Host "  - Creating Pages project..." -ForegroundColor Gray
pnpm exec wrangler pages project create starye-comic --production-branch=main

Write-Host "  - Deploying to Cloudflare Pages..." -ForegroundColor Gray
pnpm exec wrangler pages deploy apps/comic-app/dist --project-name=starye-comic --commit-dirty=true
if ($LASTEXITCODE -ne 0) {
    Write-Host "Comic App deployment failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Comic App deployed successfully" -ForegroundColor Green
Write-Host ""
Start-Sleep -Seconds 2

# 4. Deploy Movie App
Write-Host "[4/4] Deploying Movie App..." -ForegroundColor Yellow
Write-Host "  - Creating Pages project..." -ForegroundColor Gray
pnpm exec wrangler pages project create starye-movie --production-branch=main

Write-Host "  - Deploying to Cloudflare Pages..." -ForegroundColor Gray
pnpm exec wrangler pages deploy apps/movie-app/dist --project-name=starye-movie --commit-dirty=true
if ($LASTEXITCODE -ne 0) {
    Write-Host "Movie App deployment failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Movie App deployed successfully" -ForegroundColor Green
Write-Host ""

# Complete
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "All Services Deployed Successfully!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Please wait 30-60 seconds for Cloudflare global network to sync, then test:" -ForegroundColor Yellow
Write-Host "  • Dashboard: https://starye.org/dashboard/" -ForegroundColor White
Write-Host "  • Comic App: https://starye.org/comic/" -ForegroundColor White
Write-Host "  • Movie App: https://starye.org/movie/" -ForegroundColor White
Write-Host ""

Write-Host "Verification Checklist:" -ForegroundColor Yellow
Write-Host "  [ ] Dashboard page loads correctly" -ForegroundColor Gray
Write-Host "  [ ] Dashboard user list shows production data (not local)" -ForegroundColor Gray
Write-Host "  [ ] Comic/Movie pages load correctly" -ForegroundColor Gray
Write-Host "  [ ] Login functionality works" -ForegroundColor Gray
Write-Host "  [ ] No 404 or CORS errors in console" -ForegroundColor Gray
Write-Host ""
