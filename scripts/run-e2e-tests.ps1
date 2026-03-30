# E2E 自动化测试运行脚本
# 用于快速运行 Playwright E2E 测试

param(
    [string]$TestFile = "html-integration.spec.ts",
    [switch]$Headed,
    [switch]$UI,
    [switch]$Debug,
    [switch]$All
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   E2E 自动化测试运行脚本" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$MovieAppDir = Join-Path $ProjectRoot "apps\movie-app"

# 检查 Playwright 是否已安装
Write-Host "[1/3] 检查 Playwright 安装..." -ForegroundColor Yellow
$PackageJson = Get-Content (Join-Path $MovieAppDir "package.json") | ConvertFrom-Json
if (-not $PackageJson.devDependencies.'@playwright/test') {
    Write-Host "  ❌ Playwright 未安装" -ForegroundColor Red
    Write-Host "  正在安装 Playwright..." -ForegroundColor Yellow
    Set-Location $MovieAppDir
    pnpm add -D @playwright/test
    Write-Host "  ✓ Playwright 安装完成" -ForegroundColor Green
}
else {
    Write-Host "  ✓ Playwright 已安装" -ForegroundColor Green
}

# 检查浏览器是否已安装
Write-Host ""
Write-Host "[2/3] 检查浏览器..." -ForegroundColor Yellow
$BrowserPath = Join-Path $env:USERPROFILE ".cache\ms-playwright\chromium-*"
if (-not (Test-Path $BrowserPath)) {
    Write-Host "  ⚠️  浏览器未安装" -ForegroundColor Yellow
    Write-Host "  正在安装 Chromium..." -ForegroundColor Yellow
    Set-Location $MovieAppDir
    pnpm run playwright:install
    Write-Host "  ✓ 浏览器安装完成" -ForegroundColor Green
}
else {
    Write-Host "  ✓ 浏览器已安装" -ForegroundColor Green
}

# 运行测试
Write-Host ""
Write-Host "[3/3] 运行 E2E 测试..." -ForegroundColor Yellow
Set-Location $MovieAppDir

$Command = "pnpm run test:e2e"

if ($All) {
    Write-Host "  📋 运行所有测试" -ForegroundColor Cyan
    # 不添加测试文件参数
}
elseif ($UI) {
    Write-Host "  🎨 UI 模式运行: $TestFile" -ForegroundColor Cyan
    $Command = "pnpm run test:e2e:ui"
}
elseif ($Debug) {
    Write-Host "  🐛 调试模式运行: $TestFile" -ForegroundColor Cyan
    $Command = "pnpm run test:e2e:debug $TestFile"
}
elseif ($Headed) {
    Write-Host "  🖥️  带界面运行: $TestFile" -ForegroundColor Cyan
    $Command = "pnpm run test:e2e:headed $TestFile"
}
else {
    Write-Host "  ⚡ 无头模式运行: $TestFile" -ForegroundColor Cyan
    $Command = "$Command $TestFile"
}

Write-Host ""
Invoke-Expression $Command

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host "   ✅ E2E 测试执行成功！" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "查看测试报告:" -ForegroundColor Cyan
    Write-Host "  pnpm exec playwright show-report" -ForegroundColor White
    Write-Host ""
}
else {
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host "   ❌ E2E 测试执行失败" -ForegroundColor Red
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "调试建议:" -ForegroundColor Yellow
    Write-Host "  1. 使用 UI 模式: .\run-e2e-tests.ps1 -UI" -ForegroundColor White
    Write-Host "  2. 使用调试模式: .\run-e2e-tests.ps1 -Debug" -ForegroundColor White
    Write-Host "  3. 查看截图: apps\movie-app\test-results\" -ForegroundColor White
    Write-Host ""
}

# 返回原目录
Set-Location $ProjectRoot
