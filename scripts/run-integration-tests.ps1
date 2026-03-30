# Automated Integration Tests
# This script runs automated integration tests that don't require UI interaction

param(
    [switch]$SkipServiceStart  # Skip starting services (assume they're already running)
)

$ErrorActionPreference = "Continue"
$API_URL = "http://localhost:8788"

Write-Host "=== Automated Integration Tests ===" -ForegroundColor Cyan
Write-Host ""

# Test counters
$script:PassCount = 0
$script:FailCount = 0
$script:ManualCount = 0

function Test-Auto {
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

function Test-Manual {
    param([string]$Name)
    Write-Host "Test: $Name" -ForegroundColor Yellow
    Write-Host "  [MANUAL] Requires manual verification" -ForegroundColor Magenta
    $script:ManualCount++
    Write-Host ""
}

# ============================================
# Part 1: Environment Checks
# ============================================
Write-Host "--- Part 1: Environment Checks ---" -ForegroundColor Cyan

Test-Auto "Node.js installed" {
    $version = node --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Not installed" }
    Write-Host "  Version: $version" -ForegroundColor Gray
}

Test-Auto "pnpm installed" {
    $version = pnpm --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Not installed" }
    Write-Host "  Version: $version" -ForegroundColor Gray
}

Test-Auto "Database exists" {
    $dbPath = "apps/api/.wrangler/state/v3/d1"
    if (-not (Test-Path $dbPath)) {
        throw "Database not found. Run: pnpm --filter api run db:migrate:local"
    }
}

Test-Auto "TypeScript check - API" {
    Push-Location apps/api
    $output = pnpm run type-check 2>&1
    Pop-Location
    if ($LASTEXITCODE -ne 0) { throw "Type check failed" }
}

Test-Auto "TypeScript check - Frontend" {
    Push-Location apps/movie-app
    $output = pnpm run build --mode=production 2>&1
    Pop-Location
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }
}

# ============================================
# Part 2: Unit Tests
# ============================================
Write-Host "--- Part 2: Unit Tests ---" -ForegroundColor Cyan

Test-Auto "Backend unit tests" {
    Push-Location apps/api
    $output = pnpm run test 2>&1
    Pop-Location
    if ($LASTEXITCODE -ne 0) { throw "Tests failed" }
}

Test-Auto "Frontend unit tests" {
    Push-Location apps/movie-app
    $output = pnpm run test 2>&1
    Pop-Location
    if ($LASTEXITCODE -ne 0) { throw "Tests failed" }
}

# ============================================
# Part 3: Service Health (if running)
# ============================================
Write-Host "--- Part 3: Service Health ---" -ForegroundColor Cyan

Test-Auto "API service health" {
    try {
        $response = Invoke-WebRequest -Uri "$API_URL/api/health" -Method GET -TimeoutSec 3 -ErrorAction Stop
        if ($response.StatusCode -ne 200) {
            throw "Health check failed with status $($response.StatusCode)"
        }
        Write-Host "  API service is running" -ForegroundColor Gray
    }
    catch {
        throw "API service not running. Start with: pnpm --filter api run dev"
    }
}

Test-Auto "API movies endpoint" {
    try {
        $response = Invoke-WebRequest -Uri "$API_URL/api/movies?page=1&limit=5" -Method GET -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -ne 200) {
            throw "Movies endpoint failed"
        }
        $data = $response.Content | ConvertFrom-Json
        Write-Host "  Returned $($data.data.Count) movies" -ForegroundColor Gray
    }
    catch {
        throw "Movies endpoint failed: $_"
    }
}

# ============================================
# Part 4: Manual Integration Tests
# ============================================
Write-Host "--- Part 4: Manual Integration Tests ---" -ForegroundColor Cyan

Test-Manual "25.1 Start Aria2 service"
Test-Manual "25.2 Configure Aria2 connection"
Test-Manual "25.3 Add magnet link"
Test-Manual "25.4 Verify task downloading"
Test-Manual "25.5 Test pause/resume/delete"
Test-Manual "25.6 Test WebSocket real-time progress"
Test-Manual "25.7 Test WebSocket fallback"
Test-Manual "25.8 Test batch add tasks"

Test-Manual "26.1 Submit rating (logged in)"
Test-Manual "26.2 Verify rating display"
Test-Manual "26.3 Modify rating"
Test-Manual "26.4 View rating distribution"
Test-Manual "26.5 View top ratings"
Test-Manual "26.6 Test rate limiting"
Test-Manual "26.7 Test rating without login"

Test-Manual "27.1 New user Aria2 setup"
Test-Manual "27.2 Sync download list to Aria2"
Test-Manual "27.3 Import from Aria2"
Test-Manual "27.4 Rating tag changes"
Test-Manual "27.5 WebSocket reconnection"
Test-Manual "27.6 Cross-device config sync"
Test-Manual "27.7 Mobile workflow"

# ============================================
# Summary
# ============================================
Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Automated Pass: $script:PassCount" -ForegroundColor Green
Write-Host "Automated Fail: $script:FailCount" -ForegroundColor Red
Write-Host "Manual Required: $script:ManualCount" -ForegroundColor Yellow
Write-Host ""

if ($script:FailCount -gt 0) {
    Write-Host "Some automated tests failed. Please review." -ForegroundColor Red
    exit 1
}
elseif ($script:ManualCount -gt 0) {
    Write-Host "All automated tests passed!" -ForegroundColor Green
    Write-Host "$script:ManualCount manual tests require verification." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To run manual tests:" -ForegroundColor Cyan
    Write-Host "1. Start services:" -ForegroundColor White
    Write-Host "   - pnpm --filter api run dev" -ForegroundColor Gray
    Write-Host "   - pnpm --filter movie-app run dev" -ForegroundColor Gray
    Write-Host "   - aria2c --enable-rpc --rpc-listen-all (optional)" -ForegroundColor Gray
    Write-Host "2. Follow: openspec/changes/aria2-integration-quality-rating/INTEGRATION_TEST_GUIDE.md" -ForegroundColor White
    exit 0
}
else {
    Write-Host "All tests passed!" -ForegroundColor Green
    exit 0
}
