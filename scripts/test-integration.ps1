# Integration Test Script for Aria2 and Rating System
# Simplified version to avoid encoding issues

param(
    [switch]$SkipAria2,
    [switch]$SkipRating
)

$ErrorActionPreference = "Continue"

Write-Host "=== Integration Test ===" -ForegroundColor Cyan
Write-Host ""

$PassCount = 0
$FailCount = 0
$SkipCount = 0

function Test-Item {
    param(
        [string]$Name,
        [scriptblock]$Action
    )

    Write-Host "Test: $Name" -ForegroundColor Yellow

    try {
        & $Action
        Write-Host "  [OK] Pass" -ForegroundColor Green
        $script:PassCount++
    }
    catch {
        Write-Host "  [FAIL] $_" -ForegroundColor Red
        $script:FailCount++
    }
    Write-Host ""
}

# Environment Checks
Write-Host "--- Environment Check ---" -ForegroundColor Cyan

Test-Item "Node.js installed" {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js not installed"
    }
    Write-Host "  Version: $nodeVersion" -ForegroundColor Gray
}

Test-Item "pnpm installed" {
    $pnpmVersion = pnpm --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "pnpm not installed"
    }
    Write-Host "  Version: $pnpmVersion" -ForegroundColor Gray
}

Test-Item "Local database exists" {
    $dbPath = "apps/api/.wrangler/state/v3/d1"
    if (-not (Test-Path $dbPath)) {
        throw "Local database not found at $dbPath"
    }
}

# TypeScript Type Check
Write-Host "--- TypeScript Check ---" -ForegroundColor Cyan

Test-Item "API type check" {
    Push-Location
    Set-Location "apps/api"
    $output = pnpm run type-check 2>&1
    $exitCode = $LASTEXITCODE
    Pop-Location

    if ($exitCode -ne 0) {
        throw "Type check failed"
    }
}

Test-Item "Frontend build check" {
    Push-Location
    Set-Location "apps/movie-app"
    $output = pnpm run build --mode=production 2>&1
    $exitCode = $LASTEXITCODE
    Pop-Location

    if ($exitCode -ne 0) {
        throw "Build failed"
    }
}

# Aria2 Integration Test
if (-not $SkipAria2) {
    Write-Host "--- Aria2 Integration Test ---" -ForegroundColor Cyan

    Test-Item "Aria2 service check" {
        try {
            $body = '{"jsonrpc":"2.0","id":"test","method":"aria2.getVersion"}'
            $response = Invoke-WebRequest -Uri "http://localhost:6800/jsonrpc" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 3 -ErrorAction Stop

            if ($response.StatusCode -eq 200) {
                Write-Host "  Aria2 service is running" -ForegroundColor Gray
            }
        }
        catch {
            Write-Host "  Aria2 service not running" -ForegroundColor Yellow
            Write-Host "  Start with: aria2c --enable-rpc --rpc-listen-all" -ForegroundColor Yellow
            throw "Aria2 service not available"
        }
    }
}

# Summary
Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Pass: $PassCount" -ForegroundColor Green
Write-Host "Fail: $FailCount" -ForegroundColor Red
Write-Host "Skip: $SkipCount" -ForegroundColor Yellow
Write-Host ""

if ($FailCount -gt 0) {
    Write-Host "Some tests failed" -ForegroundColor Red
    exit 1
}
else {
    Write-Host "All tests passed!" -ForegroundColor Green
    exit 0
}
